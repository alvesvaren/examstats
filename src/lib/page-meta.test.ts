import { describe, expect, it } from "vitest";
import { emptyCounts } from "../domain/grades.ts";
import type { CourseSummary } from "../domain/snapshot.ts";
import { courseDescription } from "./page-meta.ts";

const course = (extra: Partial<CourseSummary>): CourseSummary => ({
  code: "TMA970",
  name: "Inledande matematisk analys",
  programme: null,
  recentGrades: emptyCounts(),
  attemptsPerYear: 0,
  lastResult: null,
  ended: false,
  trend: [],
  overallAnswers: null,
  ...extra,
});

describe("courseDescription", () => {
  it("states the headline numbers of the course page", () => {
    const description = courseDescription(
      course({ recentGrades: { ...emptyCounts(), U: 50, "3": 25, "5": 25 }, attemptsPerYear: 1200, overallAnswers: [0, 0, 10, 10, 0] }),
    );
    expect(description).toBe(
      "Main exam, last 3 years: 50% pass rate, average grade 4.00, 1,200 attempts per year. Rated 3.5 of 5 in course surveys. Every exam date on record for this Chalmers course.",
    );
  });

  it("leaves out numbers a course lacks", () => {
    expect(courseDescription(course({ recentGrades: { ...emptyCounts(), U: 1, G: 3 }, attemptsPerYear: 4 }))).toBe(
      "Main exam, last 3 years: 75% pass rate, 4 attempts per year. Every exam date on record for this Chalmers course.",
    );
    expect(courseDescription(course({}))).toBe("Every exam date on record for this Chalmers course.");
  });
});
