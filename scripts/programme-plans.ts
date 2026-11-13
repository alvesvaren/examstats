/**
 * Fetches every Chalmers programme plan for the current academic year from the JSON API behind chalmers.se and writes
 * `data/programme-plans.json`: per programme and year of study, the courses with their study periods and rules. The
 * plans name no examiners, so it also fetches each planned course's syllabus for the examiners of its rounds. The
 * degree requirements of a programme come from its programme syllabus.
 * A weekly GitHub Action runs it and commits the file when it changes. The only code that knows that API.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  roundOf,
  STUDY_PERIODS,
  type CourseRound,
  type PlanChoice,
  type PlanCourse,
  type PlanRequirement,
  type ProgrammePlan,
  type ProgrammePlansFile,
  type StudyPeriod,
  type Theme,
} from "../src/domain/programme-plans.ts";
import { toJsonLines } from "./json-lines.ts";
import { mapConcurrent } from "./map-concurrent.ts";

/** Plans for the next academic year replace the current ones in July, ahead of course registration. */
const ACADEMIC_YEAR_START_MONTH = 7;

function currentAcademicYear(today: Date) {
  const year = today.getFullYear() - (today.getMonth() + 1 < ACADEMIC_YEAR_START_MONTH ? 1 : 0);
  return `${year}/${year + 1}`;
}

const env = z
  .object({
    API_URL: z.url().default("https://www.chalmers.se/api"),
    OUT_FILE: z.string().default("data/programme-plans.json"),
    ACADEMIC_YEAR: z
      .string()
      .regex(/^\d{4}\/\d{4}$/)
      .default(currentAcademicYear(new Date())),
    CONCURRENCY: z.coerce.number().int().positive().default(4),
  })
  .parse(process.env);

const RETRIES = 3;
const HEADERS = { "User-Agent": "u345 course stats (+https://github.com/alvesvaren/examstats)" };
/** Larger than the number of programmes in a year, so one page lists them all. */
const LIST_SIZE = 1000;
/** Fewer programmes than this means the API answered with something other than the full list. */
const MIN_PROGRAMMES = 40;
/** More failed syllabi than this means the API is down or changed, and the file keeps its last good contents. */
const MAX_FAILED_SHARE = 0.02;
/** Credits come in tenths, and summing them in floating point drifts. */
const tenths = (credits: number) => Math.round(credits * 10) / 10;

const PERIOD_CODES: Record<string, StudyPeriod> = { LP1: "LP1", LP2: "LP2", LP3: "LP3", LP4: "LP4", LP5: "Summer" };
const periodOf = (code: string | null) => PERIOD_CODES[code ?? ""] ?? "Other";
/** The plans name more themes, such as the design projects of architecture. Only these two are degree requirements the plans can answer. */
const THEME_NAMES: Record<string, Theme> = { MTS: "mts", Environment: "environment" };
const THEME_REQUIREMENTS: Record<string, Theme> = { CRED_MTS: "mts", CRED_MJO: "environment" };
/** A programme that admits no new students has no syllabus for this year. Its students follow the newest one before it. */
const SYLLABUS_YEARS_BACK = 5;
const CHOICE_KINDS: Record<string, PlanChoice["kind"]> = { MAN: "pick", OVER: "exclusive", REC: "recommended" };

const listSchema = z.object({
  results: z.array(z.object({ programCode: z.string(), name: z.string(), acYear: z.string() })),
});

const momentSchema = z.object({
  courseCode: z.string(),
  courseName: z.string(),
  cancelled: z.boolean(),
  moduleCode: z.string(),
  momentCredit: z.number().nullable(),
  rule: z.string(),
  ruleName: z.string(),
  studyPerodId: z.string().nullable(),
  blockSchedule: z.string().nullable(),
  momentSpecialisation: z.object({ concName: z.string().nullable() }).nullable(),
  momentThemes: z.array(z.object({ theme: z.string(), themeCredit: z.number().nullable() })),
  /** The plan entry. A course given twice a year has one entry per round. */
  ppId: z.number(),
  momentGroupings: z.array(
    z.object({
      varId: z.number(),
      cl: z.string(),
      benamning: z.string(),
      req_Courses: z.number().nullable(),
      req_Cred: z.number().nullable(),
    }),
  ),
});
type Moment = z.infer<typeof momentSchema>;

