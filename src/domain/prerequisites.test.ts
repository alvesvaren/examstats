import { describe, expect, it } from "vitest";
import type { NamesFile } from "./names.ts";
import { parsePrerequisites, prerequisiteIndex, prerequisiteSnapshot, type CourseSyllabus, type Prerequisite } from "./prerequisites.ts";

const syllabus = (code: string, prerequisites: string, overrides: Partial<CourseSyllabus> = {}): CourseSyllabus => ({
  code,
  name: code,
  level: "Second-cycle",
  credits: 7.5,
  replaces: [],
  prerequisites,
  ...overrides,
});

const named = (en: string) => ({ en, sv: en });

const names: NamesFile = {
  programmes: {
    MPSYS: named("Systems, control and mechatronics"),
    MPALG: named("Computer science - algorithms, languages and logic"),
    TKMAS: named("Mechanical engineering"),
    MPSCM: named("Supply chain management"),
  },
  courses: [
    { code: "SSY285", ...named("Linear control system design") },
    { code: "TDA367", ...named("Object-oriented programming project") },
    { code: "EEK137", ...named("Environmental engineering") },
    { code: "TMV166", ...named("Linear algebra") },
    { code: "TMV216", ...named("Linear algebra") },
    { code: "DAT340", ...named("Applied machine learning") },
    { code: "DAT341", ...named("Applied machine learning") },
    { code: "TDA233", ...named("Algorithms for machine learning and inference") },
    { code: "DAT420", ...named("Human - computer interaction") },
    { code: "DAT610", ...named("Human - computer interaction") },
    { code: "DAT050", ...named("Object oriented programming") },
    { code: "TDA548", ...named("Introductory software development") },
  ],
};

const syllabi = [
  syllabus("DAT341", "", { replaces: ["DAT340"] }),
  syllabus("TDA233", ""),
  syllabus("DAT610", "", { name: "Human - computer interaction" }),
];

const parse = (text: string, from = "XYZ100") => parsePrerequisites(from, text, prerequisiteIndex(syllabi, names));

/** The parsed edges with only the fields a test is about. */
const summary = (edges: readonly Prerequisite[]) => edges.map(({ to, strength, via, credits }) => ({ to, strength, via, credits }));

