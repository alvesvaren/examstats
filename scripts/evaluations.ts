/**
 * Crawls Chalmers' public course survey reports and writes `data/evaluations.json`: one row per course round over
 * the last few academic years. A monthly GitHub Action runs it and commits the file, and `pnpm snapshot` reads it.
 *
 * Reports render one at a time in one session. The site keys charts by render time, so reports rendered at once can
 * serve each other's charts. Charts need no session, so they download several at a time while later reports render.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { EVALUATION_YEARS, QUESTIONS, type EvaluationFile, type Question } from "../src/domain/evaluation.ts";
import {
  CHART_WIDTH,
  parseAnswerChart,
  parseReport,
  parseSearchForm,
  parseSurveyRows,
  parseTitle,
  type Category,
} from "./evaluation-pages.ts";
import { toJsonLines } from "./json-lines.ts";

const env = z
  .object({
    EVAL_URL: z.url().default("https://course-eval.portal.chalmers.se"),
    OUT_FILE: z.string().default("data/evaluations.json"),
    YEARS: z.coerce.number().int().positive().default(EVALUATION_YEARS),
  })
  .parse(process.env);

/** Report pages linked from chalmers.se: bachelor programmes and other courses, then master programmes. */
const REPORT_IDS = [4257, 4248];
/** The search form accepts at most this many programmes at once. */
const PROGRAMMES_PER_SEARCH = 5;
const RETRIES = 3;
const RETRY_DELAY_MS = 2000;
/** Chart downloads at a time. The site serves requests outside a session in parallel. */
const CHART_CONCURRENCY = 6;
/** Rounds whose charts may still be downloading while the next report renders, so no chart key waits long. */
const PIPELINE_DEPTH = 3;
const HEADERS = {
  "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
  "User-Agent": "u345 course stats (+https://github.com/alvesvaren/examstats)",
};
/** More failed surveys than this means the site is down, and the file keeps its last good contents. */
const MAX_SKIPPED_SHARE = 0.02;
const MAX_REDIRECTS = 10;
const PROGRESS_EVERY = 250;

type Round = EvaluationFile["rounds"][number];

/**
 * A browser-like session. The site checks for cookies with a redirect loop, ties searches and report tokens to a
 * session, and fails to render reports for requests without Accept-Language.
 */
class Session {
  private cookies = new Map<string, string>();

  text = async (url: string, form?: Record<string, string>) => (await this.request(url, form)).text();

