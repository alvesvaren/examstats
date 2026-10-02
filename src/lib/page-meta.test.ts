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
  it("states the pass rate and the survey rating", () => {
    const description = courseDescription(
      course({ recentGrades: { ...emptyCounts(), U: 50, "3": 25, "5": 25 }, attemptsPerYear: 1200, overallAnswers: [0, 0, 10, 10, 0] }),
    );
    expect(description).toBe("50% pass rate. Rated 3.5 of 5.");
  });

  it("leaves out numbers a course lacks", () => {
    expect(courseDescription(course({ recentGrades: { ...emptyCounts(), U: 1, G: 3 }, attemptsPerYear: 4 }))).toBe("75% pass rate.");
    expect(courseDescription(course({}))).toBe("Every exam date on record for this Chalmers course.");
  });
});
