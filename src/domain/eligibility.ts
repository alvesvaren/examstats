import { z } from "zod";
import { namedSchema, normalize } from "./names.ts";
import { REGULAR_PERIODS, startYearOf, takes, type StudyPeriod, type StudyPick, type StudyYear } from "./programme-plans.ts";

/** A course the guide names, by its codes, any of which counts, since a course often had other codes before. */
export const guideCourseSchema = z.object({
  codes: z.array(z.string()).min(1),
  /** The name the guide gives the course, in Swedish. */
  name: z.string(),
  /** Being registered on the course by the application deadline is enough. The guide marks such a course with an asterisk. */
  registration: z.boolean(),
});
export type GuideCourse = z.infer<typeof guideCourseSchema>;

/**
 * Courses a student needs, combined as the guide combines them: a course, all of some rules ("samt"), any of them
 * ("eller", and the guide's alternatives), or at least some number of them ("2 av 4 valfritt").
 */
export type CourseRule =
  | ({ kind: "course" } & GuideCourse)
  | { kind: "all"; of: CourseRule[] }
  | { kind: "any"; of: CourseRule[] }
  | { kind: "atLeast"; count: number; of: CourseRule[] };

export const courseRuleSchema: z.ZodType<CourseRule> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    guideCourseSchema.extend({ kind: z.literal("course") }),
    z.object({ kind: z.literal("all"), of: z.array(courseRuleSchema).min(2) }),
    z.object({ kind: z.literal("any"), of: z.array(courseRuleSchema).min(2) }),
    z.object({ kind: z.literal("atLeast"), count: z.number().int().positive(), of: z.array(courseRuleSchema).min(2) }),
  ]),
);

/** What the guide asks of a programme's students to be admitted to a master's programme. */
export const admissionSchema = z.discriminatedUnion("kind", [
  /** The compulsory courses of the programme's first three years meet every requirement. */
  z.object({ kind: z.literal("compulsory") }),
  /** Courses on top of the compulsory ones. */
  z.object({ kind: z.literal("courses"), rule: courseRuleSchema }),
  /** The admission regulations decide, in subjects and credits rather than courses, as for programmes the guide does not name. */
  z.object({ kind: z.literal("regulations") }),
  /** What the guide says in words that name no courses to check, such as credits in a subject, or a block it words unclearly. */
  z.object({ kind: z.literal("words"), text: z.string() }),
]);
export type Admission = z.infer<typeof admissionSchema>;

export const guideEntrySchema = z.object({
  programme: z.string(),
  /**
   * For a programme that leads to either degree, such as Maskinteknik (180/300hp): whether the entry is for its students
   * on the way to the five-year degree or to the three-year one. Null for every student of the programme.
   */
  path: z.enum(["fiveYear", "threeYear"]).nullable(),
  admission: admissionSchema,
  /** Courses the guide recommends to the programme's students on top of what it asks for. */
  recommended: z.array(guideCourseSchema),
});
export type GuideEntry = z.infer<typeof guideEntrySchema>;

export const guideMasterSchema = z.object({
  code: z.string(),
  /** A specialisation that students apply to on its own, with entry requirements of its own. Null for the programme itself. */
  specialisation: z.string().nullable(),
  /** One per programme the guide names, and one per path of a programme it names twice. */
  entries: z.array(guideEntrySchema),
  /** Courses the guide recommends to every applicant. */
  recommended: z.array(guideCourseSchema),
});
export type GuideMaster = z.infer<typeof guideMasterSchema>;

/**
 * The committed file that `pnpm eligibility` writes: Chalmers' guide to the master's programmes for its own students,
 * which translates each master's programme's entry requirements into Chalmers course codes, per programme.
 */
export const eligibilityFileSchema = z.object({
  /** The academic year the master's programmes start in, such as "2027/2028". */
  academicYear: z.string(),
  /** The guide's PDF on chalmers.se. */
  source: z.url(),
  masters: z.array(guideMasterSchema),
});
export type EligibilityFile = z.infer<typeof eligibilityFileSchema>;

/** The guide as the app loads it, with the names of the courses it names. */
export const publishedEligibilitySchema = eligibilityFileSchema.extend({
  /** Chalmers' English and Swedish names of each course the guide names, by code, for the codes it has named since 2021/2022. */
  names: z.record(z.string(), namedSchema),
});
export type PublishedEligibility = z.infer<typeof publishedEligibilitySchema>;