  private async request(url: string, form?: Record<string, string>): Promise<Response> {
    let target = new URL(url, env.EVAL_URL);
    let body = form && new URLSearchParams(form);
    for (let redirect = 0; redirect < MAX_REDIRECTS; redirect++) {
      const response = await fetch(target, {
        method: body ? "POST" : "GET",
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(60_000),
        headers: { ...HEADERS, Cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ") },
      });
      for (const cookie of response.headers.getSetCookie()) {
        const [pair = ""] = cookie.split(";");
        const index = pair.indexOf("=");
        this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
      }
      const location = response.headers.get("location");
      if (!location) {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${target.href}`);
        return response;
      }
      target = new URL(location, target);
      body = undefined;
    }
    throw new Error(`Too many redirects for ${url}`);
  }
}

/** A session on one report's search form. The site only serves the form to sessions that have visited its start page. */
async function openReport(reportId: number) {
  const session = new Session();
  await session.text("/SR/");
  const form = parseSearchForm(await session.text(`/sr/ar/${reportId}/sv`));

  const search = async (programmes: readonly Category[], years: readonly Category[]) =>
    parseSurveyRows(
      await session.text(`/sr/ar/${reportId}/sv`, {
        hfSelection: "1",
        SessionKey: form.sessionKey,
        [form.programmes.name]: programmes.map((p) => p.id).join(","),
        [form.years.name]: years.map((y) => y.id).join(","),
      }),
    );

  /** Renders a report. Chart addresses in it are relative to `base`. */
  const report = async (surveyId: number) => {
    const tokenJson = await session.text("/SR/plugin/Json/advreport", {
      action: "getarreporttoken",
      reportId: String(reportId),
      token: `${surveyId}|-`,
      SessionKey: form.sessionKey,
    });
    const { id, token } = z.object({ id: z.number(), token: z.string() }).parse(JSON.parse(tokenJson));
    const base = `/SR/Report/Token/${id}/0`;
    return { base, ...parseReport(await session.text(`${base}/${token}`)) };
  };

  return { programmes: form.programmes.options, years: form.years.options, search, report };
}

const chunk = <T>(items: readonly T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs at most `limit` calls at once. A finished call hands its slot straight to the next waiting one. */
function limiter(limit: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active < limit) active++;
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      return await fn();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

const chartSlot = limiter(CHART_CONCURRENCY);

/** Downloads a chart without a session, since any request may fetch any chart by its address. */
async function fetchChart(url: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(new URL(url, env.EVAL_URL), { headers: HEADERS, signal: AbortSignal.timeout(60_000) });
      if (!response.ok || response.headers.get("content-type") !== "image/png") throw new Error(`${response.status} for ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt >= RETRIES) throw error;
      await sleep(attempt * RETRY_DELAY_MS);
    }
  }
}

type Rendered = Awaited<ReturnType<Awaited<ReturnType<typeof openReport>>["report"]>>;

/** How many gave each answer to every standard question whose chart reads cleanly. */
async function readAnswerCounts({ base, charts, answers, means }: Rendered): Promise<Round["answerCounts"]> {
  const read = async (question: Question) => {
    const chart = charts[question];
    const mean = means[question];
    if (!chart || mean === undefined) return [];
    try {
      const png = await chartSlot(() => fetchChart(`${base}/getreportchart.png${chart}&w=${CHART_WIDTH}`));
      const counts = parseAnswerChart(png, answers, mean);
      return counts ? [[question, counts] as const] : [];
    } catch (error) {
      console.warn(`No ${question} chart at ${base}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  };
  return Object.fromEntries((await Promise.all(QUESTIONS.map(read))).flat());
}

async function crawlReport(reportId: number): Promise<Round[]> {
  let report = await openReport(reportId);
  const years = report.years.toSorted((a, b) => a.label.localeCompare(b.label)).slice(-env.YEARS);
  console.log(`Report ${reportId}: ${report.programmes.length} programmes, ${years.map((y) => y.label).join(", ")}`);

  const titles = new Map<number, string>();
  for (const programmes of chunk(report.programmes, PROGRAMMES_PER_SEARCH)) {
    for (const { id, title } of await report.search(programmes, years)) titles.set(id, title);
  }
  const surveys = [...titles].flatMap(([id, title]) => {
    const course = parseTitle(title);
    if (!course) console.warn(`Skipping "${title}": no course code or academic year`);
    return course ? [{ id, title, course }] : [];
  });
  console.log(`Report ${reportId}: ${surveys.length} surveys`);

  const fetchRound = async (surveyId: number) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await report.report(surveyId);
      } catch (error) {
        if (attempt >= RETRIES) throw error;
        // Sessions expire during long crawls, so retry in a fresh one.
        await sleep(attempt * RETRY_DELAY_MS);
        report = await openReport(reportId);
      }
    }
  };

  const rounds: Round[] = [];
  // Charts of a few earlier rounds download while the next report renders.
  const downloading: Promise<void>[] = [];
  for (const [index, { id, title, course }] of surveys.entries()) {
    try {
      const rendered = await fetchRound(id);
      const { respondents, answers, minutes, means } = rendered;
      const round = readAnswerCounts(rendered).then((answerCounts) => {
        rounds.push({ ...course, respondents, answers, minutes, means, answerCounts });
      });
      downloading.push(round);
      if (downloading.length >= PIPELINE_DEPTH) await downloading.shift();
    } catch (error) {
      console.warn(`Skipping "${title}" (${id}): ${error instanceof Error ? error.message : String(error)}`);
    }
    if ((index + 1) % PROGRESS_EVERY === 0) console.log(`Report ${reportId}: ${index + 1}/${surveys.length}`);
  }
  await Promise.all(downloading);
  const skipped = surveys.length - rounds.length;
  if (skipped > surveys.length * MAX_SKIPPED_SHARE) throw new Error(`Report ${reportId}: ${skipped} of ${surveys.length} surveys failed`);
  return rounds;
}

/** Positive when `a` is the better copy of a round: one with more questions' answer counts, then more answers. */
const compareCopies = (a: Round, b: Round) =>
  Object.keys(a.answerCounts).length - Object.keys(b.answerCounts).length || a.answers - b.answers;

/** A round can show up in both reports, or twice in one. Keep the best copy. */
function dedupe(rounds: readonly Round[]): Round[] {
  const byKey = new Map<string, Round>();
  for (const round of rounds) {
    const key = `${round.code} ${round.academicYear} ${round.periods}`;
    const existing = byKey.get(key);
    if (!existing || compareCopies(round, existing) > 0) byKey.set(key, round);
  }
  return [...byKey.values()].toSorted(
    (a, b) => a.code.localeCompare(b.code) || a.academicYear - b.academicYear || (a.periods ?? "").localeCompare(b.periods ?? ""),
  );
}

async function main() {
  const crawled: Round[] = [];
  for (const reportId of REPORT_IDS) crawled.push(...(await crawlReport(reportId)));
  const rounds = dedupe(crawled);
  await mkdir(path.dirname(env.OUT_FILE), { recursive: true });
  await writeFile(env.OUT_FILE, toJsonLines({ fetchedAt: new Date().toISOString() }, "rounds", rounds));
  console.log(`Wrote ${rounds.length} rounds for ${new Set(rounds.map((r) => r.code)).size} courses to ${env.OUT_FILE}`);
  for (const question of QUESTIONS) {
    const withCounts = rounds.filter((r) => r.answerCounts[question]).length;
    const asked = rounds.filter((r) => r.means[question] !== undefined).length;
    console.log(`${question}: answer counts for ${withCounts} of ${asked} rounds`);
  }
}

await main();
