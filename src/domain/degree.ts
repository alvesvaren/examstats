import { plannedCourses, type PlanChoice, type PlanCourse, type PlanRequirement, type ProgrammePlan } from "./programme-plans.ts";

export const tenths = (credits: number) => Math.round(credits * 10) / 10;

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
