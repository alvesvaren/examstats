import { describe, expect, it } from "vitest";
import { averageGradeOf, emptyCounts, passRateOf, type GradeCounts } from "./grades.ts";
import { academicYear, latestExam, orderParts, summarizeCourse } from "./course-stats.ts";
import type { Part } from "./snapshot.ts";

const grades = (partial: Partial<GradeCounts>): GradeCounts => ({ ...emptyCounts(), ...partial });
const sitting = (date: string, partial: Partial<GradeCounts>) => ({ date, grades: grades(partial) });
const TODAY = new Date("2026-09-27");
const course = { code: "TMA970", name: "Inledande matematisk analys", programme: "TKTFY" };

const exam: Part = {
  type: "Tentamen",
  code: "0197",
  sittings: [
    sitting("2021-10-27", { U: 90, "3": 10 }),
    sitting("2023-10-25", { U: 50, "3": 30, "4": 20 }),
    sitting("2024-10-30", { U: 40, "3": 40, "5": 20 }),
    sitting("2025-10-29", { U: 30, "4": 50, "5": 20 }),
    sitting("2026-01-08", { U: 2, "3": 1 }),
    sitting("2026-09-01", { U: 1, "3": 9 }),
  ],
};

describe("academicYear", () => {
  it("starts in September", () => {
    expect([academicYear("2025-08-29"), academicYear("2025-09-01"), academicYear("2026-01-08")]).toEqual([2024, 2025, 2025]);
  });
});

describe("orderParts", () => {
  it("puts the exam with most attempts first, even when a lab is larger", () => {
    const lab: Part = { type: "Laboration", code: "0297", sittings: [sitting("2025-10-01", { G: 500 })] };
    const smallExam: Part = { type: "Tentamen", code: "0198", sittings: [sitting("2025-10-20", { "3": 10 })] };
    const bigExam: Part = { type: "Tentamen", code: "0197", sittings: [sitting("2025-10-29", { "3": 100 })] };
    expect(orderParts([lab, smallExam, bigExam]).map((p) => p.code)).toEqual(["0197", "0198", "0297"]);
  });
});

describe("summarizeCourse", () => {
  it("uses the last three finished academic years for pass rate, grade and size", () => {
    const summary = summarizeCourse(course, [exam], TODAY);
    // 2023/24, 2024/25 and 2025/26: 303 attempts, 122 fails. The 2026/27 sitting has not finished its year.
    expect(summary.recentGrades).toEqual(grades({ U: 122, "3": 71, "4": 70, "5": 40 }));
    expect(passRateOf(summary.recentGrades)).toBeCloseTo(181 / 303);
    expect(averageGradeOf(summary.recentGrades)).toBeCloseTo((3 * 71 + 4 * 70 + 5 * 40) / 181);
    expect(summary.attemptsPerYear).toBe(101);
  });

  it("builds a trend per academic year before the current one", () => {
    const summary = summarizeCourse(course, [exam], TODAY);
    expect(summary.trend).toEqual([
      [2021, 0.1],
      [2023, 0.5],
      [2024, 0.6],
      [2025, 71 / 103],
    ]);
  });

  it("marks a course as ended after 18 months without results", () => {
    const old: Part = { type: "Tentamen", code: "0101", sittings: [sitting("2018-06-01", { U: 5, "3": 5 })] };
    const summary = summarizeCourse(course, [old], TODAY);
    expect(summary).toMatchObject({ ended: true, lastResult: "2018-06-01", recentGrades: grades({ U: 5, "3": 5 }), attemptsPerYear: 10 });
  });

  it("gives no average grade when the course only has U and G", () => {
    const project: Part = { type: "Projekt", code: "0200", sittings: [sitting("2025-12-01", { U: 1, G: 9 })] };
    const summary = summarizeCourse(course, [project], TODAY);
    expect([passRateOf(summary.recentGrades), averageGradeOf(summary.recentGrades)]).toEqual([0.9, null]);
  });

  it("returns an empty summary for a course without results", () => {
    expect(summarizeCourse(course, [], TODAY)).toEqual({
      ...course,
      recentGrades: emptyCounts(),
      attemptsPerYear: 0,
      lastResult: null,
      ended: true,
      trend: [],
    });
  });
});

describe("latestExam", () => {
  it("skips tiny sittings", () => {
    expect(latestExam(exam.sittings)).toEqual({ date: "2025-10-29", passRate: 0.7, attempts: 100 });
  });

  it("is null without sittings", () => {
    expect(latestExam([])).toBeNull();
  });
});
