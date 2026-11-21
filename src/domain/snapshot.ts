import { z } from "zod";
import { evaluationRoundSchema, surveyAnswersSchema, trendPointSchema } from "./evaluation.ts";
import { gradeCountsSchema } from "./grades.ts";
import { partSchema } from "./course-stats.ts";
import { namedSchema } from "./names.ts";
import { coursePlacementSchema, publishedPlanInfoSchema, STUDY_PERIODS } from "./programme-plans.ts";

const isoDate = z.iso.date();

export const courseDetailSchema = z.object({
  code: z.string(),
  /** Main part first, then the rest by attempts. */
  parts: z.array(partSchema),
  /** Course survey rounds, newest first. */
  evaluations: z.array(evaluationRoundSchema),
  /** Where this academic year's programme plans place the course, compulsory first. Empty when no plan has it. */
  placements: z.array(coursePlacementSchema),
});

export const courseSummarySchema = namedSchema.extend({
  code: z.string(),
  programme: z.string().nullable(),
  /** Grades on the main part over the recent academic years. Pass rate and average grade derive from these. */
  recentGrades: gradeCountsSchema,
  attemptsPerYear: z.number().int(),
  lastResult: isoDate.nullable(),
  ended: z.boolean(),
  /** Mean overall impression in the course surveys per academic year, oldest first, as `[academicYear, rating]`. */
  trend: z.array(trendPointSchema),
  /** Answers to each survey question over the rated rounds. A question with too few answers to score is missing. */
  surveyAnswers: surveyAnswersSchema,
  /** Study periods the course runs in this academic year, from the programme plans. Empty when no plan has it. */
  periods: z.array(z.enum(STUDY_PERIODS)),
  /** Examiners of the course's rounds this academic year. Empty when no plan has it. */
  examiners: z.array(z.string()),
});

export const snapshotSchema = z.object({
  generatedAt: z.iso.datetime(),
  /** When the course surveys were last crawled. */
  evaluationsFetchedAt: z.iso.datetime(),
  /** The academic year, rule names and start years of the programme plans. */
  plans: publishedPlanInfoSchema,
  /** Programme names by code. */
  programmes: z.record(z.string(), namedSchema),
  courses: z.array(courseSummarySchema),
});

export type CourseDetail = z.infer<typeof courseDetailSchema>;
export type CourseSummary = z.infer<typeof courseSummarySchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