/** Every course a rule names, in the guide's order. */
export const coursesOf = (rule: CourseRule): GuideCourse[] => (rule.kind === "course" ? [rule] : rule.of.flatMap(coursesOf));

/** Every course a guide names, in its rules and in its recommendations. */
export const guideCourses = (masters: readonly GuideMaster[]) =>
  masters.flatMap((master) => [
    ...master.recommended,
    ...master.entries.flatMap((entry) => [
      ...entry.recommended,
      ...(entry.admission.kind === "courses" ? coursesOf(entry.admission.rule) : []),
    ]),
  ]);

/** A course of a student's plan, with the year of study and the study periods it is in. */
export interface HeldCourse {
  code: string;
  /** Year of study in the whole degree, from 1. */
  year: number;
  periods: readonly StudyPeriod[];
}

/** The year of study a student applies for a master's programme in, in April, during its last study period. */
export const APPLICATION_YEAR = 3;
/** Study periods of the application year whose courses are completed and reported by the deadline in April. */
const COMPLETED_IN_TIME: readonly StudyPeriod[] = ["LP1", "LP2", "LP3"];

/** Whether a course of the first years ends within `periods` of the application year, or in a year before it. */
const endsWithin = (course: HeldCourse, periods: readonly StudyPeriod[]) =>
  course.year < APPLICATION_YEAR ||
  (course.year === APPLICATION_YEAR && course.periods.length > 0 && course.periods.every((p) => periods.includes(p)));

/**
 * The codes of the courses that count for admission by the application deadline in April of year 3. A course counts
 * once it is completed and reported, so it has to end before study period 4 of year 3. A course the guide marks with
 * an asterisk only needs a registration, so a course of study period 4 counts for it too.
 */
export function heldByDeadline(courses: readonly HeldCourse[]) {
  const codes = (periods: readonly StudyPeriod[]) => new Set(courses.filter((c) => endsWithin(c, periods)).map((c) => c.code));
  return { completed: codes(COMPLETED_IN_TIME), registered: codes(REGULAR_PERIODS) };
}
export type Held = ReturnType<typeof heldByDeadline>;

/** Whether a student holds a course the guide names, under any of its codes, in time. */
export const holds = (course: GuideCourse, held: Held) =>
  course.codes.some((code) => held.completed.has(code) || (course.registration && held.registered.has(code)));

/** Whether the courses a student holds in time meet a rule. */
export function meets(rule: CourseRule, held: Held): boolean {
  switch (rule.kind) {
    case "course":
      return holds(rule, held);
    case "all":
      return rule.of.every((r) => meets(r, held));
    case "any":
      return rule.of.some((r) => meets(r, held));
    case "atLeast":
      return rule.of.filter((r) => meets(r, held)).length >= rule.count;
  }
}

/** A course a plan offers in the first years, with its name, year of study and study periods. */
export interface OfferedCourse extends HeldCourse {
  name: string;
}

/**
 * The courses of a degree's first three years, each with its year of study and study periods: those a student takes,
 * compulsory or picked, and every course the plans offer. The programme's own `track` decides its compulsory courses.
 */
export function firstYears(years: readonly StudyYear[], picks: readonly StudyPick[], track: string | undefined) {
  const courses = years
    .filter(({ number }) => number <= APPLICATION_YEAR)
    .flatMap(({ number, plan, year }) =>
      (plan.years.find((y) => y.year === year)?.courses ?? []).map((course) => ({
        offered: { code: course.code, name: course.name, year: number, periods: course.periods },
        taken: takes(course, { plan: plan.code, year }, picks, track),
      })),
    );
  return { taken: courses.filter((c) => c.taken).map((c) => c.offered), offered: courses.map((c) => c.offered) };
}

/** Whether a course on its own meets one of the courses a rule names in time. */
export const countsTowards = (rule: CourseRule, course: HeldCourse) => coursesOf(rule).some((c) => holds(c, heldByDeadline([course])));

/** One of the requirements the guide joins with "samt", or the whole rule when it joins none. */
export interface Clause {
  rule: CourseRule;
  met: boolean;
  /** How many of the rules it asks for some of are met, or whether it is met, as 1 or 0 of 1. */
  have: number;
  need: number;
  /** The student's courses that meet it in time. */
  held: OfferedCourse[];
  /** The student's courses it names that end after the application deadline, so do not count. */
  late: OfferedCourse[];
  /** Courses of the first three years that would meet it in time, in the plans' order. Empty once it is met. */
  offered: OfferedCourse[];
}

