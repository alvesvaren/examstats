import { compareSortValues, defaultSortDir, sortValueOf, surveyColumn, type CatalogCourse, type SortDir } from "./catalog.ts";
import { amountTowards, openRequirements, pickProgress, requirementProgress, tenths } from "./degree.ts";
import { OTHER_QUESTIONS, type OtherQuestion } from "./evaluation.ts";
import { normalize, type InLanguage } from "./names.ts";
import {
  isElective,
  plannedCourses,
  planYear,
  STUDY_PERIODS,
  tracksOf,
  type PlanRequirement,
  type PlanRound,
  type ProgrammePlan,
  type StudyPeriod,
  type StudyPick,
  type StudyYear,
  type UpcomingMasters,
} from "./programme-plans.ts";

export const PLANNER_SORT_KEYS = ["rating", "passRate", ...OTHER_QUESTIONS] as const;
export type PlannerSortKey = (typeof PLANNER_SORT_KEYS)[number];

/** Credits of full-time study in one study period. */
export const PERIOD_CREDITS = 15;

/** A round in the planner with its course's exam results and ratings. None for a new course or a round of several courses. */
export type PlannerRound = PlanRound & { stats: CatalogCourse | undefined };

const sameCourse = (a: PlanRound, b: PlanRound) => a.codes.some((code) => b.codes.includes(code));
const sharesPeriod = (a: PlanRound, b: PlanRound) => a.periods.some((p) => b.periods.includes(p));
const isStudyPeriod = (p: string): p is StudyPeriod => (STUDY_PERIODS as readonly string[]).includes(p);
/** "B+" is block B with extra hours, so the two meet. */
const blockLetter = (block: string | null) => block?.match(/[A-D]/)?.[0] ?? null;

/** Thesis courses that fill the year alike, one round for each way: the same study periods with the same credits. */
function thesisRounds(rounds: readonly PlanRound[]): PlanRound[] {
  const theses = rounds.filter((r) => r.requirement.kind === "thesis");
  return [...Map.groupBy(theses, (r) => `${r.periods.join()}:${r.periodCredits.join()}`).values()].map((group) => {
    const first = group[0]!;
    // A round of several courses has no one number of seats.
    return group.length === 1 ? first : { ...first, codes: group.flatMap((r) => r.codes), name: first.requirement.label, seats: null };
  });
}

/**
 * A year as the planner shows it: the rounds every student takes, and the ones to choose between. A year with one
 * way to do the thesis has it fixed. With several, such as a thesis of 30 or of 60 credits, the student chooses.
 */
export function plannerYear(rounds: readonly PlanRound[], stats: ReadonlyMap<string, CatalogCourse>) {
  const withStats = (round: PlanRound): PlannerRound => ({
    ...round,
    stats: round.codes.length === 1 ? stats.get(round.codes[0]!) : undefined,
  });
  const theses = thesisRounds(rounds);
  const fixedThesis = theses.length === 1;
  const compulsory = rounds.filter((r) => r.requirement.kind === "compulsory");
  const optional = rounds.filter((r) => r.requirement.kind !== "compulsory" && r.requirement.kind !== "thesis");
  return {
    fixed: [...compulsory, ...(fixedThesis ? theses : [])].map(withStats),
    candidates: [...optional, ...(fixedThesis ? [] : theses)].map(withStats),
  };
}

/** Study periods that some round runs in, in calendar order. */
export const periodsOf = (rounds: readonly PlanRound[]): StudyPeriod[] =>
  STUDY_PERIODS.filter((p) => rounds.some((r) => r.periods.includes(p)));

/** Credits the rounds give in a study period. A round over several periods counts what it gives in this one. */
export const creditsIn = (rounds: readonly PlanRound[], period: StudyPeriod) =>
  tenths(rounds.reduce((sum, r) => sum + (r.periodCredits[r.periods.indexOf(period)] ?? 0), 0));

/** The first study period that `plan` does not fill, or the first of all when it fills every one. */
export const firstOpenPeriod = (periods: readonly StudyPeriod[], plan: readonly PlanRound[]) =>
  periods.find((p) => creditsIn(plan, p) < PERIOD_CREDITS) ?? periods[0];

/**
 * The rounds that run in `period`, ordered by `sort` in `dir`, by default as the course list starts it: the best first,
 * and the lightest workload first. Rounds without the value go last, ties by name.
 */
export function candidatesIn(
  candidates: readonly PlannerRound[],
  period: StudyPeriod,
  sort: PlannerSortKey,
  dir: SortDir = defaultSortDir(sort),
): PlannerRound[] {
  const value = (round: PlannerRound) => (round.stats ? sortValueOf(round.stats, sort) : null);
  return candidates
    .filter((r) => r.periods.includes(period))
    .toSorted((a, b) => compareSortValues(value(a), value(b), dir) || a.name.localeCompare(b.name, "sv"));
}

