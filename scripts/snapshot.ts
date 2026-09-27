/**
 * Crawls the public stats.ftek.se API and writes the static data the app reads:
 * `public/data/index.json` and one `public/data/courses/<code>.json` per course.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { orderParts, summarizeCourse } from "../src/domain/course-stats.ts";
import { GRADES, attemptsOf, gradeCountsSchema } from "../src/domain/grades.ts";
import type { CourseDetail, Part, Snapshot } from "../src/domain/snapshot.ts";

const env = z
  .object({
    API_URL: z.url().default("https://stats.ftek.se"),
    OUT_DIR: z.string().default("public/data"),
    CONCURRENCY: z.coerce.number().int().positive().default(10),
  })
  .parse(process.env);

const PAGE_SIZE = 1000;
const RETRIES = 3;
const NO_PROGRAMME = "-";
const DECIMALS = 1e4;

/** Rates need four decimals at most. */
const roundNumbers = (_key: string, value: unknown) =>
  typeof value === "number" && !Number.isInteger(value) ? Math.round(value * DECIMALS) / DECIMALS : value;

const upstreamCourseSchema = z.object({
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
const upstreamResultsSchema = z.array(upstreamResultSchema);

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
async function listCourses() {
  const courses: z.infer<typeof upstreamCourseSchema>[] = [];
  for (let page = 0; ; page++) {
    const { courses: batch } = await fetchJson(
      `${env.API_URL}/courses?sort=courseCode_asc&items=${PAGE_SIZE}&page=${page}`,
      upstreamPageSchema,
    );
    courses.push(...batch);
    if (batch.length < PAGE_SIZE) return courses;
  }
}

async function mapConcurrent<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

function toParts(results: z.infer<typeof upstreamResultsSchema>): Part[] {
  const groups = Map.groupBy(
    results.filter((r) => attemptsOf(r) > 0),
    (r) => `${r.type}\u0000${r.resultId}`,
  );
  const parts = [...groups.values()].map((group) => ({
    type: group[0]!.type,
    code: group[0]!.resultId,
    sittings: group
      .map((r) => ({ date: r.date, grades: Object.fromEntries(GRADES.map((g) => [g, r[g]])) as Part["sittings"][number]["grades"] }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  }));
  return orderParts(parts);
}

/** "INFORMATIONSTEKNIK, CIVILINGENJÖR" becomes "Informationsteknik, civilingenjör". */
const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

async function main() {
  const today = new Date();
  const upstream = await listCourses();
  console.log(`Fetched ${upstream.length} courses`);

  const coursesDir = path.join(env.OUT_DIR, "courses");
  await rm(env.OUT_DIR, { recursive: true, force: true });
  await mkdir(coursesDir, { recursive: true });

  const summaries = await mapConcurrent(upstream, env.CONCURRENCY, async (course) => {
    const results = await fetchJson(`${env.API_URL}/results/${encodeURIComponent(course.courseCode)}`, upstreamResultsSchema);
    const parts = toParts(results);
    const detail: CourseDetail = { code: course.courseCode, parts };
    await writeFile(path.join(coursesDir, `${course.courseCode}.json`), JSON.stringify(detail));
    const programme = course.programShort === NO_PROGRAMME ? null : course.programShort;
    return summarizeCourse({ code: course.courseCode, name: course.courseName, programme }, parts, today);
  });

  const programmes = Object.fromEntries(
    upstream
      .filter((c) => c.programShort !== NO_PROGRAMME)
      .map((c) => [c.programShort, c.programLong?.trim() ? sentenceCase(c.programLong.trim()) : c.programShort]),
  );
  const snapshot: Snapshot = { generatedAt: today.toISOString(), programmes, courses: summaries };
  await writeFile(path.join(env.OUT_DIR, "index.json"), JSON.stringify(snapshot, roundNumbers));
  console.log(`Wrote ${summaries.length} courses and ${Object.keys(programmes).length} programmes to ${env.OUT_DIR}`);
}

await main();
