import { describe, expect, it } from "vitest";
import {
  defaultSortDir,
  examinerNamed,
  matchExaminers,
  matchProgrammes,
  partLabel,
  queryCourses,
  surveyColumn,
  toCatalog,
  toCatalogCourse,
  trendDelta,
} from "./catalog.ts";
import { emptyCounts } from "./grades.ts";
import type { CourseSummary, TrendPoint } from "./snapshot.ts";

const row = (code: string, name: string, extra: Partial<CourseSummary> = {}) =>
  toCatalogCourse({
    code,
    name,
    swedishName: name,
    programme: null,
    recentGrades: emptyCounts(),
    attemptsPerYear: 0,
    lastResult: null,
    ended: false,
    trend: [],
    surveyAnswers: {},
    periods: [],
    examiners: [],
    ...extra,
  });

const courses = [
  row("TMV165", "Linjär algebra", {
    programme: "TKMAS",
    attemptsPerYear: 50,
    recentGrades: { ...emptyCounts(), U: 1, "3": 1 },
    periods: ["LP1"],
    examiners: ["Åsa Lindqvist"],
  }),
  row("TMA970", "Inledande matematisk analys", {
    programme: "TKTFY",
    attemptsPerYear: 350,
    recentGrades: { ...emptyCounts(), U: 53, "4": 47 },
  }),
  row("TDA357", "Databases", {
    swedishName: "Databaser",
    programme: "TKITE",
    attemptsPerYear: 380,
    surveyAnswers: { overall: [0, 5, 10, 30, 45], workload: [0, 0, 5, 30, 10] },
    periods: ["LP3", "LP4"],
    examiners: ["Ada Lovelace", "Åsa Lindqvist"],
  }),
  row("TDA545", "Objektorienterad programvaruutveckling", { programme: "TKITE", attemptsPerYear: 0, ended: true }),
];

describe("queryCourses", () => {
  it("matches words in any order and ignores diacritics", () => {
    expect(queryCourses(courses, { q: "algebra linjar" }).active.map((c) => c.code)).toEqual(["TMV165"]);
  });

  it("matches a course by its name in either language", () => {
    expect(queryCourses(courses, { q: "databas" }).active.map((c) => c.code)).toEqual(["TDA357"]);
    expect(queryCourses(courses, { q: "databaser" }).active.map((c) => c.code)).toEqual(["TDA357"]);
  });

  it("names courses in Swedish and still matches their English names", () => {
    const swedish = courses.map((c) => toCatalogCourse(c, "sv"));
    const [databases] = queryCourses(swedish, { q: "databases" }).active;
    expect(databases?.name).toBe("Databaser");
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

  it("sorts by survey rating with unrated courses last", () => {
    const rated = [
      ...courses,
      row("TMA976", "Matematisk analys, fortsättning", {
        surveyAnswers: { overall: [5, 8, 12, 10, 5], workload: [0, 10, 20, 5, 0] },
      }),
    ];
    expect(
      queryCourses(rated, { sort: "rating", dir: "desc" })
        .active.map((c) => c.code)
        .slice(0, 2),
    ).toEqual(["TDA357", "TMA976"]);
    expect(
      queryCourses(rated, { sort: "rating", dir: "asc" })
        .active.map((c) => c.code)
        .slice(0, 2),
    ).toEqual(["TMA976", "TDA357"]);
  });

  it("sorts by another survey question, starting with the lightest workload", () => {
    const rated = [...courses, row("TMA976", "Matematisk analys, fortsättning", { surveyAnswers: { workload: [0, 10, 20, 5, 0] } })];
    const sorted = queryCourses(rated, { sort: "workload", dir: defaultSortDir("workload") }).active.map((c) => c.code);
    expect(sorted.slice(0, 2)).toEqual(["TMA976", "TDA357"]);
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

const codes = (query: Parameters<typeof queryCourses>[1]) => queryCourses(courses, query).active.map((c) => c.code);

describe("queryCourses filters", () => {
  it("matches a course by its examiner's name", () => {
    expect(codes({ q: "lovelace" })).toEqual(["TDA357"]);
    expect(codes({ q: "asa lindqvist", sort: "name", dir: "asc" })).toEqual(["TDA357", "TMV165"]);
  });

  it("scopes to an examiner's courses", () => {
    expect(codes({ examiner: "Ada Lovelace" })).toEqual(["TDA357"]);
  });

  it("keeps courses that run this year in any of the study periods", () => {
    expect(codes({ periods: ["LP4"] })).toEqual(["TDA357"]);
    expect(codes({ periods: ["LP1", "LP3"], sort: "name", dir: "asc" })).toEqual(["TDA357", "TMV165"]);
    expect(codes({ periods: ["LP2"] })).toEqual([]);
  });
});

describe("examiners", () => {
  const catalog = toCatalog(
    {
      generatedAt: "",
      evaluationsFetchedAt: "",
      plans: { academicYear: "", ruleNames: {}, starts: {}, upcomingMasters: null },
      programmes: {},
      courses,
    },
    "en",
  );

  it("counts each examiner's courses", () => {
    expect(catalog.examiners).toEqual([
      { name: "Ada Lovelace", courses: 1 },
      { name: "Åsa Lindqvist", courses: 2 },
    ]);
  });

  it("suggests examiners whose name has every word of a part, from three letters", () => {
    expect(matchExaminers(catalog.examiners, "lind asa").map((e) => e.name)).toEqual(["Åsa Lindqvist"]);
    expect(matchExaminers(catalog.examiners, "databaser; love").map((e) => e.name)).toEqual(["Ada Lovelace"]);
    expect(matchExaminers(catalog.examiners, "ad")).toEqual([]);
  });

  it("names the examiner a search matched a course by", () => {
    const databases = courses.find((c) => c.code === "TDA357")!;
    expect([examinerNamed(databases, "lindqvist"), examinerNamed(databases, "databases")]).toEqual(["Åsa Lindqvist", undefined]);
  });
});

describe("surveyColumn", () => {
  it("shows the question sorted by, else the one picked, else the overall impression", () => {
    expect(surveyColumn("workload", "teaching")).toBe("workload");
    expect(surveyColumn("passRate", "teaching")).toBe("teaching");
    expect(surveyColumn("rating", "teaching")).toBe("overall");
    expect(surveyColumn("passRate", undefined)).toBe("overall");
  });
});

describe("matchProgrammes", () => {
  const programmes = {
    TKITE: { name: "Software Engineering", otherName: "Informationsteknik, civilingenjör" },
    TITEA: { name: "Informationsteknik", otherName: "Informationsteknik" },
    TKTFY: { name: "Engineering Physics", otherName: "Teknisk fysik" },
  };

  it("finds programmes by code prefix or by name in either language", () => {
    expect(matchProgrammes(programmes, "informationsteknik")).toEqual([
      { code: "TKITE", name: "Software Engineering" },
      { code: "TITEA", name: "Informationsteknik" },
    ]);
    expect(matchProgrammes(programmes, "physics").map((p) => p.code)).toEqual(["TKTFY"]);
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
    const trend = [4.5, 3.5, 3.6, 3.7, 3.4].map((rating, i): TrendPoint => [2020 + i, rating]);
    expect(trendDelta(trend)).toBeCloseTo(-0.2);
  });

  it("is null without history", () => {
    expect(trendDelta([[2025, 3.5]])).toBeNull();
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
