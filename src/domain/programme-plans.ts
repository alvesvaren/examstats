import { z } from "zod";
import { inLanguage, type Language } from "./names.ts";

/** Study periods in calendar order. Summer and "outside study periods" come after the four regular ones. */
export const STUDY_PERIODS = ["LP1", "LP2", "LP3", "LP4", "Summer", "Other"] as const;
export type StudyPeriod = (typeof STUDY_PERIODS)[number];

/** Chalmers' themes that a degree asks for credits in: "Human, technology and society", and "Environment and sustainable development". */
export const THEMES = ["mts", "environment"] as const;
export type Theme = (typeof THEMES)[number];

export const planCourseSchema = z.object({
  code: z.string(),
  name: z.string(),
  /** Credits of the course's modules in this plan. */
  credits: z.number().nonnegative(),
  /** Study periods with credits, in calendar order. */
  periods: z.array(z.enum(STUDY_PERIODS)),
  /** Credits in each of `periods`, in the same order. They add up to `credits`. */
  periodCredits: z.array(z.number().nonnegative()),
  /** Chalmers' rule code, such as "O" for compulsory. `ruleNames` in the file names each code. */
  rule: z.string(),
  /** Master's track or specialisation the plan lists the course under, or null for the whole year. */
  track: z.string().nullable(),
  /** Chalmers' timetable block, such as "C+", or null when the course has none. */
  block: z.string().nullable(),
  /** Ids of the programme's choices the course is part of. */
  choices: z.array(z.number().int()),
  /** Credits the course gives in each theme it is part of. Often fewer than the course's credits. */
  themes: z.array(z.object({ theme: z.enum(THEMES), credits: z.number().positive() })),
  /** Examiners of the course round, by name. Empty when the round is unknown. */
  examiners: z.array(z.string()),
  /** Credits of each module of the course round, by the module code that results also use. Empty when the round is unknown. */
  modules: z.array(z.object({ code: z.string(), credits: z.number().nonnegative() })),
});

/**
 * A note on a set of courses in a programme. "pick" asks for at least some of them, which makes them compulsory
 * electives. "exclusive" lets only one of them count towards the degree. "recommended" suggests them, often for a track.
 */
export const planChoiceSchema = z.object({
  id: z.number().int(),
  kind: z.enum(["pick", "exclusive", "recommended", "other"]),
  /** Chalmers' description, such as "Among these courses you have to choose at least 2 courses", if it has one. */
  text: z.string().nullable(),
  minCourses: z.number().int().positive().nullable(),
  minCredits: z.number().positive().nullable(),
});

/**
 * What the programme syllabus asks of the whole degree, on top of the plan of each year: credits in a theme, or some
 * of a list of courses, which need not all be in the plan.
 */
export const planRequirementSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("theme"), theme: z.enum(THEMES), minCredits: z.number().positive() }),
  z.object({ kind: z.literal("courses"), courses: z.array(z.string()).min(1), minCourses: z.number().int().positive() }),
]);

export const programmePlanSchema = z.object({
  code: z.string(),
  name: z.string(),
  choices: z.array(planChoiceSchema),
  requirements: z.array(planRequirementSchema),
  /** Codes of the master's programmes that the programme's students can finish their degree with. */
  masters: z.array(z.string()),
  /** What a master's programme asks its students to have studied before it, in Chalmers' words, one paragraph each. Empty when it asks nothing. */
  prerequisites: z.array(z.string()),
  /** Years of study, from 1, with the courses planned in each. */
  years: z.array(z.object({ year: z.number().int().positive(), courses: z.array(planCourseSchema) })),
});

export const planInfoSchema = z.object({
  /** Academic year of the plans, such as "2026/2027". */
  academicYear: z.string(),
  /** Chalmers' name of each rule code, such as "Compulsory courses". */
  ruleNames: z.record(z.string(), z.string()),
});

const swedishName = z.string();

/** A programme plan as the app loads it, with the Swedish name of the programme and of each course. */
export const publishedPlanSchema = programmePlanSchema.extend({
  swedishName,
  years: z.array(programmePlanSchema.shape.years.element.extend({ courses: z.array(planCourseSchema.extend({ swedishName })) })),
});
export type PublishedPlan = z.infer<typeof publishedPlanSchema>;

/** A plan with the programme and each course named in `language`. */
export const planInLanguage = (plan: PublishedPlan, language: Language) => ({
  ...inLanguage(plan, language),
  years: plan.years.map((year) => ({ ...year, courses: year.courses.map((course) => inLanguage(course, language)) })),
});

/** The committed file that `pnpm programme-plans` writes and `pnpm snapshot` reads. */
export const programmePlansFileSchema = planInfoSchema.extend({ programmes: z.array(programmePlanSchema) });

export type PlanCourse = z.infer<typeof planCourseSchema>;
export type PlanChoice = z.infer<typeof planChoiceSchema>;
export type PlanRequirement = z.infer<typeof planRequirementSchema>;
export type ProgrammePlan = z.infer<typeof programmePlanSchema>;
export type PlanInfo = z.infer<typeof planInfoSchema>;
export type ProgrammePlansFile = z.infer<typeof programmePlansFileSchema>;

