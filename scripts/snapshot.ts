/**
 * Builds the static data the app reads, `public/data/index.json` and one `public/data/courses/<code>.json` per
 * course, from the committed files in `data/`. It reads no network, so builds never depend on the sources being up.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { summarizeCourse } from "../src/domain/course-stats.ts";
import { compareRounds, evaluationFileSchema, summarizeEvaluations, type EvaluationRound } from "../src/domain/evaluation.ts";
import { resultsFileSchema, type CourseDetail, type Snapshot } from "../src/domain/snapshot.ts";

const env = z
  .object({
    OUT_DIR: z.string().default("public/data"),
    RESULTS_FILE: z.string().default("data/results.json"),
    EVALUATIONS_FILE: z.string().default("data/evaluations.json"),
  })
  .parse(process.env);

const DECIMALS = 1e4;

/** Rates need four decimals at most. */
const roundNumbers = (_key: string, value: unknown) =>
  typeof value === "number" && !Number.isInteger(value) ? Math.round(value * DECIMALS) / DECIMALS : value;

const readJson = async <T>(file: string, schema: z.ZodType<T>) => schema.parse(JSON.parse(await readFile(file, "utf8")));

async function main() {
  const today = new Date();
  const [results, evaluations] = await Promise.all([
    readJson(env.RESULTS_FILE, resultsFileSchema),
    readJson(env.EVALUATIONS_FILE, evaluationFileSchema),
  ]);
  const roundsByCode = Map.groupBy(evaluations.rounds, (r) => r.code);
  /** Survey rounds of a course, newest first. */
  const roundsOf = (code: string): EvaluationRound[] =>
    (roundsByCode.get(code) ?? []).map(({ code: _, ...round }) => round).toSorted(compareRounds);

  const coursesDir = path.join(env.OUT_DIR, "courses");
  await rm(env.OUT_DIR, { recursive: true, force: true });
  await mkdir(coursesDir, { recursive: true });

  const courses: Snapshot["courses"] = [];
  for (const { parts, ...course } of results.courses) {
    const rounds = roundsOf(course.code);
    const detail: CourseDetail = { code: course.code, parts, evaluations: rounds };
    await writeFile(path.join(coursesDir, `${course.code}.json`), JSON.stringify(detail));
    courses.push({ ...summarizeCourse(course, parts, today), evaluation: summarizeEvaluations(rounds) });
  }

  const snapshot: Snapshot = {
    generatedAt: today.toISOString(),
    evaluationsFetchedAt: evaluations.fetchedAt,
    programmes: results.programmes,
    courses,
  };
  await writeFile(path.join(env.OUT_DIR, "index.json"), JSON.stringify(snapshot, roundNumbers));
  console.log(`Wrote ${courses.length} courses and ${Object.keys(results.programmes).length} programmes to ${env.OUT_DIR}`);
}

await main();