/** The picks after adding `round`, or after removing it when it is one. A course has one round in a plan, so adding another round of it moves it. */
export function togglePick(picked: readonly string[], round: PlanRound, candidates: readonly PlanRound[]): string[] {
  if (picked.includes(round.key)) return picked.filter((key) => key !== round.key);
  const otherRounds = candidates.filter((c) => sameCourse(c, round)).map((c) => c.key);
  return [...picked.filter((key) => !otherRounds.includes(key)), round.key];
}

export interface PlanElsewhere {
  /** The year of study, when it is not the current one. */
  year?: number;
  periods: readonly StudyPeriod[];
}

/**
 * Where another round of `round`'s course is in the plan: another study period of the current year, or another
 * year of study in `otherPicks`.
 */
export function findElsewhere(
  round: PlanRound,
  currentPicked: readonly PlanRound[],
  otherPicks: readonly Pick<StudyPick, "number" | "key">[],
): PlanElsewhere | undefined {
  const inCurrent = currentPicked.find((r) => sameCourse(r, round));
  if (inCurrent) {
    return inCurrent.key === round.key ? undefined : { periods: inCurrent.periods };
  }

  for (const pick of otherPicks) {
    const [code, periodsStr] = pick.key.split(".");
    if (code && round.codes.includes(code)) {
      const periods = (periodsStr?.split("-") ?? []).filter(isStudyPeriod);
      return { year: pick.number, periods };
    }
  }
  return undefined;
}

/** A round of another course in `plan` with lectures at the same times: the same block in a shared study period. */
export function lectureClash<R extends PlanRound>(round: PlanRound, plan: readonly R[]): R | undefined {
  const block = blockLetter(round.block);
  if (!block) return undefined;
  return plan.find((other) => !sameCourse(other, round) && blockLetter(other.block) === block && sharesPeriod(other, round));
}

/** A round of another course in `plan` that shares a choice where only one course counts towards the degree. */
export function exclusiveWith<R extends PlanRound>(round: PlanRound, plan: readonly R[]): R | undefined {
  const ids = round.choices.filter((c) => c.kind === "exclusive").map((c) => c.id);
  return plan.find((other) => !sameCourse(other, round) && other.choices.some((c) => ids.includes(c.id)));
}

/** An id of a degree requirement within a plan, for lists. */
export const requirementKey = (requirement: PlanRequirement) =>
  requirement.kind === "theme" ? requirement.theme : requirement.courses.join();

/** A degree requirement the student has to choose courses for, with how far the whole plan goes towards it. */
export interface DegreeRuleProgress extends ReturnType<typeof requirementProgress> {
  requirement: PlanRequirement;
}

/** What a course gives towards a degree requirement, in the requirement's unit. */
export type DegreeRuleMark = DegreeRuleProgress & { amount: number };

/** Something to tell about a round that sits badly with the rest of the plan. */
export type RoundWarning =
  /** Another course has lectures at the same times. `fixed` tells whether every student takes it. */
  | { kind: "sameLectures"; name: string; fixed: boolean }
  /** Another course shares a choice where only one course counts towards the degree. */
  | { kind: "exclusive"; name: string };

/** A round the list shows, with everything the list says about it. */
export interface ListedRound {
  round: PlannerRound;
  picked: boolean;
  /** Where another round of the same course is in the plan. It greys this round out. */
  elsewhere: PlanElsewhere | undefined;
  warnings: RoundWarning[];
  /** What the course gives towards the degree requirements the student has to choose courses for. */
  marks: DegreeRuleMark[];
}

export const DEFAULT_PLANNER_SORT: PlannerSortKey = "rating";

interface YearViewInput {
  /** Every year of study of the degree, the master's programme's included. The requirements count them all. */
  years: readonly StudyYear[];
  /** The year of study to show. */
  current: StudyYear;
  track: string | undefined;
  /** The round keys picked in the current year. */
  pickedKeys: readonly string[];
  /** The picks of the other years of study. */
  otherPicks: readonly StudyPick[];
  /** What the list shows. By default the first study period the plan leaves room in, the best rated first. */
  period?: StudyPeriod;
  sort?: PlannerSortKey;
  dir?: SortDir;
  survey?: OtherQuestion;
  stats: ReadonlyMap<string, CatalogCourse>;
  /** Chalmers' names of the rule codes, in the language shown. */
  ruleNames: Readonly<Record<string, string>>;
}

/**
 * A year of study as the planner shows it: what every student takes, the rounds picked and the ones to choose
 * between, the study period the list shows and its rounds in order, and how far the courses of the whole degree go
 * towards its rules. The degree's requirements count the compulsory courses and the picks of every year of every plan.
 */
