import { summarizeCourse, type ResultsFile } from "../src/domain/course-stats.ts";
import {
  compareRounds,
  ratedRounds,
  ratingTrend,
  surveyAnswersOf,
  type EvaluationFile,
  type EvaluationRound,
} from "../src/domain/evaluation.ts";
import { nameOf, type NamesFile } from "../src/domain/names.ts";
import {
  cohortPlans,
  courseThisYear,
  placementsByCourse,
  startYearOf,
  type ProgrammePlan,
  type ProgrammePlansFile,
  type PublishedPlan,
} from "../src/domain/programme-plans.ts";
import type { CourseDetail, Snapshot } from "../src/domain/snapshot.ts";
import { upcomingMasters, type UpcomingMastersFile } from "../src/domain/upcoming-masters.ts";

/** The parsed files of `data/`. `upcoming` is null when there is no file of upcoming master's programmes. */
export interface SnapshotInputs {
  results: ResultsFile;
  evaluations: EvaluationFile;
  plans: ProgrammePlansFile;
  names: NamesFile;
  upcoming: UpcomingMastersFile | null;
}

export interface BuiltSnapshot {
  index: Snapshot;
  courses: CourseDetail[];
  /** Published plans by the year of the cohort that follows them, with the upcoming master's programmes under their start year. */
  plans: Map<number, PublishedPlan[]>;
}

/** Joins the files of `data/` into what the app reads. Reads no clock and does no I/O. */
export function buildSnapshot({ results, evaluations, plans, names, upcoming: upcomingFile }: SnapshotInputs, today: Date): BuiltSnapshot {
  const courseNames = new Map(names.courses.map(({ code, ...n }) => [code, n]));
  // A programme can have results under a code Chalmers no longer names, or a plan but no results yet.
  const programmeCodes = new Set([...Object.keys(results.programmes), ...Object.keys(names.programmes)]);
  const { programmes: programmePlans, ...planInfo } = plans;
  const currentPlans = programmePlans.filter((p) => p.academicYear === planInfo.academicYear);
  const placements = placementsByCourse(currentPlans, planInfo.ruleNames);
  // The upcoming master's programmes retire once Chalmers publishes the plans of their year.
  const upcoming =
    upcomingFile && upcomingFile.academicYear > planInfo.academicYear ? upcomingMasters(upcomingFile, currentPlans, names.courses) : null;
  const starts = [...new Set(programmePlans.map((p) => startYearOf(p.academicYear)))].toSorted((a, b) => a - b);
  const roundsByCode = Map.groupBy(evaluations.rounds, (r) => r.code);
  const latestSurveyYear = Math.max(...evaluations.rounds.map((r) => r.academicYear));
  /** Survey rounds of a course, newest first. */
  const roundsOf = (code: string): EvaluationRound[] =>
    (roundsByCode.get(code) ?? []).map(({ code: _, ...round }) => round).toSorted(compareRounds);

  const courses: Snapshot["courses"] = [];
  const details: CourseDetail[] = [];
  for (const { parts, name, ...course } of results.courses) {
    const allRounds = roundsOf(course.code);
    const rounds = ratedRounds(allRounds, latestSurveyYear);
    const coursePlacements = placements.get(course.code) ?? [];
    details.push({
      code: course.code,
      parts,
      evaluations: rounds,
      placements: coursePlacements,
      hasSyllabus: courseNames.has(course.code),
    });
    courses.push({
      ...summarizeCourse({ ...course, ...nameOf(courseNames.get(course.code), name) }, parts, today),
      surveyAnswers: surveyAnswersOf(rounds),
      trend: ratingTrend(allRounds),
      ...courseThisYear(coursePlacements),
    });
  }

  const index: Snapshot = {
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
  // Older plans name courses and programmes as they were named then, often in capitals.
  const publish = (plan: ProgrammePlan): PublishedPlan => ({
    ...plan,
    ...nameOf(names.programmes[plan.code], plan.name),
    years: plan.years.map((year) => ({
      ...year,
      courses: year.courses.map((course) => ({ ...course, ...nameOf(courseNames.get(course.code), course.name) })),
    })),
  });
  const published = new Map(starts.map((start) => [start, cohortPlans(programmePlans, start).map(publish)]));
  if (upcoming) published.set(startYearOf(upcoming.info.academicYear), upcoming.plans.map(publish));
  return { index, courses: details, plans: published };
}
