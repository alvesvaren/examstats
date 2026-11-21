import {
  isOtherQuestion,
  meanAnswer,
  OTHER_QUESTIONS,
  QUESTIONS,
  type OtherQuestion,
  type Question,
  type TrendPoint,
} from "./evaluation.ts";
import { averageGradeOf, passRateOf } from "./grades.ts";
import { inLanguage, normalize, type InLanguage, type Language } from "./names.ts";
import type { StudyPeriod, UpcomingMasters } from "./programme-plans.ts";
import type { CourseSummary, NewCourse, Snapshot } from "./snapshot.ts";

export const SORT_KEYS = [
  "name",
  "programme",
  "attemptsPerYear",
  "passRate",
  "trend",
  "averageGrade",
  "rating",
  "lastResult",
  ...OTHER_QUESTIONS,
] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

/** Text starts A to Z, and workload with the lightest, since 5 is too high. */
const ASCENDING_SORTS: readonly SortKey[] = ["name", "programme", "workload"];

/** The other direction. */
export const flip = (dir: SortDir): SortDir => (dir === "asc" ? "desc" : "asc");

/** The direction a sort starts in: the rest start with the largest. */
export const defaultSortDir = (key: SortKey): SortDir => (ASCENDING_SORTS.includes(key) ? "asc" : "desc");

/** The sort key of a survey question. The overall impression sorts as the rating. */
export const surveySortKey = (question: Question): "rating" | OtherQuestion => (question === "overall" ? "rating" : question);

/** The survey question the survey column shows: the one sorted by, else the one picked for it, else the overall impression. */
export function surveyColumn(sort: SortKey, picked: OtherQuestion | undefined): Question {
  if (isOtherQuestion(sort)) return sort;
  return sort === "rating" ? "overall" : (picked ?? "overall");
}

const TREND_BASELINE_YEARS = 3;
const MIN_PROGRAMME_QUERY = 2;
/** Shorter queries match too many names to suggest examiners. */
const MIN_EXAMINER_QUERY = 3;

const SEARCH_SEPARATOR = ";";

/** Splits a query into its `;`-separated parts, trimmed, with empty parts dropped. */
const searchParts = (query: string) =>
  query
    .split(SEARCH_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);

const words = (query: string) => normalize(query).split(/\s+/).filter(Boolean);

/** Last year's rating minus the mean of the years before it, or null without history. */
export function trendDelta(trend: readonly TrendPoint[]): number | null {
  const last = trend.at(-1);
  const before = trend.slice(-1 - TREND_BASELINE_YEARS, -1);
  if (!last || !before.length) return null;
  return last[1] - before.reduce((sum, [, rating]) => sum + rating, 0) / before.length;
}

/** A course named in `language`, plus the values the list filters and sorts on, computed once when the snapshot loads. */
export function toCatalogCourse(summary: CourseSummary, language: Language = "en") {
  const course = inLanguage(summary, language);
  const scores: Partial<Record<Question, number>> = Object.fromEntries(
    QUESTIONS.flatMap((q) => {
      const mean = meanAnswer(course.surveyAnswers[q] ?? []);
      return mean === null ? [] : [[q, mean]];
    }),
  );
  return {
    ...course,
    passRate: passRateOf(course.recentGrades),
    averageGrade: averageGradeOf(course.recentGrades),
    trendDelta: trendDelta(course.trend),
    /** Mean answer to each survey question with enough answers to score. */
    scores,
    rating: scores.overall ?? null,
    searchText: normalize(`${course.code} ${course.name} ${course.otherName} ${course.programme ?? ""} ${course.examiners.join(" ")}`),
  };
}

export type CatalogCourse = ReturnType<typeof toCatalogCourse>;

/**
 * A course without results named in `language`, with the values the list filters on. stats.ftek.se gives it no
 * programme, so no programme's scope holds it. A course without a code links to the first course list that names it.
 */
export function toCatalogNewCourse(course: NewCourse, language: Language, upcoming: UpcomingMasters | null) {
  const named = inLanguage(course, language);
  return {
    ...named,
    programme: null,
    courseList: course.masters.map((code) => upcoming?.masters[code]?.courseList).find(Boolean) ?? null,
    searchText: normalize(
      `${course.code ?? ""} ${named.name} ${named.otherName} ${course.masters.join(" ")} ${course.examiners.join(" ")}`,
    ),
  };
}

export type CatalogNewCourse = ReturnType<typeof toCatalogNewCourse>;

/** The snapshot with every course and programme named in `language`. */
export function toCatalog(snapshot: Snapshot, language: Language) {
  const withResults = new Set(snapshot.courses.map((c) => c.programme));
  const programmes = Object.entries(snapshot.programmes).map(([code, named]) => [code, inLanguage(named, language)] as const);
  const courses = snapshot.courses.map((course) => toCatalogCourse(course, language));
  return {
    ...snapshot,
    courses,
    newCourses: snapshot.newCourses.map((course) => toCatalogNewCourse(course, language, snapshot.plans.upcomingMasters)),
    byCode: new Map(courses.map((course) => [course.code, course])),
    programmes: Object.fromEntries(programmes),
    /** Programmes with courses with results, which the course list can show. */
    listedProgrammes: Object.fromEntries(programmes.filter(([code]) => withResults.has(code))),
    examiners: examinersOf([...snapshot.courses, ...snapshot.newCourses]),
  };
}

/** Everyone who examines a course this year, by name, with how many such courses. */
function examinersOf(courses: readonly Pick<CourseSummary, "examiners">[]) {
  return [
    ...Map.groupBy(
      courses.flatMap((c) => c.examiners),
      (name) => name,
    ),
  ]
    .map(([name, rounds]) => ({ name, courses: rounds.length }))
    .toSorted((a, b) => a.name.localeCompare(b.name, "sv"));
}
export type Examiner = ReturnType<typeof examinersOf>[number];
export type Catalog = ReturnType<typeof toCatalog>;

