/**
 * Builds the static data the app reads, `public/data/index.json`, one `public/data/plans/<start year>.json` per year
 * that programmes admitted students in, and one per year of upcoming master's programmes, and one
 * `public/data/courses/<code>.json` per course, from the committed files in `data/`. It reads no network, so builds never depend on the sources being up.
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { evaluationFileSchema } from "../src/domain/evaluation.ts";
import { namesFileSchema } from "../src/domain/names.ts";
import { programmePlansFileSchema } from "../src/domain/programme-plans.ts";
import { resultsFileSchema } from "../src/domain/course-stats.ts";
import { upcomingMastersFileSchema } from "../src/domain/upcoming-masters.ts";
import { buildSnapshot } from "./build-snapshot.ts";
import { mapConcurrent } from "./map-concurrent.ts";

const parseEnv = () =>
  z
    .object({
      OUT_DIR: z.string().default("public/data"),
      RESULTS_FILE: z.string().default("data/results.json"),
      EVALUATIONS_FILE: z.string().default("data/evaluations.json"),
      PLANS_FILE: z.string().default("data/programme-plans.json"),
      NAMES_FILE: z.string().default("data/names.json"),
      UPCOMING_MASTERS_FILE: z.string().default("data/upcoming-masters.json"),
    })
    .parse(process.env);

const DECIMALS = 1e2;

/** The list shows rates in whole percent, so two decimals are enough. */
const roundNumbers = (_key: string, value: unknown) =>
  typeof value === "number" && !Number.isInteger(value) ? Math.round(value * DECIMALS) / DECIMALS : value;

/** Files written at a time. */
const WRITE_CONCURRENCY = 64;

const readJson = async <T>(file: string, schema: z.ZodType<T>) => schema.parse(JSON.parse(await readFile(file, "utf8")));

/** Like `readJson`, but a file that does not exist gives null. Any other error still throws. */
async function readOptionalJson<T>(file: string, schema: z.ZodType<T>) {
  try {
    return await readJson(file, schema);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function main() {
  const env = parseEnv();
  const [results, evaluations, plans, names, upcoming] = await Promise.all([
    readJson(env.RESULTS_FILE, resultsFileSchema),
    readJson(env.EVALUATIONS_FILE, evaluationFileSchema),
    readJson(env.PLANS_FILE, programmePlansFileSchema),
    readJson(env.NAMES_FILE, namesFileSchema),
    readOptionalJson(env.UPCOMING_MASTERS_FILE, upcomingMastersFileSchema),
  ]);
  const { index, courses, plans: publishedPlans } = buildSnapshot({ results, evaluations, plans, names, upcoming }, new Date());

  // Write beside the output and swap it in last, so a crash leaves the old data in place.
  const tmpDir = `${env.OUT_DIR}.tmp`;
  const coursesDir = path.join(tmpDir, "courses");
  const plansDir = path.join(tmpDir, "plans");
  await rm(tmpDir, { recursive: true, force: true });
  await Promise.all([mkdir(coursesDir, { recursive: true }), mkdir(plansDir, { recursive: true })]);
  const files = [
    [path.join(tmpDir, "index.json"), JSON.stringify(index, roundNumbers)],
    ...courses.map((course) => [path.join(coursesDir, `${course.code}.json`), JSON.stringify(course)] as const),
    ...[...publishedPlans].map(([start, cohort]) => [path.join(plansDir, `${start}.json`), JSON.stringify(cohort)] as const),
  ];
  await mapConcurrent(files, WRITE_CONCURRENCY, ([file, content]) => writeFile(file, content));
  await rm(env.OUT_DIR, { recursive: true, force: true });
  await rename(tmpDir, env.OUT_DIR);
  console.log(`Wrote ${courses.length} courses and ${Object.keys(index.programmes).length} programmes to ${env.OUT_DIR}`);
}

if (import.meta.main) await main();
