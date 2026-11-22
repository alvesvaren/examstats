import { z } from "zod";
import { REGULAR_PERIODS, type StudyPeriod } from "./programme-plans.ts";

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

/** Every course a rule names, in the guide's order. */
export const coursesOf = (rule: CourseRule): GuideCourse[] => (rule.kind === "course" ? [rule] : rule.of.flatMap(coursesOf));

/** A course of a student's plan, with the year of study and the study periods it is in. */
export interface HeldCourse {
  code: string;
  /** Year of study in the whole degree, from 1. */
  year: number;
  periods: readonly StudyPeriod[];
}

/** The year of study a student applies for a master's programme in, in April, during its last study period. */
const APPLICATION_YEAR = 3;
const LAST_PERIOD = "LP4";
const regular = (period: StudyPeriod) => (REGULAR_PERIODS as readonly StudyPeriod[]).includes(period);

/**
 * The codes of the courses that count for admission by the application deadline in April of year 3. A course counts
 * once it is completed and reported, so it has to end before study period 4 of year 3. A course the guide marks with
 * an asterisk only needs a registration, so any course of the first three years' study periods counts for it.
 */
export function heldByDeadline(courses: readonly HeldCourse[]) {
  const registered = courses.filter((c) => c.year <= APPLICATION_YEAR && c.periods.some(regular));
  const completed = registered.filter((c) => c.year < APPLICATION_YEAR || c.periods.every((p) => regular(p) && p !== LAST_PERIOD));
  return { completed: new Set(completed.map((c) => c.code)), registered: new Set(registered.map((c) => c.code)) };
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
