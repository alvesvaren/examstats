import { z } from "zod";
import { evaluationRoundSchema, evaluationSummarySchema } from "./evaluation.ts";
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

const trendPointSchema = z.object({
  academicYear: z.number().int(),
  passRate: z.number(),
  attempts: z.number().int(),
});

export const courseSummarySchema = z.object({
  code: z.string(),
  name: z.string(),
  programme: z.string().nullable(),
  /** Grades on the main part over the recent academic years. Pass rate and average grade derive from these. */
  recentGrades: gradeCountsSchema,
  attemptsPerYear: z.number().int(),
  lastResult: isoDate.nullable(),
  ended: z.boolean(),
  trend: z.array(trendPointSchema),
  latestExam: z.object({ date: isoDate, passRate: z.number(), attempts: z.number().int() }).nullable(),
  evaluation: evaluationSummarySchema.nullable(),
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
