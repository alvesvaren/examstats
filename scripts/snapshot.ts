/**
 * Builds the static data the app reads, `public/data/index.json`, one `public/data/plans/<start year>.json` per year
 * that programmes admitted students in, and one per year of upcoming master's programmes, and one
 * `public/data/courses/<code>.json` per course, from the committed files in `data/`. It reads no network, so builds never depend on the sources being up.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { summarizeCourse } from "../src/domain/course-stats.ts";
import { nameOf, namesFileSchema } from "../src/domain/names.ts";
import { compareRounds, evaluationFileSchema, summarizeEvaluations, type EvaluationRound } from "../src/domain/evaluation.ts";
import { resultsFileSchema, type CourseDetail, type Snapshot } from "../src/domain/snapshot.ts";
import {
  cohortPlans,
  placementsByCourse,
  programmePlansFileSchema,
  startYearOf,
  type ProgrammePlan,
  type PublishedPlan,
} from "../src/domain/programme-plans.ts";
import { upcomingMasters, upcomingMastersFileSchema } from "../src/domain/upcoming-masters.ts";

const env = z
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

const readJson = async <T>(file: string, schema: z.ZodType<T>) => schema.parse(JSON.parse(await readFile(file, "utf8")));

async function main() {
  const today = new Date();
  const [results, evaluations, plans, names, upcomingFile] = await Promise.all([
    readJson(env.RESULTS_FILE, resultsFileSchema),
    readJson(env.EVALUATIONS_FILE, evaluationFileSchema),
    readJson(env.PLANS_FILE, programmePlansFileSchema),
    readJson(env.NAMES_FILE, namesFileSchema),
    readJson(env.UPCOMING_MASTERS_FILE, upcomingMastersFileSchema),
  ]);
  const courseNames = new Map(names.courses.map(({ code, ...n }) => [code, n]));
  // A programme can have results under a code Chalmers no longer names, or a plan but no results yet.
  const programmeCodes = new Set([...Object.keys(results.programmes), ...Object.keys(names.programmes)]);
  const { programmes: programmePlans, ...planInfo } = plans;
  const currentPlans = programmePlans.filter((p) => p.academicYear === planInfo.academicYear);
  const placements = placementsByCourse(currentPlans, planInfo.ruleNames);
  // The upcoming master's programmes retire once Chalmers publishes the plans of their year.
  const upcoming = upcomingFile.academicYear > planInfo.academicYear ? upcomingMasters(upcomingFile, currentPlans, names.courses) : null;
  const starts = [...new Set(programmePlans.map((p) => startYearOf(p.academicYear)))].toSorted((a, b) => a - b);
  const roundsByCode = Map.groupBy(evaluations.rounds, (r) => r.code);
  /** Survey rounds of a course, newest first. */
  const roundsOf = (code: string): EvaluationRound[] =>
    (roundsByCode.get(code) ?? []).map(({ code: _, ...round }) => round).toSorted(compareRounds);

  const coursesDir = path.join(env.OUT_DIR, "courses");
  const plansDir = path.join(env.OUT_DIR, "plans");
  await rm(env.OUT_DIR, { recursive: true, force: true });
  await Promise.all([mkdir(coursesDir, { recursive: true }), mkdir(plansDir, { recursive: true })]);

  const courses: Snapshot["courses"] = [];
  for (const { parts, name, ...course } of results.courses) {
    const rounds = roundsOf(course.code);
    const detail: CourseDetail = {
      code: course.code,
      parts,
      evaluations: rounds,
      placements: placements.get(course.code) ?? [],
    };
    await writeFile(path.join(coursesDir, `${course.code}.json`), JSON.stringify(detail));
    courses.push({
      ...summarizeCourse({ ...course, ...nameOf(courseNames.get(course.code), name) }, parts, today),
      overallAnswers: summarizeEvaluations(rounds)?.overallAnswers ?? null,
    });
  }

  const snapshot: Snapshot = {
    generatedAt: today.toISOString(),
    evaluationsFetchedAt: evaluations.fetchedAt,
    plans: {
      ...planInfo,
      starts: Object.fromEntries(
        [...Map.groupBy(programmePlans, (p) => p.code)].map(([code, dated]) => [
          code,
          dated.map((p) => startYearOf(p.academicYear)).toSorted((a, b) => a - b),
        ]),
      ),
      upcomingMasters: upcoming?.info ?? null,
    },
    programmes: Object.fromEntries(
      [...programmeCodes].toSorted().map((code) => [code, nameOf(names.programmes[code], results.programmes[code] ?? code)]),
    ),
    courses,
  };
  await writeFile(path.join(env.OUT_DIR, "index.json"), JSON.stringify(snapshot, roundNumbers));
  // Older plans name courses and programmes as they were named then, often in capitals.
  const publish = (plan: ProgrammePlan): PublishedPlan => ({
    ...plan,
    ...nameOf(names.programmes[plan.code], plan.name),
    years: plan.years.map((year) => ({
      ...year,
      courses: year.courses.map((course) => ({ ...course, ...nameOf(courseNames.get(course.code), course.name) })),
    })),
  });
  for (const start of starts) {
    await writeFile(path.join(plansDir, `${start}.json`), JSON.stringify(cohortPlans(programmePlans, start).map(publish)));
  }
  if (upcoming) {
    const start = startYearOf(upcoming.info.academicYear);
    await writeFile(path.join(plansDir, `${start}.json`), JSON.stringify(upcoming.plans.map(publish)));
  }
  console.log(`Wrote ${courses.length} courses and ${Object.keys(snapshot.programmes).length} programmes to ${env.OUT_DIR}`);
}

await main();
