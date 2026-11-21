import { describe, expect, it } from "vitest";
import { openRequirements, pickProgress, requirementProgress } from "./degree.ts";
import type { PlanChoice, PlanCourse, PlanRequirement, ProgrammePlan } from "./programme-plans.ts";

const pickTwo: PlanChoice = { id: 1, kind: "pick", text: null, minCourses: 2, minCredits: null };
const pickCredits: PlanChoice = { id: 2, kind: "pick", text: null, minCourses: null, minCredits: 15 };

/** A plan entry of 7.5 credits in LP1 under a rule, with the credits it gives in themes. */
const planCourse = (code: string, rule: string, themes: PlanCourse["themes"] = []): PlanCourse => ({
  code,
  name: `${code} name`,
  credits: 7.5,
  periods: ["LP1"],
  periodCredits: [7.5],
  rule,
  track: null,
  block: null,
  choices: [],
  themes,
  examiners: [],
  modules: [],
  seats: null,
});

describe("degree requirements", () => {
  const mts: PlanRequirement = { kind: "theme", theme: "mts", minCredits: 7.5 };
  const environment: PlanRequirement = { kind: "theme", theme: "environment", minCredits: 7.5 };
  const science: PlanRequirement = { kind: "courses", courses: ["FFY621", "TIF223", "FFR105"], minCourses: 1 };
  const interfaces = planCourse("DAT216", "O", [{ theme: "mts", credits: 3 }]);
  const agile = planCourse("DAT257", "O", [{ theme: "mts", credits: 1.5 }]);
  const sustainability = planCourse("TEK830", "O", [{ theme: "environment", credits: 7.5 }]);
  const games = planCourse("DAT510", "V", [{ theme: "mts", credits: 3 }]);
  const physics = planCourse("TIF223", "V", [{ theme: "environment", credits: 1.5 }]);

  it("counts the credits a course gives in the theme, not the credits of the course", () => {
    expect(requirementProgress(mts, [interfaces, agile, physics])).toEqual({ have: 4.5, need: 7.5, unit: "credits", done: false });
    expect(requirementProgress(mts, [interfaces, agile, games])).toEqual({ have: 7.5, need: 7.5, unit: "credits", done: true });
  });

  it("counts the courses of a list the degree needs some of", () => {
    expect(requirementProgress(science, [interfaces])).toEqual({ have: 0, need: 1, unit: "courses", done: false });
    expect(requirementProgress(science, [interfaces, physics])).toEqual({ have: 1, need: 1, unit: "courses", done: true });
  });

  const tkite: ProgrammePlan = {
    code: "TKITE",
    name: "Software Engineering",
    choices: [],
    requirements: [environment, mts, science],
    masters: ["MPSOF"],
    prerequisites: [],
    years: [
      { year: 1, courses: [interfaces] },
      { year: 2, courses: [agile, games] },
      { year: 3, courses: [sustainability, physics] },
    ],
  };

  it("keeps the requirements that the compulsory courses do not meet on their own", () => {
    expect(openRequirements([tkite])).toEqual([mts, science]);
  });

  it("keeps a requirement the programme's compulsory courses do not meet, also when the master's programme's meet it, so it shows as met", () => {
    const ethics = planCourse("TDA602", "O", [{ theme: "mts", credits: 3 }]);
    const mpsof: ProgrammePlan = { ...tkite, code: "MPSOF", requirements: [], masters: [], years: [{ year: 1, courses: [ethics] }] };
    expect(openRequirements([tkite, mpsof])).toEqual([mts, science]);
    expect(requirementProgress(mts, [interfaces, agile, ethics])).toMatchObject({ have: 7.5, done: true });
  });
});

/** An elective in the given choices of its programme. */
const withChoices = (code: string, choices: number[]) => ({ ...planCourse(code, "V"), choices });

describe("pickProgress", () => {
  const tkdat: ProgrammePlan = {
    code: "TKDAT",
    name: "Computer Science and Engineering",
    choices: [pickTwo, pickCredits],
    requirements: [],
    masters: [],
    prerequisites: [],
    years: [
      { year: 2, courses: [withChoices("TDA357", [])] },
      {
        year: 3,
        courses: [withChoices("TDA357", [pickTwo.id]), withChoices("A", [pickTwo.id, pickCredits.id]), withChoices("B", [pickCredits.id])],
      },
    ],
  };

  it("counts the planned courses of a choice that asks for a number of courses", () => {
    expect(pickProgress(pickTwo, tkdat, [withChoices("A", [1]), withChoices("C", [])])).toEqual({
      have: 1,
      need: 2,
      unit: "courses",
      done: false,
    });
  });

  it("counts credits for a choice that asks for credits", () => {
    expect(pickProgress(pickCredits, tkdat, [withChoices("A", []), withChoices("B", [])])).toEqual({
      have: 15,
      need: 15,
      unit: "credits",
      done: true,
    });
  });

  it("counts a course of the choice planned in a year where the plan lists it outside the choice", () => {
    const databasesInYear2 = withChoices("TDA357", []);
    expect(pickProgress(pickTwo, tkdat, [databasesInYear2, withChoices("A", [])])).toMatchObject({ have: 2, done: true });
  });
});
