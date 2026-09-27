import { attemptsOf, passRateOf, sumCounts } from "./grades.ts";
import type { CourseSummary, Part, Sitting, TrendPoint } from "./snapshot.ts";

/** Academic years start in September, so an August retake belongs to the year before. */
const ACADEMIC_YEAR_START_MONTH = 9;
export const RECENT_YEARS = 3;
const TREND_YEARS = 10;
const ENDED_AFTER_DAYS = 548;
const DAY_MS = 86_400_000;
/** A sitting smaller than this share of the median sitting is a straggler, not "the latest exam". */
const LATEST_EXAM_MIN_SHARE = 0.25;
const LATEST_EXAM_MIN_ATTEMPTS = 5;

const EXAM_TYPE = /^(Tentamen|Hemtentamen|Muntlig tentamen)\b/;

export function academicYear(isoDate: string): number {
  const [year = 0, month = 0] = isoDate.split("-").map(Number);
  return month >= ACADEMIC_YEAR_START_MONTH ? year : year - 1;
}

export const isExam = (part: Pick<Part, "type">) => EXAM_TYPE.test(part.type);

const partAttempts = (part: Part) => part.sittings.reduce((sum, s) => sum + attemptsOf(s.grades), 0);

/** Exams first, then by attempts. The first part is the course's main part. */
export function orderParts(parts: readonly Part[]): Part[] {
  return [...parts].sort((a, b) => Number(isExam(b)) - Number(isExam(a)) || partAttempts(b) - partAttempts(a));
}

function latestExam(sittings: readonly Sitting[]) {
  const sizes = sittings.map((s) => attemptsOf(s.grades)).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)] ?? 0;
  const floor = Math.max(LATEST_EXAM_MIN_ATTEMPTS, median * LATEST_EXAM_MIN_SHARE);
  const sitting = sittings.findLast((s) => attemptsOf(s.grades) >= floor) ?? sittings.at(-1);
  if (!sitting) return null;
  return { date: sitting.date, passRate: passRateOf(sitting.grades) ?? 0, attempts: attemptsOf(sitting.grades) };
}

function trendOf(sittings: readonly Sitting[], currentYear: number): TrendPoint[] {
  const byYear = Map.groupBy(
    sittings.filter((s) => academicYear(s.date) < currentYear),
    (s) => academicYear(s.date),
  );
  return [...byYear]
    .map(([year, group]) => {
      const counts = sumCounts(group.map((s) => s.grades));
      return { academicYear: year, passRate: passRateOf(counts) ?? 0, attempts: attemptsOf(counts) };
    })
    .sort((a, b) => a.academicYear - b.academicYear)
    .slice(-TREND_YEARS);
}

/**
 * Builds the list row for a course from its parts.
 * Recent grades and size cover the main part's last {@link RECENT_YEARS} finished academic years with results.
 */
export function summarizeCourse(
  course: Pick<CourseSummary, "code" | "name" | "programme">,
  parts: readonly Part[],
  today: Date,
): CourseSummary {
  const [main] = orderParts(parts);
  const dates = parts.flatMap((p) => p.sittings.map((s) => s.date)).sort();
  const lastResult = dates.at(-1) ?? null;
  const ended = !lastResult || (today.getTime() - Date.parse(lastResult)) / DAY_MS > ENDED_AFTER_DAYS;

  const sittings = [...(main?.sittings ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const currentYear = academicYear(today.toISOString().slice(0, 10));
  const years = sittings.map((s) => academicYear(s.date));
  const finishedYears = years.filter((y) => y < currentYear);
  const anchor = finishedYears.length ? Math.max(...finishedYears) : Math.max(currentYear, ...years);
  const recent = sittings.filter((s) => {
    const year = academicYear(s.date);
    return year > anchor - RECENT_YEARS && year <= anchor;
  });
  const recentCounts = sumCounts(recent.map((s) => s.grades));
  const recentYears = new Set(recent.map((s) => academicYear(s.date))).size;

  return {
    ...course,
    recentGrades: recentCounts,
    attemptsPerYear: recentYears ? Math.round(attemptsOf(recentCounts) / recentYears) : 0,
    lastResult,
    ended,
    trend: trendOf(sittings, currentYear),
    latestExam: latestExam(sittings),
  };
}
