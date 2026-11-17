import { describe, expect, it } from "vitest";
import {
  checkPrerequisites,
  degreeCourses,
  endsBefore,
  missingOf,
  prerequisiteLookup,
  subjectsOf,
  type DegreeCourse,
} from "./prerequisite-check.ts";
import type { Prerequisite, PrerequisiteSnapshot } from "./prerequisites.ts";
import { roundKey, type PlanCourse, type ProgrammePlan, type StudyPeriod } from "./programme-plans.ts";

const edge = (to: string, source: string, overrides: Partial<Prerequisite> = {}): Prerequisite => ({
  to,
  strength: "required",
  via: to.startsWith("topic:") ? "topic" : "code",
  credits: null,
  writtenAs: null,
  source,
  ...overrides,
});

const syllabus = (code: string, name: string, replaces: string[] = []) => ({
  code,
  name,
  level: "First-cycle",
  credits: 7.5,
  replaces,
  programmes: [],
  edges: [],
});

const snapshot: PrerequisiteSnapshot = {
  academicYear: "2026/2027",
  names: {},
  programmes: [],
  courses: [
    syllabus("TMV170", "Calculus"),
    syllabus("TMV216", "Linear algebra"),
    syllabus("TMV211", "Introduction to discrete mathematics", ["TMV210"]),
    syllabus("MVE055", "Mathematical statistics and discrete mathematics"),
    syllabus("TDA555", "Introduction to functional programming"),
    syllabus("DAT044", "Introduction to object oriented programming"),
    syllabus("DAT038", "Data structures and algorithms"),
    syllabus("LMA017", "Mathematical analysis in several variables"),
    syllabus("MVE655", "Multivariable analysis"),
    syllabus("EDA452", "Introduction to computer engineering"),
  ],
};
const lookup = prerequisiteLookup(snapshot);

const course = (code: string, year: number, periods: StudyPeriod[]): DegreeCourse => ({
  code,
  name: snapshot.courses.find((c) => c.code === code)?.name ?? code,
  credits: 7.5,
  year,
  periods,
});

const firstYears = [
  course("TMV170", 1, ["LP1"]),
  course("TDA555", 1, ["LP1"]),
  course("TMV211", 1, ["LP2"]),
  course("DAT044", 1, ["LP2"]),
  course("TMV216", 1, ["LP3"]),
  course("DAT038", 2, ["LP2"]),
];

/** Each group of a check as the nodes it asks for, whether the courses meet it, and the codes that would. */
const summary = (groups: ReturnType<typeof checkPrerequisites>) =>
  groups.map((g) => ({
    nodes: g.items.map((item) =>
      item.node.kind === "topic" ? item.node.id : item.node.kind === "unknown" ? item.node.node : item.node.code,
    ),
    strength: g.strength,
    met: g.met,
    fixes: g.fixes.map((c) => c.code),
  }));

describe("subjectsOf", () => {
  it("counts a course of a narrower subject towards the broader one", () => {
    expect([...subjectsOf("TMV216", "Linear algebra")]).toEqual(["linear-algebra", "mathematics"]);
    expect([...subjectsOf("TDA555", "Introduction to functional programming")]).toEqual(["functional-programming", "programming"]);
  });

  it("counts every course of a mathematics department as mathematics", () => {
    expect([...subjectsOf("MVE370", "Mathematics and society")]).toEqual(["mathematics"]);
    expect([...subjectsOf("TMV029", "Finite automata and formal languages")]).toEqual(["mathematics"]);
  });

  it("reads names with runs of spaces", () => {
    expect(subjectsOf("EDA482", "Machine oriented  programming").has("machine-oriented-programming")).toBe(true);
  });
});

