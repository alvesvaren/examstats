import { averageGradeOf, passRateOf } from "./grades.ts";
import type { CourseSummary, Snapshot, TrendPoint } from "./snapshot.ts";

export const SORT_KEYS = ["name", "programme", "attemptsPerYear", "passRate", "trend", "averageGrade", "lastResult"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

const TEXT_SORTS: readonly SortKey[] = ["name", "programme"];

/** Text sorts start A to Z. Numbers start with the largest. */
export const defaultSortDir = (key: SortKey): SortDir => (TEXT_SORTS.includes(key) ? "asc" : "desc");

const TREND_BASELINE_YEARS = 3;
const MIN_PROGRAMME_QUERY = 2;

export const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const words = (query: string) => normalize(query).split(/\s+/).filter(Boolean);

/** Last year's pass rate minus the mean of the years before it, or null without history. */
export function trendDelta(trend: readonly TrendPoint[]): number | null {
  const last = trend.at(-1);
  const before = trend.slice(-1 - TREND_BASELINE_YEARS, -1);
  if (!last || !before.length) return null;
  return last.passRate - before.reduce((sum, t) => sum + t.passRate, 0) / before.length;
}

/** A course plus the values the list filters and sorts on, computed once when the snapshot loads. */
export function toCatalogCourse(course: CourseSummary) {
  return {
    ...course,
    passRate: passRateOf(course.recentGrades),
    averageGrade: averageGradeOf(course.recentGrades),
    trendDelta: trendDelta(course.trend),
    searchText: normalize(`${course.code} ${course.name} ${course.programme ?? ""}`),
  };
}

export type CatalogCourse = ReturnType<typeof toCatalogCourse>;

export const toCatalog = (snapshot: Snapshot) => ({ ...snapshot, courses: snapshot.courses.map(toCatalogCourse) });

const sortValue: Record<SortKey, (c: CatalogCourse) => number | string | null> = {
  name: (c) => c.name,
  programme: (c) => c.programme,
  attemptsPerYear: (c) => c.attemptsPerYear || null,
  passRate: (c) => c.passRate,
  trend: (c) => c.trendDelta,
  averageGrade: (c) => c.averageGrade,
  lastResult: (c) => c.lastResult,
};

function compareBy(key: SortKey, dir: SortDir) {
  const sign = dir === "asc" ? 1 : -1;
  const value = sortValue[key];
  return (a: CatalogCourse, b: CatalogCourse) => {
    const [x, y] = [value(a), value(b)];
    if (x === null || y === null) return Number(x === null) - Number(y === null);
    return sign * (typeof x === "string" ? x.localeCompare(String(y), "sv") : x - Number(y));
  };
}

export interface CourseQuery {
  q?: string;
  programme?: string;
  sort?: SortKey;
  dir?: SortDir;
}

/** Filters and sorts the catalog. An exact course code match always comes first. */
export function queryCourses(courses: readonly CatalogCourse[], { q = "", programme, sort = "attemptsPerYear", dir = "desc" }: CourseQuery) {
  const terms = words(q);
  const exact = q.trim().toLowerCase();
  const isExact = (c: CatalogCourse) => c.code.toLowerCase() === exact;
  const rows = courses
    .filter((c) => (!programme || c.programme === programme) && terms.every((t) => c.searchText.includes(t)))
    .sort(compareBy(sort, dir))
    .sort((a, b) => Number(isExact(b)) - Number(isExact(a)));
  return { active: rows.filter((c) => !c.ended), ended: rows.filter((c) => c.ended) };
}

/** Programmes whose code starts with the query or whose name contains it. */
export function matchProgrammes(programmes: Readonly<Record<string, string>>, query: string, limit = 4) {
  const q = normalize(query.trim());
  if (q.length < MIN_PROGRAMME_QUERY) return [];
  return Object.entries(programmes)
    .filter(([code, name]) => normalize(code).startsWith(q) || normalize(name).includes(q))
    .slice(0, limit)
    .map(([code, name]) => ({ code, name }));
}

const PART_WORDS: readonly [sv: string, en: string][] = [
  ["Muntlig tentamen", "Oral exam"],
  ["Hemtentamen", "Take-home exam"],
  ["Tentamen", "Exam"],
  ["Laborationer", "Labs"],
  ["Laboration", "Lab"],
  ["Projektarbete", "Project"],
  ["Projekt", "Project"],
  ["Inlämningsuppgifter", "Assignments"],
  ["Inlämningsuppgift", "Assignment"],
  ["Examensarbete", "Thesis"],
  ["Duggor", "Quizzes"],
  ["Dugga", "Quiz"],
  ["Övningar", "Exercises"],
  ["Övning", "Exercise"],
  ["Seminarier", "Seminars"],
  ["Seminarium", "Seminar"],
  ["Konstruktionsövning", "Design exercise"],
  ["Kontrollskrivning", "Midterm"],
  ["Förberedande kurs i matematik", "Preparatory maths"],
];

/** English label for a Swedish part type. Unknown types keep their Swedish name. */
export function partLabel(type: string): string {
  const match = PART_WORDS.find(([sv]) => new RegExp(`^${sv}(?=$|[ ,+])`).test(type));
  const translated = match ? match[1] + type.slice(match[0].length) : type;
  return translated.replace(", del ", ", part ");
}
