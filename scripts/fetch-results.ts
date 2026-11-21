/**
 * Crawls the public stats.ftek.se API and writes `data/results.json`: every course with its results per part.
 * A nightly GitHub Action runs it and commits the file when the results change, and `pnpm snapshot` reads it.
 * The file holds no timestamp, so unchanged results give an unchanged file.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { partsOf } from "../src/domain/course-stats.ts";
import { gradeCountsSchema } from "../src/domain/grades.ts";
import type { Part, ResultsFile } from "../src/domain/course-stats.ts";
import { toJsonLines } from "./json-lines.ts";
import { mapConcurrent } from "./map-concurrent.ts";

const envSchema = z.object({
  API_URL: z.url().default("https://stats.ftek.se"),
  OUT_FILE: z.string().default("data/results.json"),
  CONCURRENCY: z.coerce.number().int().positive().default(10),
});

const PAGE_SIZE = 1000;
const RETRIES = 3;
/** The source writes "-" for a missing programme, and for some programmes' long names. */
const NO_PROGRAMME = "-";

export const upstreamCourseSchema = z.object({
  courseCode: z.string(),
  courseName: z.string(),
  programShort: z.string(),
  programLong: z.string().optional(),
});
const upstreamPageSchema = z.object({ courses: z.array(upstreamCourseSchema) });
const upstreamResultSchema = gradeCountsSchema.extend({
  date: z.iso.date(),
  type: z.string(),
  resultId: z.string(),
});
export const upstreamResultsSchema = z.array(upstreamResultSchema);
type UpstreamCourse = z.infer<typeof upstreamCourseSchema>;

async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return schema.parse(await response.json());
    } catch (error) {
      if (attempt >= RETRIES) throw new Error(`GET ${url} failed`, { cause: error });
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
}

/** Pages start at 0, not 1 as the upstream API docs suggest. */
async function listCourses(apiUrl: string) {
  const courses: UpstreamCourse[] = [];
  for (let page = 0; ; page++) {
    const { courses: batch } = await fetchJson(`${apiUrl}/courses?sort=courseCode_asc&items=${PAGE_SIZE}&page=${page}`, upstreamPageSchema);
    courses.push(...batch);
    if (batch.length < PAGE_SIZE) return courses;
  }
}

export const toParts = (results: z.infer<typeof upstreamResultsSchema>): Part[] =>
  partsOf(results.map(({ date, type, resultId, ...grades }) => ({ date, type, code: resultId, grades })));

/** "INFORMATIONSTEKNIK, CIVILINGENJÖR" becomes "Informationsteknik, civilingenjör". */
export const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

export const toCourseHead = (course: UpstreamCourse) => ({
  code: course.courseCode,
  name: course.courseName,
  programme: course.programShort === NO_PROGRAMME ? null : course.programShort,
});

/** The programme codes of `upstream` with their names, sentence-cased from the long name when the source has one. */
export const toProgrammes = (upstream: readonly UpstreamCourse[]) =>
  Object.fromEntries(
    upstream
      .filter((c) => c.programShort !== NO_PROGRAMME)
      .map((c) => {
        const long = c.programLong?.trim();
        return [c.programShort, long && long !== NO_PROGRAMME ? sentenceCase(long) : c.programShort] as const;
      })
      .toSorted(([a], [b]) => a.localeCompare(b)),
  );

async function main() {
  const env = envSchema.parse(process.env);
  const upstream = (await listCourses(env.API_URL)).toSorted((a, b) => a.courseCode.localeCompare(b.courseCode));
  console.log(`Fetched ${upstream.length} courses`);

  const courses: ResultsFile["courses"] = await mapConcurrent(upstream, env.CONCURRENCY, async (course) => ({
    ...toCourseHead(course),
    parts: toParts(await fetchJson(`${env.API_URL}/results/${encodeURIComponent(course.courseCode)}`, upstreamResultsSchema)),
  }));
  const programmes = toProgrammes(upstream);

  await mkdir(path.dirname(env.OUT_FILE), { recursive: true });
  await writeFile(env.OUT_FILE, toJsonLines({ programmes }, "courses", courses));
  console.log(`Wrote ${courses.length} courses and ${Object.keys(programmes).length} programmes to ${env.OUT_FILE}`);
}

if (import.meta.main) await main();
