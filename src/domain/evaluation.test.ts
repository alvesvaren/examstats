import { describe, expect, it } from "vitest";
import { missingQuestions, pooledAnswerCounts, questionMean, QUESTIONS, summarizeEvaluations, type EvaluationRound } from "./evaluation.ts";

const round = (
  academicYear: number,
  answers: number,
  means: EvaluationRound["means"],
  overallAnswers: number[] | null = null,
): EvaluationRound => ({
  academicYear,
  periods: "LP1",
  respondents: answers * 3,
  answers,
  minutes: null,
  means,
  answerCounts: overallAnswers ? { overall: overallAnswers } : {},
});

describe("summarizeEvaluations", () => {
  it("pools the overall answers of every round", () => {
    const rounds = [round(2023, 4, { overall: 2 }, [1, 2, 1, 0, 0]), round(2024, 4, { overall: 4.5 }, [0, 0, 0, 2, 2])];
    // 1, 2, 2, 3, 4, 4, 5, 5
    expect(summarizeEvaluations(rounds)).toEqual({
      mean: 3.25,
      median: 3.5,
      sd: Math.sqrt(1.9375),
      answers: 8,
      rounds: 2,
      overallAnswers: [1, 2, 1, 2, 2],
    });
  });

  it("leaves out rounds that do not show the overall answers", () => {
    const rounds = [round(2023, 50, { overall: 1 }), round(2024, 6, { overall: 4 }, [0, 0, 0, 6, 0])];
    expect(summarizeEvaluations(rounds)).toEqual({ mean: 4, median: 4, sd: 0, answers: 6, rounds: 1, overallAnswers: [0, 0, 0, 6, 0] });
  });

  it("gives no rating below five answers", () => {
    expect(summarizeEvaluations([round(2024, 2, {}, [0, 0, 0, 0, 2]), round(2025, 2, {}, [0, 0, 0, 0, 2])])).toBeNull();
    expect(summarizeEvaluations([])).toBeNull();
  });
});

describe("pooledAnswerCounts", () => {
  it("adds up the answers to one question over the rounds that show them", () => {
    const rounds = [
      { ...round(2023, 3, {}), answerCounts: { workload: [0, 0, 1, 1, 1] } },
      { ...round(2024, 2, {}), answerCounts: { workload: [0, 0, 2, 0, 0], teaching: [0, 0, 0, 2, 0] } },
      round(2025, 40, {}),
    ];
    expect(pooledAnswerCounts(rounds, "workload")).toEqual([0, 0, 3, 1, 1]);
    expect(pooledAnswerCounts(rounds, "assessment")).toBeNull();
  });
});

describe("questionMean", () => {
  it("averages one question over the rounds that asked it, weighted by answers", () => {
    const rounds = [round(2023, 10, { workload: 4 }), round(2024, 30, { workload: 3 }), round(2025, 99, {})];
    expect(questionMean(rounds, "workload")).toBe(3.25);
    expect(questionMean(rounds, "teaching")).toBeNull();
  });
});

describe("missingQuestions", () => {
  const allMeans = Object.fromEntries(QUESTIONS.map((q) => [q, 4]));
  const { teaching: _, ...withoutTeaching } = allMeans;

  it("finds a question no round of a year has, as when the survey renames it", () => {
    const rounds = [round(2025, 10, allMeans), round(2026, 10, withoutTeaching), round(2026, 12, withoutTeaching)];
    expect(missingQuestions(rounds, 0.1)).toEqual([{ academicYear: 2026, question: "teaching", missing: 2, rounds: 2 }]);
  });

  it("finds every question in a year where no round matched any", () => {
    const missing = missingQuestions([round(2025, 10, allMeans), round(2026, 10, {})], 0.1);
    expect(missing.map((m) => m.question)).toEqual([...QUESTIONS]);
  });

  it("allows a few rounds without a question", () => {
    const rounds = [...Array.from({ length: 9 }, () => round(2026, 10, allMeans)), round(2026, 10, withoutTeaching)];
    expect(missingQuestions(rounds, 0.1)).toEqual([]);
  });

  it("ignores rounds nobody answered", () => {
    expect(missingQuestions([round(2026, 10, allMeans), round(2026, 0, {})], 0.1)).toEqual([]);
  });
});
