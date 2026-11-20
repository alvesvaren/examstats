/**
 * Titles and descriptions for each page. The router sets the titles in the browser, in the language picked, and the
 * build writes them, with the descriptions, into the HTML that link previews read. Link previews run no JavaScript and
 * know no language, so the build writes English. The build imports this file, so imports use relative paths.
 */
import type { CourseSummary } from "../domain/snapshot.ts";
import { en } from "./i18n/en.ts";

export const SITE_NAME = "U345";
export const HOME_HEADING = en.layout.siteHeading;
export const HOME_DESCRIPTION = "Pass rate, grades, every exam date on record and course survey ratings for every Chalmers course.";

/** The size of a course page's link preview image, drawn by `api/og.tsx`. */
export const COURSE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export const pageTitle = (heading: string) => `${heading} · ${SITE_NAME}`;

export const courseHeading = ({ code, name }: Pick<CourseSummary, "code" | "name">) => `${code} ${name}`;

/** The link preview image shows the course's numbers, so the text stays one short line. */
export const COURSE_DESCRIPTION = "Exam results and course survey ratings for this Chalmers course.";