export function yearView({
  years,
  current,
  track,
  pickedKeys,
  otherPicks,
  period: shownPeriod,
  sort = DEFAULT_PLANNER_SORT,
  ...input
}: YearViewInput) {
  // The programme whose plan holds this year: the master's programme in years 4 and 5.
  const { plan: yearProgramme, year } = current;
  const { rounds, picks } = planYear(yearProgramme, year, { track, ruleNames: input.ruleNames });
  const { fixed, candidates } = plannerYear(rounds, input.stats);
  const picked = candidates.filter((c) => pickedKeys.includes(c.key));
  const plan = [...fixed, ...picked];
  const periods = periodsOf([...fixed, ...candidates]);
  const period = periods.find((p) => p === shownPeriod) ?? firstOpenPeriod(periods, plan);
  const dir = input.dir ?? defaultSortDir(sort);

  const plans = [...new Set(years.map((y) => y.plan))];
  const allPicks = [...otherPicks, ...picked.map((r) => ({ programme: yearProgramme.code, year, key: r.key }))];
  const courses = plannedCourses(plans, allPicks, track);
  const degreeRules = openRequirements(plans, track).map((requirement) => ({ requirement, ...requirementProgress(requirement, courses) }));
  const marksOf = (round: PlannerRound): DegreeRuleMark[] =>
    degreeRules.flatMap((rule) => {
      const amount = Math.max(...round.codes.map((code) => amountTowards(rule.requirement, { code, themes: round.themes })));
      return amount > 0 ? { ...rule, amount } : [];
    });
  const warningsOf = (round: PlannerRound): RoundWarning[] => {
    const clash = lectureClash(round, plan);
    const exclusive = exclusiveWith(round, plan);
    return [
      ...(clash ? [{ kind: "sameLectures", name: clash.name, fixed: fixed.includes(clash) } as const] : []),
      ...(exclusive ? [{ kind: "exclusive", name: exclusive.name } as const] : []),
    ];
  };

  return {
    fixed,
    candidates,
    picked,
    plan,
    periods,
    /** The study period the list shows. None when the year has no courses. */
    period,
    sort,
    dir,
    survey: surveyColumn(sort, input.survey),
    listed: (period ? candidatesIn(candidates, period, sort, dir) : []).map((round): ListedRound => ({
      round,
      picked: picked.includes(round),
      elsewhere: findElsewhere(round, picked, otherPicks),
      warnings: warningsOf(round),
      marks: marksOf(round),
    })),
    /** Credits of the year's plan. */
    planned: plan.reduce((sum, r) => sum + r.credits, 0),
    /** The choices that ask for some of the year's courses, with how far the courses of every year go towards them. */
    pickRules: picks.map((pick) => ({ pick, progress: pickProgress(pick, yearProgramme, courses) })),
    degreeRules,
    /** The codes of every course any year of the degree's plans offers. */
    offered: new Set(plans.flatMap((p) => p.years.flatMap((y) => y.courses.map((c) => c.code)))),
  };
}

const meanOf = (values: readonly (number | null)[]) => {
  const known = values.filter((value) => value !== null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
};

/**
 * A master's programme in short, to compare it with the others a programme leads on to: its tracks, what every
 * student of it takes, how many courses it offers to choose, and how a typical course of it with results goes.
 */
export function masterSummary(master: ProgrammePlan, stats: ReadonlyMap<string, CatalogCourse>) {
  const courses = [...new Map(master.years.flatMap((y) => y.courses).map((c) => [c.code, c])).values()];
  const compulsory = plannedCourses([master], []);
  const withStats = courses.flatMap((c) => stats.get(c.code) ?? []);
  return {
    tracks: tracksOf(courses),
    compulsory,
    compulsoryCredits: tenths(compulsory.reduce((sum, c) => sum + c.credits, 0)),
    electives: courses.filter(isElective).length,
    passRate: meanOf(withStats.map((c) => c.passRate)),
    rating: meanOf(withStats.map((c) => c.rating)),
  };
}

/** What it takes for a master's programme to complete a programme's degree. */
export interface Accreditation {
  /** Specialisations of the master's programme that the degree needs one of. Empty when any will do. */
  specialisations: readonly string[];
  /** The course list of a master's programme Chalmers has announced but not planned yet. */
  courseList: string | null;
}

/**
 * The master's programmes that complete `programme`'s degree, by code. Upcoming master's programmes come with their
 * own accreditations, since the programme syllabus names the current ones.
 */
export function accreditedMasters(programme: ProgrammePlan, upcoming: UpcomingMasters | null): Map<string, Accreditation> {
  return new Map(
    upcoming
      ? (upcoming.accreditations[programme.code] ?? []).map(({ code, specialisations }) => [
          code,
          { specialisations, courseList: upcoming.masters[code]?.courseList ?? null },
        ])
      : programme.masters.map((code) => [code, { specialisations: [], courseList: null }]),
  );
}

/** Programmes whose code or name in either language holds every word of `query`, by name. Every programme without a query. */
export function searchProgrammes<P extends Pick<ProgrammePlan, "code" | "name">>(
  programmes: readonly P[],
  names: Readonly<Record<string, InLanguage>>,
  query: string,
): P[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return programmes
    .filter((p) => {
      const text = normalize(`${p.code} ${p.name} ${names[p.code]?.otherName ?? ""}`);
      return words.every((word) => text.includes(word));
    })
    .toSorted((a, b) => a.name.localeCompare(b.name, "sv"));
}