describe("checkPrerequisites", () => {
  const algorithms =
    "Mathematics (at least 15cr including Calculus (at least 6 cr.) and Linear Algebra (at least 6 cr.)), Programming in a General-Purpose Language (at least 7,5 cr.) (e.g. C/C++/Java/Haskell or similar), Algorithms and/or Data Structures (at least 5 cr.) and one of the following courses: Discrete Mathematics or Mathematical Statistics or Probability Theory";
  const algorithmsEdges = [
    edge("topic:mathematics", algorithms, { credits: 15 }),
    edge("topic:linear-algebra", algorithms, { credits: 6 }),
    edge("topic:calculus", algorithms, { credits: 6 }),
    edge("topic:probability", algorithms),
    edge("topic:statistics", algorithms),
    edge("topic:discrete-mathematics", algorithms),
    edge("topic:programming", algorithms, { credits: 7.5 }),
    edge("topic:algorithms", algorithms, { credits: 5 }),
  ];

  it("requires each subject a list joins with commas and 'and', and one of those 'or' joins", () => {
    const groups = checkPrerequisites(algorithmsEdges, lookup, { taken: firstYears, offered: firstYears, programmes: ["TKDAT"] });
    expect(summary(groups)).toEqual([
      { nodes: ["mathematics"], strength: "required", met: true, fixes: [] },
      { nodes: ["calculus"], strength: "required", met: true, fixes: [] },
      { nodes: ["linear-algebra"], strength: "required", met: true, fixes: [] },
      { nodes: ["programming"], strength: "required", met: true, fixes: [] },
      { nodes: ["algorithms"], strength: "required", met: true, fixes: [] },
      { nodes: ["discrete-mathematics", "statistics", "probability"], strength: "required", met: true, fixes: [] },
    ]);
    expect(groups[0]?.items[0]?.by.map((c) => c.code)).toEqual(["TMV170", "TMV211", "TMV216"]);
  });

  it("adds up credits of a subject, and offers courses of it when there are too few", () => {
    const taken = firstYears.filter((c) => c.code !== "TMV216" && c.code !== "TMV211");
    const linear = course("TMV216", 1, ["LP3"]);
    const statistics = course("MVE055", 2, ["LP3"]);
    const [mathematics, , linearAlgebra] = checkPrerequisites(algorithmsEdges, lookup, {
      taken,
      offered: [...taken, linear, statistics],
      programmes: [],
    });
    expect(mathematics).toMatchObject({ met: false, fixes: [linear, statistics] });
    expect(mathematics?.items[0]).toMatchObject({ credits: 15, by: [taken[0]], met: false });
    expect(linearAlgebra).toMatchObject({ met: false, fixes: [linear] });
  });

  it("lets the examples after 'e.g.' stand in for the subject they illustrate", () => {
    const text = "at least 15 credits in programming, e.g., TDA548, TDA553, TDA367, or equivalent,";
    const edges = [edge("TDA548", text), edge("TDA553", text), edge("TDA367", text), edge("topic:programming", text, { credits: 15 })];
    const groups = checkPrerequisites(edges, lookup, { taken: firstYears, offered: firstYears, programmes: [] });
    expect(summary(groups)).toEqual([{ nodes: ["programming", "TDA548", "TDA553", "TDA367"], strength: "required", met: true, fixes: [] }]);
  });

  it("reads a course code and its title as one course, met by the course that replaced it", () => {
    const text =
      "The courses TDA452 Functional programming, TMV210 Introduction to discrete mathematics and at least one of the courses DAT151 Programming language technology or DAT121 Programming paradigms or equivalent are required.";
    const edges = [
      edge("TDA452", text),
      edge("TMV211", text, { writtenAs: "TMV210" }),
      edge("DAT151", text),
      edge("DAT121", text),
      edge("topic:functional-programming", text),
    ];
    const groups = checkPrerequisites(edges, lookup, { taken: firstYears, offered: firstYears, programmes: [] });
    expect(summary(groups)).toEqual([
      { nodes: ["TDA452", "functional-programming"], strength: "required", met: true, fixes: [] },
      { nodes: ["TMV211"], strength: "required", met: true, fixes: [] },
      { nodes: ["DAT151", "DAT121"], strength: "required", met: false, fixes: [] },
    ]);
  });

  it("meets a programme by being in it, and lists recommendations after requirements", () => {
    const required = "A bachelor's degree from TKDAT or the equivalent.";
    const recommended = "Preferable course experience: Multivariable Analysis.";
    const edges = [
      edge("topic:multivariable-calculus", recommended, { strength: "recommended" }),
      edge("programme:TKDAT", required, { via: "programme" }),
    ];
    const offered = [...firstYears, course("LMA017", 3, ["LP1"]), course("MVE655", 3, ["LP2"])];
    const groups = checkPrerequisites(edges, lookup, { taken: firstYears, offered, programmes: ["TKDAT"] });
    expect(summary(groups)).toEqual([
      { nodes: ["TKDAT"], strength: "required", met: true, fixes: [] },
      { nodes: ["multivariable-calculus"], strength: "recommended", met: false, fixes: ["LMA017", "MVE655"] },
    ]);
    expect(missingOf(groups)).toEqual([]);
  });
});

const planCourse = (code: string, rule: string, periods: StudyPeriod[]): PlanCourse => ({
  code,
  name: code,
  credits: 7.5,
  periods,
  periodCredits: periods.map(() => 7.5 / periods.length),
  rule,
  track: null,
  block: null,
  choices: [],
  themes: [],
  examiners: [],
  modules: [],
});

describe("degreeCourses", () => {
  const plan: ProgrammePlan = {
    code: "TKDAT",
    name: "Computer science and engineering",
    choices: [],
    requirements: [],
    masters: [],
    prerequisites: [],
    years: [
      { year: 1, courses: [planCourse("TMV216", "O", ["LP3"]), planCourse("TMV170", "O", ["LP1"])] },
      { year: 2, courses: [planCourse("TDA357", "V", ["LP3"]), planCourse("DAT038", "V", ["LP2", "LP3"])] },
    ],
  };
  const years = [
    { number: 1, plan, year: 1 },
    { number: 2, plan, year: 2 },
  ];

  it("takes the compulsory courses and the picks, in the order of the study periods", () => {
    const picks = [{ number: 2, programme: "TKDAT", year: 2, key: roundKey("DAT038", ["LP2", "LP3"]) }];
    const { taken, offered } = degreeCourses(years, picks);
    expect(taken.map((c) => c.code)).toEqual(["TMV170", "TMV216", "DAT038"]);
    expect(offered.map((c) => c.code)).toEqual(["TMV170", "TMV216", "DAT038", "TDA357"]);
  });

  it("counts a course as before another only once all its study periods have ended", () => {
    const { offered } = degreeCourses(years, []);
    const before = offered.filter((c) => endsBefore(c, { year: 2, period: "LP3" })).map((c) => c.code);
    expect(before).toEqual(["TMV170", "TMV216"]);
  });
});
