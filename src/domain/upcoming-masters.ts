import { z } from "zod";
import { normalize } from "./catalog.ts";
import type { Names } from "./names.ts";
import {
  comparePeriods,
  type DatedPlan,
  type PlanChoice,
  type PlanCourse,
  type ProgrammePlan,
  type UpcomingMasters,
} from "./programme-plans.ts";

const REQUIREMENTS = ["compulsory", "compulsoryElective", "elective"] as const;

/**
 * The committed file `data/upcoming-masters.json`: the master's programmes Chalmers has announced for an academic year
 * it has no plans for yet. Who they accredit comes from Chalmers' accreditation matrix. Their courses come from the
 * course list on each programme's page, by name, since the lists give no codes or study periods. A master's programme
 * that keeps its code has no course list, and follows its current plan.
 */
export const upcomingMastersFileSchema = z.object({
  academicYear: z.string(),
  matrix: z.url(),
  /** The day Chalmers last changed the matrix. */
  matrixUpdated: z.iso.date(),
  masters: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      courseList: z.url().nullable(),
      accreditations: z.array(
        z.object({
          programme: z.string(),
          degree: z.enum(["engineering", "architect"]),
          specialisations: z.array(z.string()),
        }),
      ),
      courses: z
        .array(
          z.object({
            name: z.string(),
            requirement: z.enum(REQUIREMENTS),
            /** The specialisation that lists the course, or null for the programme's own list. */
            track: z.string().nullable(),
            year: z.number().int().positive(),
            /** The list marks the course as preliminary. */
            preliminary: z.boolean(),
          }),
        )
        .nullable(),
    }),
  ),
});
export type UpcomingMastersFile = z.infer<typeof upcomingMastersFileSchema>;

/** One choice holds a master's programme's compulsory electives, since its course list says how many to choose of none of them. */
const COMPULSORY_ELECTIVES: PlanChoice = {
  id: 1,
  kind: "pick",
  text: "Choose some of the marked courses. The programme's course list does not say how many.",
  minCourses: null,
  minCredits: null,
};
const RULES = { compulsory: "O", compulsoryElective: "V", elective: "V" } as const;

/** Course names as the lists and the catalogue spell them alike: British spelling, "and" for "&", "AI" in full, no punctuation. */
const matchName = (name: string) =>
  normalize(name)
    .replaceAll("&", " and ")
    .replace(/(optimi|visuali|characteri)z/g, "$1s")
    .replaceAll("modeling", "modelling")
    .replaceAll("centered", "centred")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bai\b/g, "artificial intelligence")
    .trim();

/**
 * The master's programmes of `file` with a plan each, as students would follow them: each course on a course list
 * that `current` plans, in every study period it runs in now, with the rule the list gives it. A name the
 * catalogue has for several courses picks the one master's programmes plan most. Courses no current plan gives, such
 * as new ones and the thesis, are `unplanned`.
 */
export function upcomingMasters(
  file: UpcomingMastersFile,
  current: readonly DatedPlan[],
  courseNames: readonly (Names & { code: string })[],
) {
  const entries = Map.groupBy(
    current.flatMap((plan) => plan.years.flatMap((y) => y.courses.map((course) => ({ programme: plan.code, course })))),
    (e) => e.course.code,
  );
  const inMasters = (code: string) => (entries.get(code) ?? []).filter((e) => e.programme.startsWith("MP")).length;
  const codesByName = Map.groupBy(
    [...courseNames.map(({ code, en }) => ({ code, name: en })), ...[...entries.values()].map(([e]) => e!.course)],
    (c) => matchName(c.name),
  );
  const codeOf = (name: string) =>
    [...new Set((codesByName.get(matchName(name)) ?? []).map((c) => c.code))]
      .filter((code) => entries.has(code))
      .toSorted((a, b) => inMasters(b) - inMasters(a) || a.localeCompare(b))[0];
  /** The course's rounds in the current plans, one per set of study periods. */
  const roundsOf = (code: string) =>
    [...new Map((entries.get(code) ?? []).map(({ course }) => [course.periods.join(), course])).values()].toSorted((a, b) =>
      comparePeriods(a.periods, b.periods),
    );
  const currentPlans = new Map(current.map(({ academicYear: _, ...plan }) => [plan.code, plan]));

  const plans: ProgrammePlan[] = [];
  const masters: UpcomingMasters["masters"] = {};
  for (const master of file.masters) {
    if (!master.courses) {
      const plan = currentPlans.get(master.code);
      if (plan) plans.push(plan);
      masters[master.code] = { courseList: null, unplanned: [] };
      continue;
    }
    const matched = master.courses.map((listed) => ({ listed, code: codeOf(listed.name) }));
    const years = [...new Set(master.courses.map((c) => c.year))].toSorted((a, b) => a - b);
    plans.push({
      code: master.code,
      name: master.name,
      choices: master.courses.some((c) => c.requirement === "compulsoryElective") ? [COMPULSORY_ELECTIVES] : [],
      requirements: [],
      masters: [],
      prerequisites: [],
      years: years.map((year) => ({
        year,
        courses: matched.flatMap(({ listed, code }): PlanCourse[] =>
          listed.year === year && code
            ? roundsOf(code).map((round) => ({
                ...round,
                rule: RULES[listed.requirement],
                track: listed.track,
                choices: listed.requirement === "compulsoryElective" ? [COMPULSORY_ELECTIVES.id] : [],
              }))
            : [],
        ),
      })),
    });
    masters[master.code] = {
      courseList: master.courseList,
      unplanned: years.flatMap((year) => {
        const names = matched
          .filter(({ listed, code }) => listed.year === year && !code)
          .map(({ listed }) => (listed.preliminary ? `${listed.name} (preliminary)` : listed.name));
        return names.length ? [{ year, names: [...new Set(names)] }] : [];
      }),
    };
  }

  const accreditations = Map.groupBy(
    file.masters.flatMap(({ code, accreditations: rows }) =>
      rows.map(({ programme, specialisations }) => ({ programme, code, specialisations })),
    ),
    (a) => a.programme,
  );
  const info: UpcomingMasters = {
    academicYear: file.academicYear,
    matrix: file.matrix,
    accreditations: Object.fromEntries(
      [...accreditations].map(([programme, rows]) => [programme, rows.map(({ programme: _, ...a }) => a)]),
    ),
    masters,
  };
  return { plans, info };
}
