import { describe, expect, it } from "vitest";
import { compareCopies, dedupe, type Round } from "./evaluations.ts";

const COUNTS = [1, 2, 3, 4, 5];

const round = (overrides: Partial<Round> = {}): Round => ({
  code: "TDA357",
  academicYear: 2024,
  periods: "LP2",
  respondents: 100,
  answers: 40,
  minutes: null,
  means: {},
  answerCounts: {},
  ...overrides,
});

describe("compareCopies", () => {
  it("prefers the copy with answer counts for more questions, however few answers it has", () => {
    const detailed = round({ answers: 10, answerCounts: { overall: COUNTS, teaching: COUNTS } });
    const plain = round({ answers: 90, answerCounts: { overall: COUNTS } });
    expect(compareCopies(detailed, plain)).toBeGreaterThan(0);
    expect(compareCopies(plain, detailed)).toBeLessThan(0);
  });

  it("falls back to the copy with more answers", () => {
    expect(compareCopies(round({ answers: 50 }), round({ answers: 40 }))).toBeGreaterThan(0);
    expect(compareCopies(round(), round())).toBe(0);
  });
});

describe("dedupe", () => {
  it("keeps the best copy of a round that both reports list", () => {
    const poor = round({ answers: 60 });
    const best = round({ answers: 30, answerCounts: { overall: COUNTS } });
    expect(dedupe([poor, best])).toEqual([best]);
    expect(dedupe([best, poor])).toEqual([best]);
  });

  it("keeps the first of two equal copies", () => {
    const first = round({ minutes: "https://example.com/first" });
    const second = round({ minutes: "https://example.com/second" });
    expect(dedupe([first, second])).toEqual([first]);
  });

  it("treats another academic year, other periods and no periods as other rounds, and sorts them by code, year and periods", () => {
    const rounds = [
      round({ code: "TDA357", academicYear: 2024, periods: "LP3" }),
      round({ code: "DAT151", academicYear: 2024, periods: "LP2" }),
      round({ code: "TDA357", academicYear: 2023, periods: "LP2" }),
      round({ code: "TDA357", academicYear: 2024, periods: "LP2" }),
      round({ code: "TDA357", academicYear: 2024, periods: null }),
    ];
    expect(dedupe(rounds).map(({ code, academicYear, periods }) => [code, academicYear, periods])).toEqual([
      ["DAT151", 2024, "LP2"],
      ["TDA357", 2023, "LP2"],
      ["TDA357", 2024, null],
      ["TDA357", 2024, "LP2"],
      ["TDA357", 2024, "LP3"],
    ]);
  });
});