/** Where a course sits in one programme's plan, with the programme's choices it is part of. */
export const coursePlacementSchema = planCourseSchema.omit({ code: true, name: true, choices: true }).extend({
  programme: z.string(),
  programmeName: z.string(),
  year: z.number().int().positive(),
  choices: z.array(planChoiceSchema),
});
export type CoursePlacement = z.infer<typeof coursePlacementSchema>;

/** A course round as the course syllabus describes it. */
export interface CourseRound {
  periods: readonly StudyPeriod[];
  block: string | null;
  examiners: readonly string[];
}

const samePeriods = (a: readonly StudyPeriod[], b: readonly StudyPeriod[]) => a.join() === b.join();

/**
 * The round of a course that a plan entry refers to. Plans and syllabi share no round id, so a round matches on its
 * study periods, then on its block. Null when no round, or more than one, matches.
 */
export function roundOf<R extends CourseRound>(entry: Pick<PlanCourse, "periods" | "block">, rounds: readonly R[]): R | null {
  const inPeriods = rounds.filter((r) => samePeriods(r.periods, entry.periods));
  const candidates = inPeriods.length > 1 ? inPeriods.filter((r) => r.block === entry.block) : inPeriods;
  return candidates.length === 1 ? candidates[0]! : null;
}

const COMPULSORY = "O";
const ELECTIVE = "V";
const THESIS = "X";

/**
 * How much a plan asks of a student for a course, as a kind, a label and a rank, compulsory first. Elective courses in
 * a choice that asks for some of them are compulsory electives. Other rules, such as a thesis, take Chalmers' name.
 */
export function requirementOf(rule: string, choices: readonly Pick<PlanChoice, "kind">[], ruleNames: Readonly<Record<string, string>>) {
  if (rule === COMPULSORY) return { kind: "compulsory", rank: 0, label: "Compulsory" } as const;
  if (rule === ELECTIVE && choices.some((c) => c.kind === "pick")) {
    return { kind: "compulsoryElective", rank: 1, label: "Compulsory elective" } as const;
  }
  if (rule === ELECTIVE) return { kind: "elective", rank: 2, label: "Elective" } as const;
  const label = (ruleNames[rule] ?? rule).replace(/ courses$/i, "");
  return { kind: rule === THESIS ? "thesis" : "other", rank: 3, label } as const;
}
export type Requirement = ReturnType<typeof requirementOf>;

/** Whether a plan lists a course as one to choose, as opposed to a compulsory course or a thesis. */
export const isElective = ({ rule }: Pick<PlanCourse, "rule">) => rule === ELECTIVE;

const periodRank = (periods: readonly StudyPeriod[]) => STUDY_PERIODS.indexOf(periods[0] ?? "Other");

/** Earlier study periods first, and a course that ends in its first period before one that runs on. */
export const comparePeriods = (a: readonly StudyPeriod[], b: readonly StudyPeriod[]) =>
  periodRank(a) - periodRank(b) || a.length - b.length;

/** Every placement of every course by course code, the most required first, then by programme and year. */
export function placementsByCourse(
  programmes: readonly ProgrammePlan[],
  ruleNames: Readonly<Record<string, string>>,
): Map<string, CoursePlacement[]> {
  const placements = programmes.flatMap((programme) => {
    const choices = new Map(programme.choices.map((c) => [c.id, c]));
    return programme.years.flatMap(({ year, courses }) =>
      courses.map(({ code, name: _, choices: ids, ...course }) => ({
        code,
        placement: {
          ...course,
          programme: programme.code,
          programmeName: programme.name,
          year,
          choices: ids.flatMap((id) => choices.get(id) ?? []),
        },
      })),
    );
  });
  const rank = (p: CoursePlacement) => requirementOf(p.rule, p.choices, ruleNames).rank;
  return new Map(
    [...Map.groupBy(placements, (p) => p.code)].map(([code, group]) => [
      code,
      group
        .map((p) => p.placement)
        .toSorted(
          (a, b) => rank(a) - rank(b) || a.programme.localeCompare(b.programme) || a.year - b.year || comparePeriods(a.periods, b.periods),
        ),
    ]),
  );
}

/** Tracks that list courses in a year of a programme, by name. */
export const tracksOf = (courses: readonly PlanCourse[]) =>
  [...new Set(courses.flatMap((c) => c.track ?? []))].toSorted((a, b) => a.localeCompare(b));

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "sv");

/** A round's id within a year of a plan: the course and the study periods it runs in. Safe in a URL. */
export const roundKey = (code: string, periods: readonly StudyPeriod[]) => `${code}.${periods.join("-")}`;

/**
 * The course rounds of a year of a programme plan, the earliest first. A track keeps its own rounds and the whole
 * year's. Without one, every round. A course takes the strongest of the rules the plan lists it under, and every
 * choice it is part of, in all its rounds.
 */
