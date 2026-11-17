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

/** An edge asked for on its own, unless `overrides` puts it in a group. */
const edge = (to: string, overrides: Partial<Prerequisite> = {}): Prerequisite => ({
  to,
  strength: "required",
  via: to.startsWith("topic:") ? "topic" : "code",
  credits: null,
  writtenAs: null,
  group: null,
  source: `About ${to}.`,
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
    syllabus("DAT495", "Data structures and algorithms"),
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
  const algorithmsEdges = [
    edge("topic:mathematics", { credits: 15 }),
    edge("topic:calculus", { credits: 6 }),
    edge("topic:linear-algebra", { credits: 6 }),
    edge("topic:programming", { credits: 7.5 }),
    edge("topic:algorithms", { credits: 5 }),
    edge("topic:discrete-mathematics", { group: 1 }),
    edge("topic:statistics", { group: 1 }),
    edge("topic:probability", { group: 1 }),
  ];

  it("asks for each edge on its own, and for one edge of a group, with the courses that meet them", () => {
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

  it("meets a course by the course that replaced it, and offers every course of a group not met", () => {
    const edges = [
      edge("TMV211", { writtenAs: "TMV210" }),
      edge("DAT151", { group: 1 }),
      edge("topic:concurrent-programming", { group: 1 }),
    ];
    const taken = [course("TMV210", 1, ["LP2"])];
    const offered = [...taken, course("DAT151", 2, ["LP1"]), course("TDA384", 2, ["LP3"])];
    const named = { ...offered[2]!, name: "Principles of concurrent programming" };
    const groups = checkPrerequisites(edges, lookup, { taken, offered: [offered[0]!, offered[1]!, named], programmes: [] });
    expect(summary(groups)).toEqual([
      { nodes: ["TMV211"], strength: "required", met: true, fixes: [] },
      { nodes: ["DAT151", "concurrent-programming"], strength: "required", met: false, fixes: ["DAT151", "TDA384"] },
    ]);
  });

  it("meets a course by one of the same name that another programme gives under its own code", () => {
    const groups = checkPrerequisites([edge("DAT495")], lookup, { taken: firstYears, offered: firstYears, programmes: [] });
    expect(groups[0]).toMatchObject({ met: true, items: [{ by: [firstYears[5]] }] });
  });

  it("meets a programme by being in it, and lists recommendations after requirements", () => {
    const edges = [
      edge("topic:multivariable-calculus", { strength: "recommended" }),
      edge("programme:TKDAT", { via: "programme" }),
      edge("TDA357", { strength: "excluded" }),
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
