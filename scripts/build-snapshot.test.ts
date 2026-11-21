import { describe, expect, it } from "vitest";
import type { EvaluationFile } from "../src/domain/evaluation.ts";
import type { NamesFile } from "../src/domain/names.ts";
import { publishedPlanSchema, type DatedPlan, type PlanCourse, type ProgrammePlansFile } from "../src/domain/programme-plans.ts";
import type { Part, ResultsFile } from "../src/domain/course-stats.ts";
import { courseDetailSchema, snapshotSchema } from "../src/domain/snapshot.ts";
import type { UpcomingMastersFile } from "../src/domain/upcoming-masters.ts";
import { buildSnapshot, type SnapshotInputs } from "./build-snapshot.ts";

const TODAY = new Date("2026-11-21T12:00:00Z");
const FETCHED_AT = "2026-11-01T03:00:00.000Z";

const exam = (date: string, grades: { U: number; "3": number; "4": number; "5": number }): Part => ({
  type: "Tentamen",
  code: "0106",
  sittings: [{ date, grades: { ...grades, G: 0, VG: 0, TG: 0 } }],
});

const results: ResultsFile = {
  programmes: { TKITE: "Informationsteknik, civilingenjör", OLD: "Old programme" },
  courses: [
    { code: "TDA357", name: "Databaser", programme: "TKITE", parts: [exam("2026-03-20", { U: 10, "3": 20, "4": 10, "5": 5 })] },
    { code: "ABC123", name: "Gammal kurs", programme: null, parts: [exam("2022-01-10", { U: 1, "3": 2, "4": 3, "5": 4 })] },
    { code: "NEW001", name: "Ny kurs", programme: null, parts: [] },
    // Its last round was in 2022/2023, and a re-exam since gave a result.
    {
      code: "DAT405",
      name: "Introduktion till data science och AI",
      programme: null,
      parts: [exam("2025-09-16", { U: 1, "3": 0, "4": 0, "5": 0 })],
    },
  ],
};

const names: NamesFile = {
  programmes: {
    TKITE: { en: "Computer Science and Engineering", sv: "Informationsteknik" },
    MPALG: { en: "Computer science - algorithms, languages and logic", sv: "Datavetenskap" },
    NEWMP: { en: "", sv: "" },
  },
  courses: [
    { code: "TDA357", en: "Databases", sv: "Databaser", lastOffered: "2026/2027" },
    // A name Chalmers has in one language only has the other one empty.
    { code: "NEW001", en: "New course", sv: "", lastOffered: "2026/2027" },
    { code: "DAT405", en: "Introduction to data science and AI", sv: "Introduktion till data science och AI", lastOffered: "2022/2023" },
    { code: "DAT700", en: "Advanced programming language theory", sv: "Avancerad programspråksteori", lastOffered: "2026/2027" },
  ],
};

const overall = (...counts: number[]) => ({ overall: counts });

const round = (
  code: string,
  academicYear: number,
  periods: string | null,
  answerCounts: EvaluationFile["rounds"][number]["answerCounts"],
) => ({
  code,
  academicYear,
  periods,
  respondents: 50,
  answers: 5,
  minutes: null,
  means: {},
  answerCounts,
});

const evaluations: EvaluationFile = {
  fetchedAt: FETCHED_AT,
  rounds: [
    round("TDA357", 2021, "LP2", overall(0, 0, 0, 0, 0)),
    round("TDA357", 2022, "LP2", overall(0, 0, 2, 2, 1)),
    round("TDA357", 2023, "LP2", overall(1, 0, 0, 0, 4)),
    round("TDA357", 2024, "LP2", overall(0, 0, 0, 2, 2)),
    round("TDA357", 2025, "LP1", overall(0, 0, 0, 0, 3)),
    round("TDA357", 2025, "LP2", overall(0, 0, 0, 0, 2)),
    // The newest survey year is the newest of any course.
    round("NEW001", 2026, null, {}),
  ],
};

const planCourse = (code: string, overrides: Partial<PlanCourse> = {}): PlanCourse => ({
  code,
  name: `${code} as planned`,
  credits: 7.5,
  periods: ["LP2"],
  periodCredits: [7.5],
  rule: "V",
  track: null,
  block: null,
  choices: [],
  themes: [],
  examiners: [],
  modules: [],
  seats: null,
  ...overrides,
});

const plan = (code: string, academicYear: string, years: DatedPlan["years"]): DatedPlan => ({
  academicYear,
  code,
  name: `${code} as planned`,
  choices: [],
  requirements: [],
  masters: [],
  prerequisites: [],
  years,
});

