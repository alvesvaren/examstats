/**
 * Titles and descriptions for each page. The router sets the titles in the browser, and the build writes them, with
 * the descriptions, into the HTML that link previews read. The build imports this file, so imports use relative paths.
 */
import { toCatalogCourse } from "../domain/catalog.ts";
import { RECENT_YEARS } from "../domain/course-stats.ts";
import { ANSWER_SCALE } from "../domain/evaluation.ts";
import type { CourseSummary } from "../domain/snapshot.ts";
import { formatCount, formatGrade, formatPercent, formatScore } from "./format.ts";

export const SITE_NAME = "U345";
export const HOME_HEADING = "Chalmers exam results";
export const HOME_DESCRIPTION = "Pass rate, grades, every exam date on record and course survey ratings for every Chalmers course.";

/** The size of a course page's link preview image, drawn by `api/og.tsx`. */
export const COURSE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export const pageTitle = (heading: string) => `${heading} · ${SITE_NAME}`;

export const courseHeading = ({ code, name }: Pick<CourseSummary, "code" | "name">) => `${code} ${name}`;

/** The headline numbers of the course page, in a few sentences. Numbers a course lacks are left out. */
export function courseDescription(course: CourseSummary) {
  const { passRate, averageGrade, attemptsPerYear, rating } = toCatalogCourse(course);
  const recent = [
    passRate !== null && `${formatPercent(passRate)} pass rate`,
    averageGrade !== null && `average grade ${formatGrade(averageGrade)}`,
    attemptsPerYear > 0 && `${formatCount(attemptsPerYear)} attempts per year`,
  ].filter((fact) => fact !== false);
  return [
    recent.length > 0 && `Main exam, last ${RECENT_YEARS} years: ${recent.join(", ")}.`,
    rating !== null && `Rated ${formatScore(rating)} of ${ANSWER_SCALE.max} in course surveys.`,
    "Every exam date on record for this Chalmers course.",
  ]
    .filter((sentence) => sentence !== false)
    .join(" ");
}
