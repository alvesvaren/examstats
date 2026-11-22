import { z } from "zod";
import { normalize, type Names } from "./names.ts";
import {
  comparePeriods,
  THESIS_RULE,
  type DatedPlan,
  type PlanChoice,
  type PlanCourse,
  type ProgrammePlan,
  tracksOf,
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

/** One choice holds all of a master's programme's compulsory electives, since its course list never says how many to choose. */
const COMPULSORY_ELECTIVES: PlanChoice = {
  id: 1,
  kind: "pick",
  text: null,
  minCourses: null,
  minCredits: null,
};
const RULES = { compulsory: "O", compulsoryElective: "V", elective: "V" } as const;
/** The lists mark a thesis as compulsory. It gets the thesis rule instead, so the planner fixes it in the year only when it can be done one way. */
const namesThesis = (name: string) => /\bthesis\b/i.test(name);

/**
 * Course names as the lists and the catalogue spell them alike: British spelling, "and" for "&", "AI" in full, and
 * without spaces or punctuation, since one writes "real-time" or "nonlinear" where the other writes "real time" or
 * "non-linear".
 */
const matchName = (name: string) =>
  normalize(name)
    .replaceAll("&", " and ")
    .replace(/(optimi|visuali|characteri)z/g, "$1s")
    .replaceAll("modeling", "modelling")
    .replaceAll("centered", "centred")
    .replace(/\bai\b/g, "artificial intelligence")
    .replace(/[^a-z0-9]+/g, "");

/** A code for a course only a course list names: its name in lower case with dashes. Chalmers' codes have no dashes, so the two never meet. */
const pendingCode = (name: string) =>
  `new-${normalize(name)
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

/**
 * The track of `plan` that a specialisation in the matrix names: the one of the same name in either spelling, or else
 * the only one whose name it holds, since the matrix can put the subject first, as in "Space Geodesy and Remote
 * Sensing" for "Geodesy and remote sensing". The planner greys out the other tracks, so a name that matches none throws.
 */
function trackNamed(specialisation: string, plan: ProgrammePlan | undefined) {
  const tracks = tracksOf(plan?.years.flatMap((y) => y.courses) ?? []);
  const name = matchName(specialisation);
  const same = tracks.find((track) => matchName(track) === name);
  const held = tracks.filter((track) => name.includes(matchName(track)));
  const track = same ?? (held.length === 1 ? held[0] : undefined);
  if (track === undefined) throw new Error(`${plan?.code ?? "A master's programme"} plans no specialisation "${specialisation}"`);
  return track;
}

/** What a plan knows of a course only a course list names. */
const UNKNOWN = { credits: 0, periods: [], periodCredits: [], block: null, themes: [], examiners: [], modules: [], seats: null };

/**
 * The master's programmes of `file` with a plan each, as students would follow them: each course on a course list
 * that `current` plans, in every study period it runs in now, with the rule the list gives it. A name the
 * catalogue has for several courses picks the one master's programmes plan most. A course no current plan gives, such
 * as a new one, is pending: only its name is known, so it has a made-up code and no study periods or credits.
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
      masters[master.code] = { courseList: null };
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
        courses: matched.flatMap(({ listed, code }): PlanCourse[] => {
          if (listed.year !== year) return [];
          const placement = {
            rule: namesThesis(listed.name) ? THESIS_RULE : RULES[listed.requirement],
            track: listed.track,
            choices: listed.requirement === "compulsoryElective" ? [COMPULSORY_ELECTIVES.id] : [],
            ...(listed.preliminary && { preliminary: true as const }),
          };
          if (code) return roundsOf(code).map((round) => ({ ...round, ...placement }));
          return [{ code: pendingCode(listed.name), name: listed.name, ...UNKNOWN, ...placement, pending: true }];
        }),
      })),
    });
    masters[master.code] = { courseList: master.courseList };
  }

  const plansByCode = new Map(plans.map((plan) => [plan.code, plan]));
  // The matrix and the course lists spell some specialisations differently, and the planner shows those of the plan.
  const accreditations = Map.groupBy(
    file.masters.flatMap(({ code, accreditations: rows }) =>
      rows.map(({ programme, specialisations }) => ({
        programme,
        code,
        specialisations: specialisations.map((s) => trackNamed(s, plansByCode.get(code))),
      })),
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