export function planYear(
  programme: ProgrammePlan,
  year: number,
  { track, ruleNames }: { track?: string; ruleNames: Readonly<Record<string, string>> },
) {
  const choices = new Map(programme.choices.map((c) => [c.id, c]));
  const entries = (programme.years.find((y) => y.year === year)?.courses ?? []).filter(
    (c) => !track || c.track === null || c.track === track,
  );
  const courses = new Map(
    [...Map.groupBy(entries, (c) => c.code)].map(([code, group]) => {
      const ids = [...new Set(group.flatMap((c) => c.choices))].toSorted((a, b) => a - b);
      const requirement = group
        .map((c) =>
          requirementOf(
            c.rule,
            c.choices.flatMap((id) => choices.get(id) ?? []),
            ruleNames,
          ),
        )
        .toSorted((a, b) => a.rank - b.rank)[0]!;
      return [code, { requirement, choices: ids.flatMap((id) => choices.get(id) ?? []) }];
    }),
  );
  const rounds = [...Map.groupBy(entries, (c) => roundKey(c.code, c.periods))]
    .map(([key, group]) => {
      const { code, name, credits, periods, periodCredits, block, themes } = group[0]!;
      /** `codes` holds one course. The planner joins thesis courses that fill the year alike into one round. */
      return { key, codes: [code], name, credits, periods, periodCredits, block, themes, ...courses.get(code)! };
    })
    .toSorted((a, b) => comparePeriods(a.periods, b.periods) || byName(a, b));
  return {
    rounds,
    /** Choices that ask for some of this year's courses, in Chalmers' order. */
    picks: programme.choices.filter((c) => c.kind === "pick" && entries.some((e) => e.choices.includes(c.id))),
  };
}
export type PlanRound = ReturnType<typeof planYear>["rounds"][number];

/** A civil engineering programme leads on to a master's programme, which is the fourth and fifth year of the degree. */
export const MASTER_START_YEAR = 4;

/** A year of study of a degree: a year of the programme's plan or of the master's, numbered from the start of the programme. */
export interface StudyYear {
  number: number;
  plan: ProgrammePlan;
  year: number;
}

/** The years of study of a programme, and of the master's programme after it. */
export function studyYears(programme: ProgrammePlan, master?: ProgrammePlan): StudyYear[] {
  const yearsOf = (plan: ProgrammePlan, first: number) => plan.years.map(({ year }) => ({ number: first + year - 1, plan, year }));
  return [...yearsOf(programme, 1), ...(master ? yearsOf(master, MASTER_START_YEAR) : [])];
}

/** A round picked in a year of a programme's plan. */
export interface PlanPick {
  programme: string;
  year: number;
  key: string;
}

/** A round picked in a year of study, with the year's number in the degree. */
export interface StudyPick extends PlanPick {
  number: number;
}

/**
 * The courses a student's whole plan holds, each once: the compulsory ones of every year of `plans`, with those of
 * `track`, and the rounds picked in each year.
 */
export function plannedCourses(plans: readonly ProgrammePlan[], picks: readonly PlanPick[], track?: string): PlanCourse[] {
  const held = plans.flatMap((plan) =>
    plan.years.flatMap(({ year, courses }) =>
      courses.filter(
        (c) =>
          (c.rule === COMPULSORY && (c.track === null || c.track === track)) ||
          picks.some((p) => p.programme === plan.code && p.year === year && p.key === roundKey(c.code, c.periods)),
      ),
    ),
  );
  return [...new Map(held.map((c) => [c.code, c])).values()];
}

/**
 * A course's academic year in short: its rounds with their examiners, and the programmes that plan it, grouped by
 * how much they require it, the most first. A programme lists each year of study it plans the course in once.
 */
export function courseYearSummary(placements: readonly CoursePlacement[], ruleNames: Readonly<Record<string, string>>) {
  const rounds = [...Map.groupBy(placements, (p) => p.periods.join("-")).values()]
    .map((group) => ({ periods: group[0]!.periods, examiners: [...new Set(group.flatMap((p) => p.examiners))] }))
    .toSorted((a, b) => comparePeriods(a.periods, b.periods));
  const withRequirement = placements.map((p) => ({ ...p, requirement: requirementOf(p.rule, p.choices, ruleNames) }));
  const requirements = [...Map.groupBy(withRequirement, (p) => p.requirement.label).values()]
    .map((group) => ({
      requirement: group[0]!.requirement,
      programmes: [...Map.groupBy(group, (p) => p.programme)].map(([code, entries]) => ({
        code,
        name: entries[0]!.programmeName,
        years: [...new Set(entries.map((e) => e.year))].toSorted((a, b) => a - b),
      })),
    }))
    .toSorted((a, b) => a.requirement.rank - b.requirement.rank);
  return { rounds, requirements };
}

/** The English course syllabus page on chalmers.se. */
export const syllabusUrl = (code: string) =>
  `https://www.chalmers.se/en/education/your-studies/find-course-and-programme-syllabi/course-syllabus/${encodeURIComponent(code)}/`;

/** The programme's overview on chalmers.se: its syllabus and plan of this year. */
export const programmeUrl = (code: string) =>
  `https://www.chalmers.se/en/education/your-studies/find-course-and-programme-syllabi/programme-overview/${encodeURIComponent(code)}/`;