const sortValue: Record<Exclude<SortKey, OtherQuestion>, (c: CatalogCourse) => number | string | null> = {
  name: (c) => c.name,
  programme: (c) => c.programme,
  attemptsPerYear: (c) => c.attemptsPerYear || null,
  passRate: (c) => c.passRate,
  trend: (c) => c.trendDelta,
  averageGrade: (c) => c.averageGrade,
  rating: (c) => c.rating,
  lastResult: (c) => c.lastResult,
};

/** The value a course sorts by on `key`, or null when it has none. */
export const sortValueOf = (course: CatalogCourse, key: SortKey) =>
  isOtherQuestion(key) ? (course.scores[key] ?? null) : sortValue[key](course);

/** Orders two sort values in `dir`, with nulls last either way. */
export function compareSortValues(x: number | string | null, y: number | string | null, dir: SortDir) {
  if (x === null || y === null) return Number(x === null) - Number(y === null);
  const sign = dir === "asc" ? 1 : -1;
  return sign * (typeof x === "string" ? x.localeCompare(String(y), "sv") : x - Number(y));
}

function compareBy(key: SortKey, dir: SortDir) {
  return (a: CatalogCourse, b: CatalogCourse) => compareSortValues(sortValueOf(a, key), sortValueOf(b, key), dir);
}

/** What the list filters a course on, with or without results. */
type Filterable = Pick<CatalogCourse, "programme" | "examiners" | "periods" | "searchText">;

/** Whether the course is in the list's scope: its programme, or an examiner's courses. */
export const inScope = (
  course: Pick<Filterable, "programme" | "examiners">,
  { programme, examiner }: Pick<CourseQuery, "programme" | "examiner">,
) => (!programme || course.programme === programme) && (!examiner || course.examiners.includes(examiner));

export interface CourseQuery {
  q?: string;
  programme?: string;
  /** An examiner's name, as the plans write it. */
  examiner?: string;
  /** Study periods this year. A course matches if it runs in any of them. */
  periods?: readonly StudyPeriod[];
  sort?: SortKey;
  dir?: SortDir;
}

/**
 * Whether a course is in the scope, runs in one of the study periods, and matches the search. Each `;`-separated
 * part of `q` is its own search, and a course matches if any part matches all of its words.
 */
function matcherOf({ q = "", programme, examiner, periods = [] }: CourseQuery) {
  const searches = searchParts(q).map(words);
  return (c: Filterable) =>
    inScope(c, { programme, examiner }) &&
    (!periods.length || c.periods.some((p) => periods.includes(p))) &&
    (!searches.length || searches.some((terms) => terms.every((t) => c.searchText.includes(t))));
}

/** Sorts courses whose code equals a part of the search first, and keeps the order otherwise. */
function exactCodesFirst<C extends { code: string | null }>(rows: readonly C[], q = "") {
  const exactCodes = new Set(searchParts(q).map((part) => part.toLowerCase()));
  const isExact = (c: C) => exactCodes.has(c.code?.toLowerCase() ?? "");
  return rows.toSorted((a, b) => Number(isExact(b)) - Number(isExact(a)));
}

/** Filters and sorts the courses with results, with those whose code equals a part of the search first. */
export function queryCourses(courses: readonly CatalogCourse[], query: CourseQuery) {
  const { sort = "attemptsPerYear", dir = "desc" } = query;
  const rows = exactCodesFirst(courses.filter(matcherOf(query)).toSorted(compareBy(sort, dir)), query.q);
  return { active: rows.filter((c) => !c.ended), ended: rows.filter((c) => c.ended) };
}

/**
 * Filters the courses without results, by name since they have no values to sort by, with those whose code equals a
 * part of the search first.
 */
export const queryNewCourses = (courses: readonly CatalogNewCourse[], query: CourseQuery) =>
  exactCodesFirst(
    courses.filter(matcherOf(query)).toSorted((a, b) => a.name.localeCompare(b.name, "sv")),
    query.q,
  );

/** Programmes whose code starts with a `;`-separated part of the query, or whose name in either language contains one. */
export function matchProgrammes(programmes: Readonly<Record<string, InLanguage>>, query: string, limit = 4) {
  const parts = searchParts(query)
    .map(normalize)
    .filter((part) => part.length >= MIN_PROGRAMME_QUERY);
  if (!parts.length) return [];
  return Object.entries(programmes)
    .filter(([code, { name, otherName }]) =>
      parts.some((part) => normalize(code).startsWith(part) || normalize(`${name} ${otherName}`).includes(part)),
    )
    .slice(0, limit)
    .map(([code, { name }]) => ({ code, name }));
}

/** Examiners whose name contains every word of a `;`-separated part of the query. */
export function matchExaminers(examiners: readonly Examiner[], query: string, limit = 4) {
  const searches = searchParts(query)
    .filter((part) => normalize(part).length >= MIN_EXAMINER_QUERY)
    .map(words);
  if (!searches.length) return [];
  return examiners.filter(({ name }) => matchesName(name, searches)).slice(0, limit);
}

/** The course's examiner that the query names, which explains why the course matched. */
export function examinerNamed(course: Pick<CatalogCourse, "examiners">, query: string) {
  const searches = searchParts(query).map(words);
  return course.examiners.find((name) => matchesName(name, searches));
}

const matchesName = (name: string, searches: readonly string[][]) => {
  const normalized = normalize(name);
  return searches.some((terms) => terms.length > 0 && terms.every((t) => normalized.includes(t)));
};