const plans: ProgrammePlansFile = {
  academicYear: "2026/2027",
  ruleNames: { O: "Compulsory courses", V: "Elective courses" },
  programmes: [
    plan("TKITE", "2025/2026", [{ year: 1, courses: [planCourse("TDA357", { rule: "O" })] }]),
    plan("TKITE", "2026/2027", [
      { year: 1, courses: [planCourse("ABC123", { rule: "O" })] },
      { year: 2, courses: [planCourse("TDA357", { examiners: ["Ada Examiner"], seats: 185 })] },
    ]),
    plan("MPALG", "2026/2027", [
      {
        year: 1,
        courses: [
          planCourse("TDA357", { rule: "O", periods: ["LP3"], examiners: ["Grace Examiner"] }),
          // A new course, which stats.ftek.se has no results for yet.
          planCourse("DAT700", { periods: ["LP4"], examiners: ["Alan Examiner"] }),
        ],
      },
    ]),
  ],
};

const upcomingFile = (academicYear: string): UpcomingMastersFile => ({
  academicYear,
  matrix: "https://example.com/matrix.xlsx",
  matrixUpdated: "2026-10-08",
  masters: [
    {
      code: "MPNEW",
      name: "New master",
      courseList: null,
      accreditations: [{ programme: "TKITE", degree: "engineering", specialisations: [] }],
      courses: [
        { name: "Databases", requirement: "compulsory", track: null, year: 1, preliminary: false },
        { name: "Unknown course", requirement: "elective", track: null, year: 1, preliminary: true },
      ],
    },
  ],
});

const inputs = (upcoming: UpcomingMastersFile | null = null): SnapshotInputs => ({ results, evaluations, plans, names, upcoming });

const build = (upcoming?: UpcomingMastersFile | null) => buildSnapshot(inputs(upcoming), TODAY);

const summaryOf = (code: string, upcoming?: UpcomingMastersFile | null) => build(upcoming).index.courses.find((c) => c.code === code)!;
const detailOf = (code: string) => build().courses.find((c) => c.code === code)!;

