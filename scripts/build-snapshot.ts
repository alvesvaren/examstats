import { hasEnded, summarizeCourse, type ResultsFile } from "../src/domain/course-stats.ts";
import { guideCourses, type EligibilityFile, type PublishedEligibility } from "../src/domain/eligibility.ts";
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
  isThesis,
  placementsByCourse,
  startYearOf,
  type ProgrammePlan,
  type ProgrammePlansFile,
  type PublishedPlan,
} from "../src/domain/programme-plans.ts";
import type { CourseDetail, NewCourse, Snapshot } from "../src/domain/snapshot.ts";
import { upcomingMasters, type UpcomingMastersFile } from "../src/domain/upcoming-masters.ts";

/** The parsed files of `data/`. `upcoming` is null when there is no file of upcoming master's programmes. */
export interface SnapshotInputs {
  results: ResultsFile;
  evaluations: EvaluationFile;
  plans: ProgrammePlansFile;
  names: NamesFile;
  upcoming: UpcomingMastersFile | null;
  eligibility: EligibilityFile;
}

export interface BuiltSnapshot {
  index: Snapshot;
  courses: CourseDetail[];
  /** Published plans by the year of the cohort that follows them, with the upcoming master's programmes under their start year. */
  plans: Map<number, PublishedPlan[]>;
  eligibility: PublishedEligibility;
}

/** Joins the files of `data/` into what the app reads. Reads no clock and does no I/O. */
export function buildSnapshot(
  { results, evaluations, plans, names, upcoming: upcomingFile, eligibility }: SnapshotInputs,
  today: Date,
): BuiltSnapshot {
  const courseNames = new Map(names.courses.map(({ code, ...n }) => [code, n]));
  // A programme can have results under a code Chalmers no longer names, or a plan but no results yet.
  const programmeCodes = new Set([...Object.keys(results.programmes), ...Object.keys(names.programmes)]);
  const { programmes: programmePlans, ...planInfo } = plans;
  const currentPlans = programmePlans.filter((p) => p.academicYear === planInfo.academicYear);
  const placements = placementsByCourse(currentPlans, planInfo.ruleNames);
  // The snapshot drops the upcoming master's programmes once Chalmers publishes the plans of their year.
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
    const listed = courseNames.get(course.code);
    details.push({
      code: course.code,
      parts,
      evaluations: rounds,
      placements: coursePlacements,
      hasSyllabus: listed !== undefined,
    });
    const summary = summarizeCourse({ ...course, ...nameOf(listed, name) }, parts, today);
    // A course that chalmers.se has not listed since 2021/2022 does not count as discontinued, so its results decide.
    const discontinued = listed !== undefined && (listed.lastOffered === null || listed.lastOffered < planInfo.academicYear);
    courses.push({
      ...summary,
      ended: hasEnded(summary.lastResult, { planned: coursePlacements.length > 0, discontinued }, today),
      surveyAnswers: surveyAnswersOf(rounds),
      trend: ratingTrend(allRounds),
      ...courseThisYear(coursePlacements),
    });
  }

  const withResults = new Set(results.courses.map((c) => c.code));
  const plannedNames = new Map(currentPlans.flatMap((p) => p.years.flatMap((y) => y.courses.map((c) => [c.code, c.name] as const))));
  const plannedNew: NewCourse[] = [...placements]
    .filter(([code]) => !withResults.has(code))
    .map(([code, coursePlacements]) => ({
      code,
      ...nameOf(courseNames.get(code), plannedNames.get(code) ?? code),
      ...courseThisYear(coursePlacements),
      masters: [],
    }));
  // A course that only a course list names has a code made from its name, so every master's programme that lists it
  // gets the same code. Every master's programme lists a thesis, so a thesis that only a list names is left out.
  const listedNew: NewCourse[] = [
    ...Map.groupBy(
      (upcoming?.plans ?? []).flatMap((plan) =>
        plan.years.flatMap((year) =>
          year.courses.filter((c) => c.pending && !isThesis(c)).map((course) => ({ master: plan.code, course })),
        ),
      ),
      (entry) => entry.course.code,
    ).values(),
  ].map((entries) => ({
    code: null,
    ...nameOf(undefined, entries[0]!.course.name),
    periods: [],
    examiners: [],
    masters: [...new Set(entries.map((e) => e.master))],
  }));

  const index: Snapshot = {
    generatedAt: today.toISOString(),
    evaluationsFetchedAt: evaluations.fetchedAt,
    plans: {
      ...planInfo,
      starts: Object.fromEntries(
        [...Map.groupBy(programmePlans, (p) => p.code)].map(([code, dated]) => [
          code,
          // A programme that stops admitting students keeps plans for its later years until its last students finish.
          dated
            .filter((p) => p.years.some(({ year }) => year === 1))
            .map((p) => startYearOf(p.academicYear))
            .toSorted((a, b) => a - b),
        ]),
      ),
      upcomingMasters: upcoming?.info ?? null,
    },
    programmes: Object.fromEntries(
      [...programmeCodes].toSorted().map((code) => [code, nameOf(names.programmes[code], results.programmes[code] ?? code)]),
    ),
    courses,
    newCourses: [...plannedNew, ...listedNew],
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
  const guideNames = guideCourses(eligibility.masters).flatMap(({ codes }) =>
    codes.flatMap((code) => {
      const named = courseNames.get(code);
      return named ? [[code, nameOf(named, code)] as const] : [];
    }),
  );
  return { index, courses: details, plans: published, eligibility: { ...eligibility, names: Object.fromEntries(guideNames) } };
}
