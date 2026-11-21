import { compareSortValues, defaultSortDir, sortValueOf, surveyColumn, type CatalogCourse, type SortDir } from "./catalog.ts";
import { degreeRulesOf, marksOf, pickProgress, type DegreeRuleProgress } from "./degree.ts";
import { OTHER_QUESTIONS, type OtherQuestion } from "./evaluation.ts";
import { normalize, type InLanguage } from "./names.ts";
import {
  isElective,
  plannedCourses,
  planYear,
  REGULAR_PERIODS,
  STUDY_PERIODS,
  tenths,
  tracksOf,
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

/** The lane of the courses whose study periods are not known yet: those that only an upcoming master's course list names. */
export const UNSCHEDULED = "Unscheduled";
/** What the planner lists courses by: a study period, or the courses without one. */
export const LANES = [...STUDY_PERIODS, UNSCHEDULED] as const;
export type Lane = (typeof LANES)[number];

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
 * way to do the thesis has it fixed. With several, such as a thesis of 30 or of 60 credits, the student chooses. So
 * do they between the rounds of a compulsory course given in several study periods, since they take it once.
 */
export function plannerYear(rounds: readonly PlanRound[], stats: ReadonlyMap<string, CatalogCourse>) {
  const withStats = (round: PlanRound): PlannerRound => ({
    ...round,
    stats: round.codes.length === 1 ? stats.get(round.codes[0]!) : undefined,
  });
  const theses = thesisRounds(rounds);
  const fixedThesis = theses.length === 1;
  const compulsory = rounds.filter((r) => r.requirement.kind === "compulsory");
  const roundsOfCourse = Map.groupBy(compulsory, (r) => r.codes.join());
  const givenOnce = (r: PlanRound) => roundsOfCourse.get(r.codes.join())?.length === 1;
  const optional = rounds.filter((r) => r.requirement.kind !== "compulsory" && r.requirement.kind !== "thesis");
  return {
    fixed: [...compulsory.filter(givenOnce), ...(fixedThesis ? theses : [])].map(withStats),
    candidates: [...compulsory.filter((r) => !givenOnce(r)), ...optional, ...(fixedThesis ? [] : theses)].map(withStats),
  };
}

/** Whether a round runs in a study period, or, in the unscheduled lane, has no study period. */
const inLane = (round: Pick<PlanRound, "periods">, lane: Lane) =>
  lane === UNSCHEDULED ? round.periods.length === 0 : round.periods.includes(lane);

/** The lanes that some round is in, and those in `always`, in calendar order with the unscheduled lane last. */
export const lanesOf = (rounds: readonly PlanRound[], always: readonly Lane[] = []): Lane[] =>
  LANES.filter((lane) => always.includes(lane) || rounds.some((r) => inLane(r, lane)));

/** Credits the rounds give in a study period. A round over several periods counts what it gives in this one. */
export const creditsIn = (rounds: readonly PlanRound[], period: StudyPeriod) =>
  tenths(rounds.reduce((sum, r) => sum + (r.periodCredits[r.periods.indexOf(period)] ?? 0), 0));

/**
 * The lane the planner opens on: the first study period that `plan` does not fill and that has courses to choose from,
 * else the first lane with courses to choose from, else the first lane.
 */
export function firstOpenLane(lanes: readonly Lane[], plan: readonly PlanRound[], candidates: readonly PlanRound[]) {
  const choosable = (lane: Lane) => candidates.some((r) => inLane(r, lane));
  return (
    lanes.find((lane) => lane !== UNSCHEDULED && creditsIn(plan, lane) < PERIOD_CREDITS && choosable(lane)) ??
    lanes.find(choosable) ??
    lanes[0]
  );
}

/**
 * The rounds in `lane`, ordered by `sort` in `dir`, by default as the course list starts it: the best first, and the
 * lightest workload first. Rounds without the value go last, ties by name.
 */
export function roundsIn(
  rounds: readonly PlannerRound[],
  lane: Lane,
  sort: PlannerSortKey,
  dir: SortDir = defaultSortDir(sort),
): PlannerRound[] {
  const value = (round: PlannerRound) => (round.stats ? sortValueOf(round.stats, sort) : null);
  return rounds
    .filter((r) => inLane(r, lane))
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

/** Something to tell about a round that sits badly with the rest of the plan. */
export type RoundWarning =
  /** Another course has lectures at the same times. `fixed` tells whether every student takes it. */
  | { kind: "sameLectures"; name: string; fixed: boolean }
  /** Another course shares a choice where only one course counts towards the degree. */
  | { kind: "exclusive"; name: string };

/**
 * A requirement of the degree the student has to choose courses for. `marker` is its place among the year's rules,
 * after the picks, which tells its courses apart from those of the other rules.
 */
export type MarkedDegreeRule = DegreeRuleProgress & { marker: number };

/** A round the list shows, with everything the list says about it. */
export interface ListedRound {
  round: PlannerRound;
  /** Every student takes it, so it is in the year and cannot be removed. */
  fixed: boolean;
  picked: boolean;
  /** Where another round of the same course is in the plan. It greys this round out. */
  elsewhere: PlanElsewhere | undefined;
  warnings: RoundWarning[];
  /** The year's picks the course is one of, by marker, and whether the plan has picked enough of each. */
  picks: { marker: number; done: boolean }[];
  /** What the course gives towards the degree requirements the student has to choose courses for. */
  marks: (MarkedDegreeRule & { amount: number })[];
}

const DEFAULT_PLANNER_SORT: PlannerSortKey = "rating";

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
  /** What the list shows. By default the first study period with room and courses to choose from, the best rated first. */
  period?: Lane;
  sort?: PlannerSortKey;
  dir?: SortDir;
  survey?: OtherQuestion;
  stats: ReadonlyMap<string, CatalogCourse>;
  /** Chalmers' names of the rule codes, in the language shown. */
  ruleNames: Readonly<Record<string, string>>;
}

/**
 * A year of study as the planner shows it: what every student takes, the rounds picked and the ones to choose
 * between, the lane the list shows and its rounds in order, and how far the courses of the whole degree go towards its
 * rules. The degree's requirements count the compulsory courses and the picks of every year of every plan.
 */
export function yearView({
  years,
  current,
  track,
  pickedKeys,
  otherPicks,
  period: shownPeriod,
  sort = DEFAULT_PLANNER_SORT,
  dir = defaultSortDir(sort),
  survey,
  stats,
  ruleNames,
}: YearViewInput) {
  // The programme whose plan holds this year: the master's programme in years 4 and 5.
  const { plan: yearProgramme, year } = current;
  const { rounds, picks } = planYear(yearProgramme, year, { track, ruleNames });
  const { fixed, candidates } = plannerYear(rounds, stats);
  const picked = candidates.filter((c) => pickedKeys.includes(c.key));
  const plan = [...fixed, ...picked];
  const yearRounds = [...fixed, ...candidates];
  // A course whose study periods are not known yet can run in any of them, so the year shows them all.
  const lanes = lanesOf(yearRounds, yearRounds.some((r) => r.pending) ? REGULAR_PERIODS : []);
  const lane = lanes.find((l) => l === shownPeriod) ?? firstOpenLane(lanes, plan, candidates);

  const plans = [...new Set(years.map((y) => y.plan))];
  const allPicks = [...otherPicks, ...picked.map((r) => ({ programme: yearProgramme.code, year, key: r.key }))];
  const courses = plannedCourses(plans, allPicks, track);
  const pickRules = picks.map((pick, marker) => ({ pick, marker, progress: pickProgress(pick, yearProgramme, courses) }));
  // Lists of courses before themes, so that the rules a course carries no badge for take the markers right after the picks.
  const degreeRules: MarkedDegreeRule[] = degreeRulesOf(plans, courses, track)
    .toSorted((a, b) => Number(a.requirement.kind === "theme") - Number(b.requirement.kind === "theme"))
    .map((rule, index) => ({ ...rule, marker: pickRules.length + index }));
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
    lanes,
    /**
     * The year's lanes with what is in each, its credits, and whether two of its courses have lectures at the same
     * times. The courses without a study period have no credits yet, so their lane's are null.
     */
    laneCards: lanes.map((l) => {
      const inThisLane = (round: PlannerRound) => inLane(round, l);
      const fixedIn = fixed.filter(inThisLane);
      const pickedIn = picked.filter(inThisLane);
      const laneRounds = [...fixedIn, ...pickedIn];
      return {
        lane: l,
        fixed: fixedIn,
        picked: pickedIn,
        credits: l === UNSCHEDULED ? null : creditsIn(laneRounds, l),
        clashing: laneRounds.some((round) => lectureClash(round, laneRounds)),
      };
    }),
    /** The lane the list shows. None when the year has no courses. */
    lane,
    sort,
    dir,
    survey: surveyColumn(sort, survey),
    /** The lane's rounds in order: those every student takes, locked, among those to choose. */
    listed: (lane ? roundsIn(yearRounds, lane, sort, dir) : []).map((round): ListedRound => {
      const isFixed = fixed.includes(round);
      return {
        round,
        fixed: isFixed,
        picked: picked.includes(round),
        elsewhere: isFixed ? undefined : findElsewhere(round, picked, otherPicks),
        warnings: warningsOf(round),
        picks: pickRules
          .filter(({ pick }) => round.choices.some((choice) => choice.id === pick.id))
          .map(({ marker, progress }) => ({ marker, done: progress.done })),
        marks: marksOf(degreeRules, round),
      };
    }),
    /** Credits of the year's plan. */
    planned: plan.reduce((sum, r) => sum + r.credits, 0),
    /** Courses of the year's plan whose credits are not known yet. */
    pendingCourses: plan.filter((r) => r.pending).length,
    /**
     * The choices that ask for some of the year's courses, with how far the courses of every year go towards them.
     * `marker` is each one's place among the year's rules, which tells its courses apart from those of the others.
     */
    pickRules,
    /** The degree's requirements, its lists of courses before its themes. */
    degreeRules,
    /** The codes of every course any year of the degree's plans offers. */
    offered: new Set(plans.flatMap((p) => p.years.flatMap((y) => y.courses.map((c) => c.code)))),
  };
}

/**
 * A master's programme in short, to compare it with the others a programme leads on to: its tracks, what every
 * student of it takes, and how many courses it offers to choose.
 */
export function masterSummary(master: ProgrammePlan) {
  const courses = [...new Map(master.years.flatMap((y) => y.courses).map((c) => [c.code, c])).values()];
  const compulsory = plannedCourses([master], []);
  return {
    tracks: tracksOf(courses),
    compulsory,
    compulsoryCredits: tenths(compulsory.reduce((sum, c) => sum + c.credits, 0)),
    electives: courses.filter(isElective).length,
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