describe("parsePrerequisites", () => {
  it("finds course codes, credit counts and subjects in a sentence", () => {
    const edges = parse(
      "The course requires at least 7.5 credits of programming, 7.5 credits of probability theory or statistics, and a first course in machine learning, such as DAT340, TDA233 or MVE440.",
    );
    expect(summary(edges)).toEqual([
      { to: "DAT341", strength: "required", via: "code", credits: null },
      { to: "TDA233", strength: "required", via: "code", credits: null },
      { to: "MVE440", strength: "required", via: "code", credits: null },
      { to: "topic:probability", strength: "required", via: "topic", credits: 7.5 },
      { to: "topic:statistics", strength: "required", via: "topic", credits: 7.5 },
      { to: "topic:programming", strength: "required", via: "topic", credits: 7.5 },
      { to: "topic:machine-learning", strength: "required", via: "topic", credits: null },
    ]);
  });

  it("points an old course code at the course that replaced it", () => {
    expect(parse("A first course such as DAT340.")).toMatchObject([{ to: "DAT341", writtenAs: "DAT340" }]);
  });

  it("marks recommended sentences, and lines after a heading that recommends them", () => {
    const edges = parse(
      [
        "The course Learning in practice (MVE375). Recommended prerequisite is the course MVE370.",
        "The following are also recommended:",
        "- familiarity with functional programming",
      ].join("\n"),
    );
    expect(summary(edges)).toEqual([
      { to: "MVE375", strength: "required", via: "code", credits: null },
      { to: "MVE370", strength: "recommended", via: "code", credits: null },
      { to: "topic:functional-programming", strength: "recommended", via: "topic", credits: null },
    ]);
  });

  it("points an old course code at the course given this year under its name", () => {
    expect(parse("The course DAT420 or equivalent.")).toMatchObject([{ to: "DAT610", writtenAs: "DAT420" }]);
  });

  it("marks a course that cannot be in the same degree as excluded", () => {
    const edges = parse(
      "The course can not be included in a degree together with the course TIN321 Programming languages. The course cannot be included in a degree which contains (or is based on another degree which contains) the course DAT345.",
    );
    expect(summary(edges)).toEqual([
      { to: "TIN321", strength: "excluded", via: "code", credits: null },
      { to: "DAT345", strength: "excluded", via: "code", credits: null },
    ]);
  });

  it("lets a recommendation reach the phrases of its sentence unless another phrase requires", () => {
    const edges = parse(
      [
        "Recommended: courses in hydraulics, hydrology.",
        "Experience of Python programming is essential, prior experience with machine learning is highly recommended.",
      ].join("\n"),
    );
    expect(edges.map(({ to, strength }) => [to, strength])).toEqual([
      ["topic:hydraulics", "recommended"],
      ["topic:programming", "required"],
      ["topic:machine-learning", "recommended"],
      ["topic:python", "required"],
    ]);
  });

  it("keeps a recommendation in brackets or after 'preferably' to its own phrase", () => {
    const edges = parse(
      [
        "7.5 credits of programming (Python experience desirable but not absolutely required).",
        "Good knowledge of calculus, preferably in Matlab.",
        "Linear algebra (recommended).",
      ].join("\n"),
    );
    expect(edges.map(({ to, strength }) => [to, strength])).toEqual([
      ["topic:programming", "required"],
      ["topic:python", "recommended"],
      ["topic:calculus", "required"],
      ["topic:matlab", "recommended"],
      ["topic:linear-algebra", "recommended"],
    ]);
  });

  it("reads a short line that recommends as a heading, and a line in lower case as the sentence going on", () => {
    const edges = parse(["Basic course in Linear algebra and", "statistics.", "Recommended prerequisites", "DAT050"].join("\n"));
    expect(edges.map(({ to, strength }) => [to, strength])).toEqual([
      ["topic:linear-algebra", "required"],
      ["topic:statistics", "required"],
      ["DAT050", "recommended"],
    ]);
  });

  it("reads a decimal comma in a credit count", () => {
    expect(summary(parse("A course of 7,5 hp in programming."))).toEqual([
      { to: "topic:programming", strength: "required", via: "topic", credits: 7.5 },
    ]);
  });

  it("finds a course by its unique name, but not a name that several courses share", () => {
    const edges = parse(
      "Familiarity with state space techniques, as taught in e.g. the course Linear control system design, and linear algebra.",
    );
    expect(summary(edges)).toEqual([
      { to: "SSY285", strength: "required", via: "name", credits: null },
      { to: "topic:linear-algebra", strength: "required", via: "topic", credits: null },
      { to: "topic:automatic-control", strength: "required", via: "topic", credits: null },
    ]);
  });

  it("reads a course name that only says a subject as the subject, unless the text points at the course", () => {
    expect(parse("Knowledge in object oriented programming.").map((e) => e.to)).toEqual(["topic:object-oriented-programming"]);
    expect(parse("Passed the course Object oriented programming.").map((e) => e.to)).toEqual(["DAT050"]);
  });

  it("reads a name next to a code as that code's title", () => {
    expect(parse("TDA548 Introductory software development, or equivalent.").map((e) => e.to)).toEqual(["TDA548"]);
  });

  it("reads a course name in a degree's subjects as no course", () => {
    expect(parse("BSc in Civil Engineering, Environmental Engineering or equivalent.")).toEqual([]);
  });

  it("does not count a specific kind of programming as programming in general", () => {
    const edges = parse("A completed course in programming, e.g. Object-oriented programming project or functional programming.");
    expect(edges.map((e) => e.to)).toEqual(["TDA367", "topic:programming", "topic:functional-programming"]);
  });

  it("finds programmes by code, and master's programmes by name where the sentence speaks of a programme", () => {
    const edges = parse(
      "Course specific prerequisites for MPEPO in the Admission Regulations. Students registered at the programme Systems, control and mechatronics should contact their student centre. Basic courses in mechanical engineering and supply chain management.",
    );
    expect(edges.map((e) => e.to)).toEqual(["programme:MPEPO", "programme:MPSYS", "topic:logistics"]);
  });

  it("keeps one edge per node, the strongest mention", () => {
    const edges = parse("TDA233 is recommended. Students must have passed TDA233.");
    expect(summary(edges)).toEqual([{ to: "TDA233", strength: "required", via: "code", credits: null }]);
  });

  it("ignores the course's own code", () => {
    expect(parse("TDA233 can not be taken by students who have taken TDA231.", "TDA233").map((e) => e.to)).toEqual(["TDA231"]);
  });

  it("reads credits in brackets after a subject, as master's programmes write them", () => {
    const edges = parse("Mathematics (including Calculus (at least 7,5 cr.) and Linear Algebra (at least 7,5 cr.)), Programming.");
    expect(summary(edges)).toEqual([
      { to: "topic:mathematics", strength: "required", via: "topic", credits: null },
      { to: "topic:linear-algebra", strength: "required", via: "topic", credits: 7.5 },
      { to: "topic:calculus", strength: "required", via: "topic", credits: 7.5 },
      { to: "topic:programming", strength: "required", via: "topic", credits: null },
    ]);
  });
});

const programme = (code: string, prerequisites: string[], courses: string[]) => ({
  code,
  prerequisites,
  years: [{ courses: courses.map((c) => ({ code: c })) }],
});

describe("prerequisiteSnapshot", () => {
  it("parses the prerequisites of courses and master's programmes, and applies fixes over them", () => {
    const snapshot = prerequisiteSnapshot({
      syllabi: { academicYear: "2026/2027", courses: [syllabus("XYZ100", "A first course in machine learning, such as TDA233.")] },
      names,
      programmes: [programme("MPALG", ["Linear Algebra (at least 7,5 cr.)"], ["XYZ100"]), programme("TKMAS", ["Not parsed"], ["XYZ100"])],
      fixes: [
        { from: "XYZ100", to: "topic:machine-learning", strength: "none" },
        { from: "XYZ100", to: "TDA233", strength: "recommended" },
        { from: "XYZ100", to: "TMV166", strength: "required", note: "Linear algebra is used throughout" },
        { from: "programme:MPALG", to: "topic:programming", strength: "required" },
      ],
    });
    expect(snapshot.programmes.map((p) => [p.code, summary(p.edges)])).toEqual([
      [
        "MPALG",
        [
          { to: "topic:linear-algebra", strength: "required", via: "topic", credits: 7.5 },
          { to: "topic:programming", strength: "required", via: "fix", credits: null },
        ],
      ],
    ]);
    expect(snapshot.courses.map((c) => [c.code, c.programmes, summary(c.edges)])).toEqual([
      [
        "XYZ100",
        ["MPALG", "TKMAS"],
        [
          { to: "TDA233", strength: "recommended", via: "fix", credits: null },
          { to: "TMV166", strength: "required", via: "fix", credits: null },
        ],
      ],
    ]);
    expect(snapshot.names).toEqual({
      XYZ100: "XYZ100",
      TDA233: "Algorithms for machine learning and inference",
      TMV166: "Linear algebra",
      "programme:MPALG": "Computer science - algorithms, languages and logic",
      "topic:linear-algebra": "Linear algebra",
      "topic:programming": "Programming",
    });
  });
});