/** What a student of a programme needs for a master's programme, checked against the student's courses where the guide names courses. */
export type Eligibility =
  { kind: "compulsory" } | { kind: "courses"; met: boolean; clauses: Clause[] } | { kind: "regulations" } | { kind: "words"; text: string };

/** Whether a course is one a rule names, under any of its codes, whether it counts in time or not. */
const names = (rule: CourseRule, course: HeldCourse) => coursesOf(rule).some((c) => c.codes.includes(course.code));

/** What an admission asks of a student who takes `taken` in the first three years, and which of `offered` would meet what is missing. */
export function eligibilityOf(
  admission: Admission,
  { taken, offered }: { taken: readonly OfferedCourse[]; offered: readonly OfferedCourse[] },
): Eligibility {
  if (admission.kind !== "courses") return admission;
  const inTime = heldByDeadline(taken);
  const terms = admission.rule.kind === "all" ? admission.rule.of : [admission.rule];
  const clauses = terms.map((rule): Clause => {
    const met = meets(rule, inTime);
    const held = taken.filter((course) => countsTowards(rule, course));
    const [have, need] = rule.kind === "atLeast" ? [rule.of.filter((r) => meets(r, inTime)).length, rule.count] : [Number(met), 1];
    return {
      rule,
      met,
      have,
      need,
      held,
      late: taken.filter((course) => names(rule, course) && !held.includes(course)),
      offered: met ? [] : offered.filter((course) => countsTowards(rule, course)),
    };
  });
  return { kind: "courses", met: clauses.every((c) => c.met), clauses };
}

/**
 * What the guide asks of a programme's students for a master's programme, or for the specialisation of it that
 * `track` names when that has requirements of its own. A programme the guide does not name for one of its master's
 * programmes goes by the admission regulations, as the guide says. Undefined for a master's programme it does not have.
 */
export function guideEntry(
  masters: readonly GuideMaster[],
  { master, track, programme }: { master: string; track?: string; programme: string },
) {
  const sections = masters.filter((m) => m.code === master);
  const section =
    sections.find((m) => m.specialisation !== null && track !== undefined && normalize(m.specialisation) === normalize(track)) ??
    sections.find((m) => m.specialisation === null);
  if (!section) return undefined;
  // The planner plans the five-year degree, so an entry for the three-year one does not apply.
  const entries = section.entries.filter((e) => e.programme === programme && e.path !== "threeYear");
  const entry = entries.find((e) => e.path === "fiveYear") ?? entries[0];
  return {
    specialisation: section.specialisation,
    admission: entry?.admission ?? ({ kind: "regulations" } as const),
    recommended: [...section.recommended, ...(entry?.recommended ?? [])],
  };
}

/**
 * How a guide fits students whose master's programme starts in `masterStart`, as a calendar year: it is their own, or
 * the newest one for an earlier year while theirs is not out, which can still change. Null for a guide of a later
 * year, which does not apply to them.
 */
export function guideFit(academicYear: string, masterStart: number) {
  const year = startYearOf(academicYear);
  if (year > masterStart) return null;
  return year === masterStart ? "own" : "earlier";
}

/** Everything of a student's plan that admission to a master's programme depends on. */
export interface AdmissionInput {
  programme: string;
  /** The calendar year the master's programme starts in. */
  masterStart: number;
  years: readonly StudyYear[];
  picks: readonly StudyPick[];
  /** The track of the programme's own years, which decides their compulsory courses. */
  track: string | undefined;
}

/**
 * What admission to a master's programme, or to the specialisation of it that `masterTrack` names, asks of a student's
 * plan, by the guide when it fits the year the master's programme starts in. Undefined when it does not, or when the
 * guide does not have the master's programme.
 */
export function admissionTo(
  guide: Pick<EligibilityFile, "academicYear" | "masters">,
  master: string,
  masterTrack: string | undefined,
  input: AdmissionInput,
) {
  const fit = guideFit(guide.academicYear, input.masterStart);
  const entry = fit && guideEntry(guide.masters, { master, track: masterTrack, programme: input.programme });
  if (!entry) return undefined;
  return { ...entry, fit, eligibility: eligibilityOf(entry.admission, firstYears(input.years, input.picks, input.track)) };
}
export type AdmissionCheck = NonNullable<ReturnType<typeof admissionTo>>;