const programmeSchema = z.object({
  search: z.object({
    results: z.array(
      z.object({
        programCode: z.string(),
        yearClasses: z.array(z.object({ grade: z.number().int().positive(), courseMoments: z.array(momentSchema) })),
      }),
    ),
  }),
});

const syllabusSchema = z.object({
  search: z.object({
    results: z.array(
      z.object({
        degreeWithDegreeRequirements: z.array(z.object({ reqCode: z.string(), reqCredit: z.number().nullable() })).nullable(),
        /** Lists of courses of which the degree needs one. Rows with the same id are one list. */
        degreeWithDegreeSpecRequirements: z.array(z.object({ degreeSpecId: z.number(), courseCode: z.string() })).nullable(),
        /** Master's programmes whose degree the programme's students can finish with. */
        accreditations: z.object({ forMastersProgramme: z.array(z.object({ masterCode: z.string() })) }).nullable(),
      }),
    ),
  }),
});
type Syllabus = z.infer<typeof syllabusSchema>["search"]["results"][number];

const courseSchema = z.object({
  search: z.object({
    results: z.array(
      z.object({
        courseCode: z.string(),
        courseRounds: z.array(
          z.object({
            cancelled: z.number(),
            blockSchedule: z.string().nullable(),
            moments: z.array(z.object({ distribution: z.array(z.object({ code: z.string(), credit: z.number().nullable() })) })),
            examiners: z.array(z.object({ fName: z.string(), lName: z.string() })),
          }),
        ),
      }),
    ),
  }),
});

