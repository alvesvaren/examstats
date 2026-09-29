import { z } from "zod";
import { spreadOf, type Spread } from "./spread.ts";

/** Standard questions in Chalmers course surveys. All use the answer scale below. */
export const QUESTIONS = [
  "overall",
  "teaching",
  "structure",
  "literature",
  "assessment",
  "administration",
  "learningOutcomes",
  "prerequisites",
  "workload",
] as const;
export type Question = (typeof QUESTIONS)[number];

export const ANSWER_SCALE = { min: 1, max: 5 } as const;
const ANSWER_OPTIONS = ANSWER_SCALE.max - ANSWER_SCALE.min + 1;

/** Workload runs from too low to too high, so the middle is best and it stays out of the score. */
export const BALANCED_WORKLOAD = (ANSWER_SCALE.min + ANSWER_SCALE.max) / 2;

/** Academic years of course surveys that `pnpm evaluations` fetches. */
export const EVALUATION_YEARS = 5;

/** Fewer answers than this over all rounds give no rating. */
export const MIN_SCORE_ANSWERS = 5;

const mean = z.number().min(ANSWER_SCALE.min).max(ANSWER_SCALE.max);

export const evaluationRoundSchema = z.object({
  /** Academic year the round started in, so 2024 is 2024/25. */
  academicYear: z.number().int(),
  /** Study periods, such as "LP1" or "LP2-LP3". */
  periods: z.string().nullable(),
  respondents: z.number().int().nonnegative(),
  answers: z.number().int().nonnegative(),
  /** Minutes from the course evaluation meeting. */
  minutes: z.url().nullable(),
  means: z.partialRecord(z.enum(QUESTIONS), mean),
  /** How many answered each option of the overall question, lowest first. Null when the report did not show it. */
  overallAnswers: z.array(z.number().int().nonnegative()).length(ANSWER_OPTIONS).nullable(),
});

/** The committed file that `pnpm evaluations` writes and `pnpm snapshot` reads. */
export const evaluationFileSchema = z.object({
  fetchedAt: z.iso.datetime(),
  rounds: z.array(evaluationRoundSchema.extend({ code: z.string() })),
});

/** The overall impression question over all rounds that show its answers. */
export const evaluationSummarySchema = z.object({
  mean: z.number(),
  median: z.number(),
  sd: z.number(),
  answers: z.number().int(),
  rounds: z.number().int(),
});

export type EvaluationRound = z.infer<typeof evaluationRoundSchema>;
export type EvaluationFile = z.infer<typeof evaluationFileSchema>;
export type EvaluationSummary = z.infer<typeof evaluationSummarySchema>;

/** Mean of one question over several rounds, weighted by answers, or null when no round asked it. */
export function questionMean(rounds: readonly EvaluationRound[], question: Question): number | null {
  const asked = rounds.filter((r) => r.means[question] !== undefined && r.answers > 0);
  const answers = asked.reduce((sum, r) => sum + r.answers, 0);
  if (!answers) return null;
  return asked.reduce((sum, r) => sum + r.means[question]! * r.answers, 0) / answers;
}

/** Spread of the overall answers in the given rounds, pooled. */
export function overallSpread(rounds: readonly EvaluationRound[]): Spread | null {
  const pooled = Array.from({ length: ANSWER_OPTIONS }, (_, i) => rounds.reduce((sum, r) => sum + (r.overallAnswers?.[i] ?? 0), 0));
  return spreadOf(pooled.map((count, i) => [ANSWER_SCALE.min + i, count]));
}

export function summarizeEvaluations(rounds: readonly EvaluationRound[]): EvaluationSummary | null {
  const spread = overallSpread(rounds);
  if (!spread || spread.count < MIN_SCORE_ANSWERS) return null;
  const { count, ...stats } = spread;
  return { ...stats, answers: count, rounds: rounds.filter((r) => r.overallAnswers?.some(Boolean)).length };
}

/** Newest round first, then by study period. */
export const compareRounds = (a: EvaluationRound, b: EvaluationRound) =>
  b.academicYear - a.academicYear || (b.periods ?? "").localeCompare(a.periods ?? "");
