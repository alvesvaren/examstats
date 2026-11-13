import { compareSortValues, normalize, type CatalogCourse } from "./catalog.ts";
import {
  isElective,
  plannedCourses,
  STUDY_PERIODS,
  tracksOf,
  type PlanChoice,
  type PlanCourse,
  type PlanRequirement,
  type PlanRound,
  type ProgrammePlan,
  type StudyPeriod,
  type StudyPick,
} from "./programme-plans.ts";

export const PLANNER_SORT_KEYS = ["rating", "passRate"] as const;
export type PlannerSortKey = (typeof PLANNER_SORT_KEYS)[number];

/** Credits of full-time study in one study period. */
export const PERIOD_CREDITS = 15;

/** A round in the planner with its course's exam results and ratings. None for a new course or a round of several courses. */
export type PlannerRound = PlanRound & { stats: CatalogCourse | undefined };

const tenths = (credits: number) => Math.round(credits * 10) / 10;
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
    return group.length === 1 ? first : { ...first, codes: group.flatMap((r) => r.codes), name: first.requirement.label };
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

/** The rounds that run in `period`, the best first by `sort`. Rounds without the value go last, ties by name. */
export function candidatesIn(candidates: readonly PlannerRound[], period: StudyPeriod, sort: PlannerSortKey): PlannerRound[] {
  return candidates
    .filter((r) => r.periods.includes(period))
    .toSorted((a, b) => compareSortValues(a.stats?.[sort] ?? null, b.stats?.[sort] ?? null, "desc") || a.name.localeCompare(b.name, "en"));
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

/**
 * How far the courses of a whole plan go towards a choice of `programme` that asks for some of its courses, in courses
 * or in credits as the choice counts. A course of the choice counts in any year, also one whose plan lists it there
 * outside the choice.
 */
export function pickProgress(pick: PlanChoice, programme: ProgrammePlan, courses: readonly PlanCourse[]) {
  const members = new Set(programme.years.flatMap((y) => y.courses.filter((c) => c.choices.includes(pick.id)).map((c) => c.code)));
  const mine = courses.filter((c) => members.has(c.code));
  const inCourses = pick.minCourses !== null;
  const have = inCourses ? mine.length : tenths(mine.reduce((sum, r) => sum + r.credits, 0));
  const need = pick.minCourses ?? pick.minCredits;
  return { have, need, unit: inCourses ? "courses" : "credits", done: need !== null && have >= need } as const;
}

/** What a course gives towards a degree requirement, in the requirement's unit: its credits in the theme, or one course. */
export const amountTowards = (requirement: PlanRequirement, { code, themes }: Pick<PlanCourse, "code" | "themes">) =>
  requirement.kind === "theme"
    ? (themes.find((t) => t.theme === requirement.theme)?.credits ?? 0)
    : Number(requirement.courses.includes(code));

/** How far the courses of a whole plan go towards a degree requirement. */
export function requirementProgress(requirement: PlanRequirement, courses: readonly Pick<PlanCourse, "code" | "themes">[]) {
  const have = tenths(courses.reduce((sum, course) => sum + amountTowards(requirement, course), 0));
  const [need, unit] =
    requirement.kind === "theme" ? ([requirement.minCredits, "credits"] as const) : ([requirement.minCourses, "courses"] as const);
  return { have, need, unit, done: have >= need };
}

/**
 * The degree requirements a student has to choose courses for: those of each plan that its own compulsory courses do
 * not meet. A requirement that a master's programme's compulsory courses meet stays, so the plan shows it met.
 */
export const openRequirements = (plans: readonly ProgrammePlan[], track?: string) =>
  plans.flatMap((plan) => plan.requirements.filter((r) => !requirementProgress(r, plannedCourses([plan], [], track)).done));

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

/** Programmes whose code, name or Swedish name holds every word of `query`, by name. Every programme without a query. */
export function searchProgrammes<P extends Pick<ProgrammePlan, "code" | "name">>(
  programmes: readonly P[],
  swedishNames: Readonly<Record<string, string>>,
  query: string,
): P[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return programmes
    .filter((p) => {
      const text = normalize(`${p.code} ${p.name} ${swedishNames[p.code] ?? ""}`);
      return words.every((word) => text.includes(word));
    })
    .toSorted((a, b) => a.name.localeCompare(b.name, "en"));
}