describe("buildSnapshot", () => {
  it("writes only what the contract schemas accept", () => {
    for (const upcoming of [null, upcomingFile("2027/2028")]) {
      const { index, courses, plans: published } = build(upcoming);
      expect(snapshotSchema.parse(index)).toEqual(index);
      for (const course of courses) expect(courseDetailSchema.parse(course)).toEqual(course);
      for (const cohort of published.values()) for (const p of cohort) expect(publishedPlanSchema.parse(p)).toEqual(p);
    }
  });

  it("stamps the date and the survey crawl time, and lists the courses in the order of the results", () => {
    const { index, courses } = build();
    expect(index.generatedAt).toBe("2026-11-21T12:00:00.000Z");
    expect(index.evaluationsFetchedAt).toBe(FETCHED_AT);
    expect(index.courses.map((c) => c.code)).toEqual(["TDA357", "ABC123", "NEW001", "DAT405"]);
    expect(courses.map((c) => c.code)).toEqual(["TDA357", "ABC123", "NEW001", "DAT405"]);
  });

  describe("course names", () => {
    it("takes both names from names.json", () => {
      expect(summaryOf("TDA357")).toMatchObject({ name: "Databases", swedishName: "Databaser" });
    });

    it("uses the name of the results in both languages for a course names.json lacks", () => {
      expect(summaryOf("ABC123")).toMatchObject({ name: "Gammal kurs", swedishName: "Gammal kurs" });
    });

    it("fills in an empty name from the name of the results", () => {
      expect(summaryOf("NEW001")).toMatchObject({ name: "New course", swedishName: "Ny kurs" });
    });
  });

  describe("syllabus", () => {
    it("says a course has a syllabus when names.json has it, whether or not a plan has it this year", () => {
      // NEW001 is in no plan, and ABC123 is in a plan of this year but not in names.json.
      expect(["TDA357", "NEW001", "ABC123"].map((code) => detailOf(code).hasSyllabus)).toEqual([true, true, false]);
    });
  });

  describe("programme names", () => {
    it("takes the names.json name, then the results name, then the code, over every code in either file", () => {
      expect(build().index.programmes).toEqual({
        MPALG: { name: "Computer science - algorithms, languages and logic", swedishName: "Datavetenskap" },
        NEWMP: { name: "NEWMP", swedishName: "NEWMP" },
        OLD: { name: "Old programme", swedishName: "Old programme" },
        TKITE: { name: "Computer Science and Engineering", swedishName: "Informationsteknik" },
      });
    });
  });

  describe("survey rounds", () => {
    it("rates a course on the rounds of the last three years up to the newest year of any course's surveys", () => {
      // The newest survey year is 2026, so the rounds of 2024 and 2025 count and the one of 2023 does not.
      expect(detailOf("TDA357").evaluations.map((r) => [r.academicYear, r.periods])).toEqual([
        [2025, "LP2"],
        [2025, "LP1"],
        [2024, "LP2"],
      ]);
      expect(summaryOf("TDA357").surveyAnswers).toEqual({ overall: [0, 0, 0, 2, 7] });
    });

    it("leaves the course code out of a round", () => {
      expect(detailOf("NEW001").evaluations).toEqual([
        { academicYear: 2026, periods: null, respondents: 50, answers: 5, minutes: null, means: {}, answerCounts: {} },
      ]);
    });

    it("has no rounds and no answers for a course without surveys", () => {
      expect(detailOf("ABC123").evaluations).toEqual([]);
      expect(summaryOf("ABC123")).toMatchObject({ surveyAnswers: {}, trend: [] });
    });

    it("trends the rating of every year with enough answers, rated or not", () => {
      // 2021 has no answers and 2024 has four, which is too few.
      expect(summaryOf("TDA357").trend).toEqual([
        [2022, 3.8],
        [2023, 4.2],
        [2025, 5],
      ]);
    });
  });

  describe("results", () => {
    it("ends a course that chalmers.se no longer offers, however recent its re-exams", () => {
      expect(summaryOf("DAT405")).toMatchObject({ lastResult: "2025-09-16", ended: true });
    });

    it("keeps a course that a plan has this year, however old its last result", () => {
      expect(summaryOf("TDA357")).toMatchObject({ lastResult: "2026-03-20", ended: false });
      expect(summaryOf("ABC123")).toMatchObject({ lastResult: "2022-01-10", ended: false });
    });

    it("ends a course that no plan has this year once it has had no results for 548 days", () => {
      expect(summaryOf("NEW001")).toMatchObject({ lastResult: null, ended: true });
    });

    it("sums the recent grades of the main part", () => {
      expect(summaryOf("TDA357")).toMatchObject({
        recentGrades: { U: 10, "3": 20, "4": 10, "5": 5, G: 0, VG: 0, TG: 0 },
        attemptsPerYear: 45,
      });
    });
  });

  describe("plans", () => {
    it("lists the start years of each programme, oldest first", () => {
      expect(build().index.plans).toMatchObject({
        academicYear: "2026/2027",
        ruleNames: { O: "Compulsory courses", V: "Elective courses" },
        starts: { TKITE: [2025, 2026], MPALG: [2026] },
      });
    });

    it("places a course in this year's plans only, the most required first", () => {
      expect(detailOf("TDA357").placements).toEqual([
        {
          programme: "MPALG",
          programmeName: "MPALG as planned",
          year: 1,
          credits: 7.5,
          periods: ["LP3"],
          periodCredits: [7.5],
          rule: "O",
          track: null,
          block: null,
          themes: [],
          examiners: ["Grace Examiner"],
          modules: [],
          seats: null,
          choices: [],
        },
        {
          programme: "TKITE",
          programmeName: "TKITE as planned",
          year: 2,
          credits: 7.5,
          periods: ["LP2"],
          periodCredits: [7.5],
          rule: "V",
          track: null,
          block: null,
          themes: [],
          examiners: ["Ada Examiner"],
          modules: [],
          seats: 185,
          choices: [],
        },
      ]);
    });

    it("gives the periods and examiners of the course this year in the list", () => {
      expect(summaryOf("TDA357")).toMatchObject({ periods: ["LP2", "LP3"], examiners: ["Grace Examiner", "Ada Examiner"] });
      expect(summaryOf("ABC123")).toMatchObject({ periods: ["LP2"], examiners: [] });
      expect(summaryOf("NEW001")).toMatchObject({ periods: [], examiners: [] });
      expect(detailOf("NEW001").placements).toEqual([]);
    });

    it("publishes one file of plans per start year, named in both languages", () => {
      const brief = (start: number) =>
        build()
          .plans.get(start)!
          .map((p) => ({
            code: p.code,
            name: p.name,
            swedishName: p.swedishName,
            years: p.years.map((y) => y.courses.map((c) => [c.code, c.name, c.swedishName, c.rule])),
          }));
      expect([...build().plans.keys()]).toEqual([2025, 2026]);
      expect(brief(2025)).toEqual([
        {
          code: "TKITE",
          name: "Computer Science and Engineering",
          swedishName: "Informationsteknik",
          years: [[["TDA357", "Databases", "Databaser", "O"]], [["TDA357", "Databases", "Databaser", "V"]]],
        },
      ]);
      expect(brief(2026)).toEqual([
        {
          code: "TKITE",
          name: "Computer Science and Engineering",
          swedishName: "Informationsteknik",
          years: [[["ABC123", "ABC123 as planned", "ABC123 as planned", "O"]], [["TDA357", "Databases", "Databaser", "V"]]],
        },
        {
          code: "MPALG",
          name: "Computer science - algorithms, languages and logic",
          swedishName: "Datavetenskap",
          years: [
            [
              ["TDA357", "Databases", "Databaser", "O"],
              ["DAT700", "Advanced programming language theory", "Avancerad programspråksteori", "V"],
            ],
          ],
        },
      ]);
    });
  });

  describe("upcoming master's programmes", () => {
    it("adds them under their start year while that year is later than the plans'", () => {
      const { index, plans: published } = build(upcomingFile("2027/2028"));
      expect([...published.keys()]).toEqual([2025, 2026, 2027]);
      expect(published.get(2027)!.map((p) => ({ code: p.code, name: p.name, swedishName: p.swedishName }))).toEqual([
        { code: "MPNEW", name: "New master", swedishName: "New master" },
      ]);
      expect(published.get(2027)![0]!.years.map((y) => y.courses.map((c) => [c.code, c.name, c.periods, c.rule, c.pending]))).toEqual([
        [
          ["TDA357", "Databases", ["LP2"], "O", undefined],
          ["TDA357", "Databases", ["LP3"], "O", undefined],
          ["new-unknown-course", "Unknown course", [], "V", true],
        ],
      ]);
      expect(index.plans.upcomingMasters).toEqual({
        academicYear: "2027/2028",
        matrix: "https://example.com/matrix.xlsx",
        accreditations: { TKITE: [{ code: "MPNEW", specialisations: [] }] },
        masters: { MPNEW: { courseList: null } },
      });
      // Only programmes with plans of their own have start years.
      expect(index.plans.starts).toEqual({ TKITE: [2025, 2026], MPALG: [2026] });
    });

    it("retires them once the plans have their year", () => {
      const { index, plans: published } = build(upcomingFile("2026/2027"));
      expect([...published.keys()]).toEqual([2025, 2026]);
      expect(index.plans.upcomingMasters).toBeNull();
    });

    it("has none without a file", () => {
      const { index, plans: published } = build(null);
      expect([...published.keys()]).toEqual([2025, 2026]);
      expect(index.plans.upcomingMasters).toBeNull();
    });
  });

  describe("courses without results", () => {
    const dat700 = {
      code: "DAT700",
      name: "Advanced programming language theory",
      swedishName: "Avancerad programspråksteori",
      periods: ["LP4"],
      examiners: ["Alan Examiner"],
      masters: [],
    };

    it("lists the courses of this year's plans that have no results, with their names, study periods and examiners", () => {
      expect(build().index.newCourses).toEqual([dat700]);
    });

    it("adds each new course of the upcoming master's programmes once, with the programmes whose course lists name it", () => {
      const file = upcomingFile("2027/2028");
      const second = { ...file.masters[0]!, code: "MPTWO", name: "Second master" };
      expect(build({ ...file, masters: [...file.masters, second] }).index.newCourses).toEqual([
        dat700,
        { code: null, name: "Unknown course", swedishName: "Unknown course", periods: [], examiners: [], masters: ["MPNEW", "MPTWO"] },
      ]);
    });

    it("leaves out a thesis that only a course list names, since every master's programme lists one", () => {
      const file = upcomingFile("2027/2028");
      const master = file.masters[0]!;
      const thesis = { name: "Master’s thesis", requirement: "compulsory" as const, track: null, year: 2, preliminary: false };
      const withThesis = { ...master, courses: [...master.courses!, thesis] };
      expect(build({ ...file, masters: [withThesis] }).index.newCourses.map((c) => c.name)).toEqual([dat700.name, "Unknown course"]);
    });

    it("drops the new courses of the upcoming master's programmes once the plans have their year", () => {
      expect(build(upcomingFile("2026/2027")).index.newCourses).toEqual([dat700]);
    });
  });
});
