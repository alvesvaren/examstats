/**
 * Titles and descriptions for each page. The router sets the titles in the browser, and the build writes them, with
 * the descriptions, into the HTML that link previews read. The build imports this file, so imports use relative paths.
 */
import { toCatalogCourse } from "../domain/catalog.ts";
import { ANSWER_SCALE } from "../domain/evaluation.ts";
import type { CourseSummary } from "../domain/snapshot.ts";
import { formatPercent, formatScore } from "./format.ts";

export const SITE_NAME = "U345";
export const HOME_HEADING = "Chalmers exam results";
export const HOME_DESCRIPTION = "Pass rate, grades, every exam date on record and course survey ratings for every Chalmers course.";

/** The size of a course page's link preview image, drawn by `api/og.tsx`. */
export const COURSE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export const pageTitle = (heading: string) => `${heading} · ${SITE_NAME}`;

export const courseHeading = ({ code, name }: Pick<CourseSummary, "code" | "name">) => `${code} ${name}`;

/**
 * The course's two headline numbers, kept short so chat apps show a compact preview. A course with neither gets a
 * plain sentence.
 */
export function courseDescription(course: CourseSummary) {
  const { passRate, rating } = toCatalogCourse(course);
  const facts = [
    passRate !== null && `${formatPercent(passRate)} pass rate.`,
    rating !== null && `Rated ${formatScore(rating)} of ${ANSWER_SCALE.max}.`,
  ].filter((fact) => fact !== false);
  return facts.length > 0 ? facts.join(" ") : "Every exam date on record for this Chalmers course.";
}
