/**
 * Fetches the syllabus of every course in a Chalmers master's programme plan from the JSON API behind chalmers.se, and
 * writes `data/syllabi.json`: each course's name, level and prerequisites as plain text. It also fetches every course
 * those prerequisites name by code, and the courses theirs name, so chains of prerequisites end in the file. The file
 * also lists the code and name of every master's programme and every course given this academic year, to find the ones
 * that a text names by name.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { courseCodesIn, type SyllabiFile, type Syllabus } from "../src/domain/prerequisites.ts";
import { toJsonLines } from "./json-lines.ts";
import { toPlainText } from "./plain-text.ts";
import { mapConcurrent } from "./map-concurrent.ts";

/** Plans and syllabi for the next academic year replace the current ones in July. */
const ACADEMIC_YEAR_START_MONTH = 7;

function currentAcademicYear(today: Date) {
  const year = today.getFullYear() - (today.getMonth() + 1 < ACADEMIC_YEAR_START_MONTH ? 1 : 0);
  return `${year}/${year + 1}`;
}

const env = z
  .object({
    API_URL: z.url().default("https://www.chalmers.se/api"),
    OUT_FILE: z.string().default("data/syllabi.json"),
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
/** Codes of master's programmes start with this. */
const MASTERS_PREFIX = "MP";
/** Fewer master's programmes than this means the API answered with something other than the full list. */
const MIN_MASTERS = 30;

const listSchema = z.object({
  results: z.array(z.object({ programCode: z.string(), name: z.string(), acYear: z.string() })),
});

const courseListSchema = z.object({
  info: z.object({ count: z.number() }),
  results: z.array(z.object({ courseCode: z.string(), name: z.string() })),
});

const programmeSchema = z.object({
  search: z.object({
    results: z.array(
      z.object({
        programCode: z.string(),
        yearClasses: z.array(z.object({ courseMoments: z.array(z.object({ courseCode: z.string(), cancelled: z.boolean() })) })),
      }),
    ),
  }),
});

const courseSchema = z.object({
  search: z.object({
    results: z.array(
      z.object({
        courseCode: z.string(),
        name: z.string(),
        eduLevelName: z.string().nullable(),
        creditNumeric: z.number().nullable(),
        replaces: z.array(z.object({ code: z.string() })).nullable(),
        prerequisites: z.string().nullable(),
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

async function syllabusOf(code: string): Promise<Omit<Syllabus, "programmes"> | null> {
  const filter = { acYear: { _eq: env.ACADEMIC_YEAR }, courseCode: { _eq: code } };
  const { search } = await get("PewCourses", { language: "en", filter }, courseSchema);
  const course = search.results.find((c) => c.courseCode === code);
  if (!course) return null;
  return {
    code,
    name: course.name.trim(),
    level: course.eduLevelName ?? "",
    credits: course.creditNumeric ?? 0,
    replaces: (course.replaces ?? []).map((r) => r.code),
    prerequisites: toPlainText(course.prerequisites ?? ""),
  };
}

/** Every course given this academic year, by code and name. The API lists at most `LIST_SIZE` per page. */
async function listCourses() {
  const courses: z.infer<typeof courseListSchema>["results"] = [];
  for (;;) {
    const variables = {
      size: LIST_SIZE,
      from: courses.length,
      language: "en",
      indexes: ["PewCourses"],
      filter: { acYear: { _eq: env.ACADEMIC_YEAR } },
    };
    const { info, results } = await get("list", variables, courseListSchema);
    courses.push(...results);
    if (!results.length || courses.length >= info.count) return courses;
  }
}

async function main() {
  const { results } = await get(
    "list",
    { size: LIST_SIZE, language: "en", indexes: ["PewStudyprogrammes"], filter: { acYear: { _eq: env.ACADEMIC_YEAR } } },
    listSchema,
  );
  const programmes = Object.fromEntries(
    results
      .filter((p) => p.acYear === env.ACADEMIC_YEAR && p.programCode.startsWith(MASTERS_PREFIX))
      .map((p) => [p.programCode, p.name.trim()] as const)
      .toSorted(([a], [b]) => a.localeCompare(b)),
  );
  const masters = Object.keys(programmes);
  if (masters.length < MIN_MASTERS) throw new Error(`Only ${masters.length} master's programmes for ${env.ACADEMIC_YEAR}`);
  console.log(`Fetching ${masters.length} master's programme plans for ${env.ACADEMIC_YEAR}`);

  const programmesOf = new Map<string, Set<string>>();
  await mapConcurrent(masters, env.CONCURRENCY, async (programCode) => {
    const filter = { acYear: { _eq: env.ACADEMIC_YEAR }, programCode: { _eq: programCode } };
    const { search } = await get("PewStudyprogrammes", { language: "en", filter }, programmeSchema);
    const plan = search.results.find((r) => r.programCode === programCode);
    if (!plan) throw new Error(`No plan for ${programCode}`);
    for (const { courseCode, cancelled } of plan.yearClasses.flatMap((y) => y.courseMoments)) {
      if (!cancelled) programmesOf.set(courseCode, (programmesOf.get(courseCode) ?? new Set()).add(programCode));
    }
  });

  const syllabi = new Map<string, Syllabus | null>();
  let pending = [...programmesOf.keys()];
  while (pending.length) {
    console.log(`Fetching ${pending.length} course syllabi`);
    const fetched = await mapConcurrent(pending, env.CONCURRENCY, syllabusOf);
    for (const [index, code] of pending.entries()) {
      const syllabus = fetched[index] ?? null;
      syllabi.set(code, syllabus && { ...syllabus, programmes: [...(programmesOf.get(code) ?? [])].toSorted() });
    }
    pending = [...new Set(fetched.flatMap((s) => (s ? courseCodesIn(s.prerequisites) : [])))].filter((code) => !syllabi.has(code));
  }

  const missing = [...syllabi].filter(([, s]) => !s).map(([code]) => code);
  if (missing.length) console.warn(`No syllabus for ${env.ACADEMIC_YEAR}: ${missing.join(", ")}`);

  const catalog = await listCourses();
  console.log(`Listed ${catalog.length} courses`);

  const file: SyllabiFile = {
    academicYear: env.ACADEMIC_YEAR,
    programmes,
    catalog: Object.fromEntries(catalog.map((c) => [c.courseCode, c.name.trim()]).toSorted(([a], [b]) => a!.localeCompare(b!))),
    courses: [...syllabi.values()].filter((s) => s !== null).toSorted((a, b) => a.code.localeCompare(b.code)),
  };
  await mkdir(path.dirname(env.OUT_FILE), { recursive: true });
  const { courses, ...head } = file;
  await writeFile(env.OUT_FILE, toJsonLines(head, "courses", courses));
  console.log(`Wrote ${courses.length} syllabi to ${env.OUT_FILE}`);
}

await main();
