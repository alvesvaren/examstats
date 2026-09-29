import { z } from "zod";
import { spreadOf, type Frequencies } from "./spread.ts";

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
/** How many gave each answer, lowest first. */
export const answerCountsSchema = z.array(z.number().int().nonnegative()).length(ANSWER_OPTIONS);

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
  /** How many gave each answer to a question. Missing when the report did not show it. */
  answerCounts: z.partialRecord(z.enum(QUESTIONS), answerCountsSchema),
});

/** The committed file that `pnpm evaluations` writes and `pnpm snapshot` reads. */
export const evaluationFileSchema = z.object({
  fetchedAt: z.iso.datetime(),
  rounds: z.array(evaluationRoundSchema.extend({ code: z.string() })),
});

export type EvaluationRound = z.infer<typeof evaluationRoundSchema>;
export type EvaluationFile = z.infer<typeof evaluationFileSchema>;

/** Mean of one question over several rounds, weighted by answers, or null when no round asked it. */
export function questionMean(rounds: readonly EvaluationRound[], question: Question): number | null {
  const asked = rounds.filter((r) => r.means[question] !== undefined && r.answers > 0);
  const answers = asked.reduce((sum, r) => sum + r.answers, 0);
  if (!answers) return null;
  return asked.reduce((sum, r) => sum + r.means[question]! * r.answers, 0) / answers;
}

/** Answer counts per option, lowest first, as values and counts. */
export const answerFrequencies = (counts: readonly number[]): Frequencies => counts.map((count, i) => [ANSWER_SCALE.min + i, count]);

/** Mean answer from answer counts, or null when nobody answered. */
export const meanAnswer = (counts: readonly number[]) => spreadOf(answerFrequencies(counts))?.mean ?? null;

/** How many gave each answer to a question over the rounds that show it, or null when none does. */
export function pooledAnswerCounts(rounds: readonly EvaluationRound[], question: Question): number[] | null {
  const shown = rounds.map((r) => r.answerCounts[question]).filter((counts) => counts !== undefined);
  if (!shown.length) return null;
  return Array.from({ length: ANSWER_OPTIONS }, (_, i) => shown.reduce((sum, counts) => sum + counts[i]!, 0));
}

/** The overall impression question over all rounds that show its answers, or null when too few answered. */
export function summarizeEvaluations(rounds: readonly EvaluationRound[]) {
  const overallAnswers = pooledAnswerCounts(rounds, "overall");
  const spread = overallAnswers && spreadOf(answerFrequencies(overallAnswers));
  if (!overallAnswers || !spread || spread.count < MIN_SCORE_ANSWERS) return null;
  const { count, ...stats } = spread;
  const scored = rounds.filter((r) => r.answerCounts.overall?.some(Boolean)).length;
  return { ...stats, answers: count, rounds: scored, overallAnswers };
}

/** Newest round first, then by study period. */
export const compareRounds = (a: EvaluationRound, b: EvaluationRound) =>
  b.academicYear - a.academicYear || (b.periods ?? "").localeCompare(a.periods ?? "");
