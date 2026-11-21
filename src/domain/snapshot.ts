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
  /** Whether chalmers.se has a syllabus of the course. It has one of every course it names, in a plan this year or not. */
  hasSyllabus: z.boolean(),
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

/**
 * A course without results on stats.ftek.se, which the course list links to chalmers.se instead of a page of its own:
 * one that this academic year's plans give, or a new one that only an upcoming master's programme's course list names.
 */
export const newCourseSchema = namedSchema.extend({
  /** Null for a course that only a course list names, since it has no code yet. */
  code: z.string().nullable(),
  /** Study periods the course runs in this academic year. Empty for a course that only a course list names. */
  periods: z.array(z.enum(STUDY_PERIODS)),
  /** Examiners of the course's rounds this academic year. */
  examiners: z.array(z.string()),
  /** The upcoming master's programmes whose course lists name the course, by code. Empty for a course of this year's plans. */
  masters: z.array(z.string()),
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
  newCourses: z.array(newCourseSchema),
});

export type CourseDetail = z.infer<typeof courseDetailSchema>;
export type CourseSummary = z.infer<typeof courseSummarySchema>;
export type NewCourse = z.infer<typeof newCourseSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