async function get<T>(endpoint: string, variables: object, schema: z.ZodType<T>): Promise<T> {
  const url = `${env.API_URL}/${endpoint}/?variables=${encodeURIComponent(JSON.stringify(variables))}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return schema.parse(await response.json());
    } catch (error) {
      if (attempt >= RETRIES) throw new Error(`GET ${url} failed`, { cause: error });
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
}

const trackOf = (moment: Moment) => moment.momentSpecialisation?.concName?.trim() || null;

function toChoices(moments: readonly Moment[]): PlanChoice[] {
  const groupings = new Map(moments.flatMap((m) => m.momentGroupings.map((g) => [g.varId, g] as const)));
  return [...groupings.values()]
    .map((g) => ({
      id: g.varId,
      kind: CHOICE_KINDS[g.cl] ?? "other",
      // Some descriptions carry inline HTML such as <i>, and some run a number into the next word.
      text:
        g.benamning
          .replace(/<[^>]*>/g, "")
          .replace(/(\d)(?=[a-z])/g, "$1 ")
          .replace(/\s+/g, " ")
          .replace(/^[\s-]*$/, "")
          .trim() || null,
      minCourses: g.req_Courses || null,
      minCredits: g.req_Cred || null,
    }))
    .toSorted((a, b) => a.id - b.id);
}

/** One course per plan entry. A plan lists each module of a course as its own row, once per study period it has credits in. */
function toCourses(moments: readonly Moment[]): Omit<PlanCourse, "examiners">[] {
  const groups = Map.groupBy(
    moments.filter((m) => !m.cancelled),
    (m) => m.ppId,
  );
  return [...groups.values()].map((group) => {
    const first = group[0]!;
    const rows = [...new Map(group.map((m) => [`${m.moduleCode}|${m.studyPerodId}`, m])).values()];
    const byPeriod = Map.groupBy(
      rows.filter((m) => m.momentCredit),
      (m) => periodOf(m.studyPerodId),
    );
    const periods = STUDY_PERIODS.filter((p) => byPeriod.has(p));
    const periodCredits = periods.map((p) => tenths((byPeriod.get(p) ?? []).reduce((sum, m) => sum + (m.momentCredit ?? 0), 0)));
    const blocks = new Set(group.flatMap((m) => m.blockSchedule?.trim() || []));
    const themes = new Map(
      group.flatMap((m) =>
        m.momentThemes.flatMap((t) => (THEME_NAMES[t.theme] && t.themeCredit ? [[THEME_NAMES[t.theme]!, t.themeCredit] as const] : [])),
      ),
    );
    return {
      code: first.courseCode,
      name: first.courseName.trim(),
      credits: tenths(periodCredits.reduce((sum, credits) => sum + credits, 0)),
      periods,
      periodCredits,
      rule: first.rule,
      track: trackOf(first),
      block: [...blocks].join(", ") || null,
      choices: [...new Set(group.flatMap((m) => m.momentGroupings.map((g) => g.varId)))].toSorted((a, b) => a - b),
      themes: [...themes].map(([theme, credits]) => ({ theme, credits })).toSorted((a, b) => a.theme.localeCompare(b.theme)),
    };
  });
}

/** A programme can lead to several degrees that ask the same. Each theme keeps its largest demand, and each list of courses shows once. */
function toRequirements(syllabus: Syllabus): PlanRequirement[] {
  const themeCredits = Map.groupBy(
    (syllabus.degreeWithDegreeRequirements ?? []).filter((r) => THEME_REQUIREMENTS[r.reqCode] && r.reqCredit),
    (r) => THEME_REQUIREMENTS[r.reqCode]!,
  );
  const lists = Map.groupBy(syllabus.degreeWithDegreeSpecRequirements ?? [], (r) => r.degreeSpecId);
  const courseLists = new Set([...lists.values()].map((rows) => [...new Set(rows.map((r) => r.courseCode))].toSorted().join()));
  return [
    ...[...themeCredits]
      .map(([theme, rows]) => ({ kind: "theme" as const, theme, minCredits: Math.max(...rows.map((r) => r.reqCredit ?? 0)) }))
      .toSorted((a, b) => a.theme.localeCompare(b.theme)),
    ...[...courseLists].toSorted().map((codes) => ({ kind: "courses" as const, courses: codes.split(","), minCourses: 1 })),
  ];
}

/**
 * The degree requirements of a programme, and the master's programmes it leads on to, from its syllabus for this
 * academic year or the newest one before it. Empty when it has none.
 */
async function syllabusOf(code: string): Promise<Pick<ProgrammePlan, "requirements" | "masters">> {
  const [start = 0] = env.ACADEMIC_YEAR.split("/").map(Number);
  for (let year = start; year >= start - SYLLABUS_YEARS_BACK; year--) {
    const { search } = await get("Syllabuses", { language: "en", acYear: `${year}/${year + 1}`, pCode: code }, syllabusSchema);
    const [syllabus] = search.results;
    if (!syllabus) continue;
    const masters = (syllabus.accreditations?.forMastersProgramme ?? []).map((m) => m.masterCode);
    return { requirements: toRequirements(syllabus), masters: [...new Set(masters)].toSorted() };
  }
  return { requirements: [], masters: [] };
}

/** The rounds of a course this academic year, from its syllabus. Empty when it has none. */
async function roundsOf(code: string): Promise<CourseRound[]> {
  const filter = { acYear: { _eq: env.ACADEMIC_YEAR }, courseCode: { _eq: code } };
  const { search } = await get("PewCourses", { language: "en", filter }, courseSchema);
  const course = search.results.find((c) => c.courseCode === code);
  return (course?.courseRounds ?? [])
    .filter((r) => !r.cancelled)
    .map((round) => {
      const periods = new Set(round.moments.flatMap((m) => m.distribution.filter((d) => d.credit).map((d) => periodOf(d.code))));
      return {
        periods: STUDY_PERIODS.filter((p) => periods.has(p)),
        block: round.blockSchedule?.trim() || null,
        examiners: round.examiners.map((e) => `${e.fName} ${e.lName}`.trim()),
      };
    });
}

async function main() {
  const { results } = await get(
    "list",
    { size: LIST_SIZE, language: "en", indexes: ["PewStudyprogrammes"], filter: { acYear: { _eq: env.ACADEMIC_YEAR } } },
    listSchema,
  );
  const listed = results.filter((p) => p.acYear === env.ACADEMIC_YEAR).toSorted((a, b) => a.programCode.localeCompare(b.programCode));
  if (listed.length < MIN_PROGRAMMES) throw new Error(`Only ${listed.length} programmes for ${env.ACADEMIC_YEAR}`);
  console.log(`Fetching ${listed.length} programme plans for ${env.ACADEMIC_YEAR}`);

  const ruleNames = new Map<string, string>();
  const programmes = await mapConcurrent(listed, env.CONCURRENCY, async ({ programCode, name }) => {
    const filter = { acYear: { _eq: env.ACADEMIC_YEAR }, programCode: { _eq: programCode } };
    const [{ search }, syllabus] = await Promise.all([
      get("PewStudyprogrammes", { language: "en", filter }, programmeSchema),
      syllabusOf(programCode),
    ]);
    const plan = search.results.find((r) => r.programCode === programCode);
    if (!plan) throw new Error(`No plan for ${programCode}`);
    for (const moment of plan.yearClasses.flatMap((y) => y.courseMoments)) ruleNames.set(moment.rule, moment.ruleName.trim());
    const years = Map.groupBy(plan.yearClasses, (y) => y.grade);
    return {
      code: programCode,
      name: name.trim(),
      choices: toChoices(plan.yearClasses.flatMap((y) => y.courseMoments)),
      ...syllabus,
      years: [...years]
        .map(([year, classes]) => ({ year, courses: toCourses(classes.flatMap((c) => c.courseMoments)) }))
        .filter((y) => y.courses.length)
        .toSorted((a, b) => a.year - b.year),
    };
  });

  const codes = [...new Set(programmes.flatMap((p) => p.years.flatMap((y) => y.courses.map((c) => c.code))))].toSorted();
  console.log(`Fetching ${codes.length} course syllabi for their examiners`);
  let failed = 0;
  const rounds = new Map(
    await mapConcurrent(codes, env.CONCURRENCY, async (code): Promise<[string, CourseRound[]]> => {
      try {
        return [code, await roundsOf(code)];
      } catch (error) {
        failed++;
        console.warn(`${code}: ${error instanceof Error ? error.message : String(error)}`);
        return [code, []];
      }
    }),
  );
  if (failed > codes.length * MAX_FAILED_SHARE) throw new Error(`${failed} of ${codes.length} syllabi failed`);

  const planned = programmes.filter((p) => p.years.length);
  const codesPlanned = new Set(planned.map((p) => p.code));
  const file: ProgrammePlansFile = {
    academicYear: env.ACADEMIC_YEAR,
    ruleNames: Object.fromEntries([...ruleNames].toSorted(([a], [b]) => a.localeCompare(b))),
    programmes: planned.map((programme) => ({
      ...programme,
      // A master's programme without a plan this year has no courses to plan.
      masters: programme.masters.filter((code) => codesPlanned.has(code)),
      years: programme.years.map(({ year, courses }) => ({
        year,
        courses: courses.map((course) => ({
          ...course,
          examiners: [...(roundOf(course, rounds.get(course.code) ?? [])?.examiners ?? [])],
        })),
      })),
    })),
  };
  await mkdir(path.dirname(env.OUT_FILE), { recursive: true });
  const { programmes: lines, ...head } = file;
  await writeFile(env.OUT_FILE, toJsonLines(head, "programmes", lines));
  console.log(`Wrote ${file.programmes.length} programme plans to ${env.OUT_FILE}`);
}

await main();
