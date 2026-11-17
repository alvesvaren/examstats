import { describe, expect, it } from "vitest";
import type { DatedPlan, PlanCourse } from "./programme-plans.ts";
import { upcomingMasters, type UpcomingMastersFile } from "./upcoming-masters.ts";

const course = (code: string, name: string, overrides: Partial<PlanCourse> = {}): PlanCourse => ({
  code,
  name,
  credits: 7.5,
  periods: ["LP1"],
  periodCredits: [7.5],
  rule: "V",
  track: null,
  block: "A",
  choices: [],
  themes: [],
  examiners: ["Ada Lovelace"],
  modules: [{ code: "0101", credits: 7.5 }],
  ...overrides,
});

const plan = (code: string, courses: PlanCourse[]): DatedPlan => ({
  academicYear: "2026/2027",
  code,
  name: `${code} name`,
  choices: [],
  requirements: [],
  masters: [],
  prerequisites: [],
  years: [{ year: 1, courses }],
});

const current = [
  plan("MPALG", [
    course("DAT400", "Algorithms, advanced course"),
    course("DAT400", "Algorithms, advanced course", { periods: ["LP3"], periodCredits: [7.5] }),
    course("TMA947", "Nonlinear optimization", { periods: ["LP2"] }),
  ]),
  plan("TKDAT", [course("TDA101", "Complexity"), course("DAT222", "Complexity")]),
  plan("MPCSC", [course("DAT222", "Complexity")]),
  plan("MPBIO", [course("KBT100", "Biotechnology")]),
];

const listed = (name: string, overrides: Partial<NonNullable<UpcomingMastersFile["masters"][number]["courses"]>[number]> = {}) => ({
  name,
  requirement: "elective" as const,
  track: null,
  year: 1,
  preliminary: false,
  ...overrides,
});

const file: UpcomingMastersFile = {
  academicYear: "2027/2028",
  matrix: "https://example.com/matrix.xlsx",
  matrixUpdated: "2026-10-08",
  masters: [
    {
      code: "MPCOS",
      name: "Computer Science",
      courseList: "https://example.com/mpcos.pdf",
      accreditations: [
        { programme: "TKDAT", degree: "engineering", specialisations: [] },
        { programme: "TKELT", degree: "engineering", specialisations: ["Algorithms"] },
      ],
      courses: [
        listed("Algorithms advanced course", { requirement: "compulsory" }),
        listed("Nonlinear optimisation", { requirement: "compulsoryElective", track: "Algorithms" }),
        listed("Complexity", { year: 2 }),
        listed("Mathematics for AI", { preliminary: true }),
        listed("Master’s thesis", { requirement: "compulsory", year: 2 }),
      ],
    },
    {
      code: "MPBIO",
      name: "Biotechnology",
      courseList: null,
      accreditations: [{ programme: "TKDAT", degree: "engineering", specialisations: [] }],
      courses: null,
    },
  ],
};

describe("upcomingMasters", () => {
  const { plans, info } = upcomingMasters(file, current, [{ code: "TMA947", en: "Nonlinear optimisation", sv: "Ickelinjär optimering" }]);
  const mpcos = plans.find((p) => p.code === "MPCOS")!;
  const yearOf = (year: number) => mpcos.years.find((y) => y.year === year)!.courses;

  it("places each listed course in every study period it runs in now, by its name in either spelling", () => {
    expect(yearOf(1).map((c) => [c.code, c.periods, c.rule, c.track])).toEqual([
      ["DAT400", ["LP1"], "O", null],
      ["DAT400", ["LP3"], "O", null],
      ["TMA947", ["LP2"], "V", "Algorithms"],
    ]);
    expect(yearOf(1)[0]).toMatchObject({ block: "A", examiners: ["Ada Lovelace"], credits: 7.5 });
  });

  it("marks the compulsory electives with one choice that names no number", () => {
    expect(mpcos.choices).toEqual([expect.objectContaining({ kind: "pick", minCourses: null, minCredits: null })]);
    expect(yearOf(1).find((c) => c.code === "TMA947")!.choices).toEqual([mpcos.choices[0]!.id]);
  });

  it("picks the course that master's programmes plan most when a name has several", () => {
    expect(yearOf(2).map((c) => c.code)).toEqual(["DAT222"]);
  });

  it("lists the courses no current plan gives, by year", () => {
    expect(info.masters.MPCOS).toEqual({
      courseList: "https://example.com/mpcos.pdf",
      unplanned: [
        { year: 1, names: ["Mathematics for AI (preliminary)"] },
        { year: 2, names: ["Master’s thesis"] },
      ],
    });
  });

  it("follows the current plan of a master's programme without a course list", () => {
    expect(plans.find((p) => p.code === "MPBIO")).toEqual(expect.objectContaining({ code: "MPBIO", years: current[3]!.years }));
    expect(plans.find((p) => p.code === "MPBIO")).not.toHaveProperty("academicYear");
  });

  it("lists the master's programmes of each programme, with the specialisations the degree needs", () => {
    expect(info.accreditations).toEqual({
      TKDAT: [
        { code: "MPCOS", specialisations: [] },
        { code: "MPBIO", specialisations: [] },
      ],
      TKELT: [{ code: "MPCOS", specialisations: ["Algorithms"] }],
    });
  });
});
