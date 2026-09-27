import { describe, expect, it } from "vitest";
import { matchProgrammes, partLabel, queryCourses, toCatalogCourse, trendDelta } from "./catalog.ts";
import { emptyCounts } from "./grades.ts";
import type { CourseSummary } from "./snapshot.ts";

const row = (code: string, name: string, extra: Partial<CourseSummary> = {}) =>
  toCatalogCourse({
    code,
    name,
    programme: null,
    recentGrades: emptyCounts(),
    attemptsPerYear: 0,
    lastResult: null,
    ended: false,
    trend: [],
    latestExam: null,
    ...extra,
  });

const courses = [
  row("TMV165", "Linjär algebra", { programme: "TKMAS", attemptsPerYear: 50, recentGrades: { ...emptyCounts(), U: 1, "3": 1 } }),
  row("TMA970", "Inledande matematisk analys", { programme: "TKTFY", attemptsPerYear: 350, recentGrades: { ...emptyCounts(), U: 53, "4": 47 } }),
  row("TDA357", "Databaser", { programme: "TKITE", attemptsPerYear: 380 }),
  row("TDA545", "Objektorienterad programvaruutveckling", { programme: "TKITE", attemptsPerYear: 0, ended: true }),
];

describe("queryCourses", () => {
  it("matches words in any order and ignores diacritics", () => {
    expect(queryCourses(courses, { q: "algebra linjar" }).active.map((c) => c.code)).toEqual(["TMV165"]);
  });

  it("matches a programme code and puts ended courses in their own group", () => {
    const { active, ended } = queryCourses(courses, { q: "tkite" });
    expect([active.map((c) => c.code), ended.map((c) => c.code)]).toEqual([["TDA357"], ["TDA545"]]);
  });

  it("scopes to a programme", () => {
    expect(queryCourses(courses, { programme: "TKTFY" }).active.map((c) => c.code)).toEqual(["TMA970"]);
  });

  it("sorts with missing values last in both directions", () => {
    const asc = queryCourses(courses, { sort: "passRate", dir: "asc" }).active.map((c) => c.code);
    const desc = queryCourses(courses, { sort: "passRate", dir: "desc" }).active.map((c) => c.code);
    expect([asc, desc]).toEqual([
      ["TMA970", "TMV165", "TDA357"],
      ["TMV165", "TMA970", "TDA357"],
    ]);
  });

  it("matches any of several searches separated by semicolons", () => {
    expect(queryCourses(courses, { q: "databaser; tmv165" }).active.map((c) => c.code)).toEqual(["TMV165", "TDA357"]);
  });

  it("ignores empty parts, so a trailing semicolon does not match everything", () => {
    expect(queryCourses(courses, { q: "linjar ;" }).active.map((c) => c.code)).toEqual(["TMV165"]);
  });

  it("puts an exact course code first whatever the sort", () => {
    expect(queryCourses(courses, { q: "tda357", sort: "attemptsPerYear", dir: "asc" }).active[0]?.code).toBe("TDA357");
  });
});

describe("matchProgrammes", () => {
  const programmes = { TKITE: "Informationsteknik, civilingenjör", TITEA: "Informationsteknik", TKTFY: "Teknisk fysik" };

  it("finds programmes by code prefix or by name", () => {
    expect(matchProgrammes(programmes, "informationsteknik").map((p) => p.code)).toEqual(["TKITE", "TITEA"]);
    expect(matchProgrammes(programmes, "tkt").map((p) => p.code)).toEqual(["TKTFY"]);
  });

  it("matches programmes for each semicolon-separated part", () => {
    expect(matchProgrammes(programmes, "tkt; informationsteknik").map((p) => p.code)).toEqual(["TKITE", "TITEA", "TKTFY"]);
  });

  it("ignores one-letter queries", () => {
    expect(matchProgrammes(programmes, "t")).toEqual([]);
  });
});

describe("trendDelta", () => {
  it("compares the last year with the mean of the three before it", () => {
    const trend = [0.9, 0.5, 0.6, 0.7, 0.4].map((passRate, i) => ({ academicYear: 2020 + i, passRate, attempts: 10 }));
    expect(trendDelta(trend)).toBeCloseTo(-0.2);
  });

  it("is null without history", () => {
    expect(trendDelta([{ academicYear: 2025, passRate: 0.5, attempts: 10 }])).toBeNull();
  });
});

describe("partLabel", () => {
  it("translates the part type and keeps the part letter", () => {
    expect(["Tentamen", "Laboration, del A", "Muntlig tentamen", "Okänd typ"].map(partLabel)).toEqual([
      "Exam",
      "Lab, part A",
      "Oral exam",
      "Okänd typ",
    ]);
  });
});
