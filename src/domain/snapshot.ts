import { z } from "zod";
import { answerCountsSchema, evaluationRoundSchema } from "./evaluation.ts";
import { gradeCountsSchema } from "./grades.ts";

const isoDate = z.iso.date();

export const sittingSchema = z.object({
  date: isoDate,
  grades: gradeCountsSchema,
});

export const partSchema = z.object({
  /** Swedish part type from the source, such as "Tentamen" or "Laboration, del A". */
  type: z.string(),
  code: z.string(),
  sittings: z.array(sittingSchema),
});

/** The committed file that `pnpm fetch-results` writes and `pnpm snapshot` reads. */
export const resultsFileSchema = z.object({
  /** Programme names by code. */
  programmes: z.record(z.string(), z.string()),
  courses: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      programme: z.string().nullable(),
      /** Main part first, then the rest by attempts. */
      parts: z.array(partSchema),
    }),
  ),
});

export const courseDetailSchema = z.object({
  code: z.string(),
  /** Main part first, then the rest by attempts. */
  parts: z.array(partSchema),
  /** Course survey rounds, newest first. */
  evaluations: z.array(evaluationRoundSchema),
});

/** A pass rate in one academic year. A tuple, since the list loads thousands of them. */
const trendPointSchema = z.tuple([z.number().int(), z.number()]);

export const courseSummarySchema = z.object({
  code: z.string(),
  name: z.string(),
  programme: z.string().nullable(),
  /** Grades on the main part over the recent academic years. Pass rate and average grade derive from these. */
  recentGrades: gradeCountsSchema,
  attemptsPerYear: z.number().int(),
  lastResult: isoDate.nullable(),
  ended: z.boolean(),
  /** Pass rate on the main part per academic year, oldest first, as `[academicYear, passRate]`. */
  trend: z.array(trendPointSchema),
  /** Answers to the overall impression question over all survey rounds, or null when too few to rate. */
  overallAnswers: answerCountsSchema.nullable(),
});

export const snapshotSchema = z.object({
  generatedAt: z.iso.datetime(),
  /** When the course surveys were last crawled. */
  evaluationsFetchedAt: z.iso.datetime(),
  programmes: z.record(z.string(), z.string()),
  courses: z.array(courseSummarySchema),
});

export type Sitting = z.infer<typeof sittingSchema>;
export type Part = z.infer<typeof partSchema>;
export type CourseDetail = z.infer<typeof courseDetailSchema>;
export type CourseSummary = z.infer<typeof courseSummarySchema>;
export type TrendPoint = z.infer<typeof trendPointSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type ResultsFile = z.infer<typeof resultsFileSchema>;
