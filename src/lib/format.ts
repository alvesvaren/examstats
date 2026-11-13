import type { Spread } from "../domain/spread.ts";
import { STUDY_PERIODS, type StudyPeriod } from "../domain/programme-plans.ts";

const LOCALE = "en-GB";

const percent = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 0 });
const count = new Intl.NumberFormat(LOCALE);
const grade = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const score = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const number = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const day = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });
const month = new Intl.DateTimeFormat(LOCALE, { month: "short", year: "numeric" });

const EMPTY = "–";

export const formatPercent = (value: number | null) => (value === null ? EMPTY : percent.format(value));
export const formatCount = (value: number) => count.format(value);
export const formatGrade = (value: number | null) => (value === null ? EMPTY : grade.format(value));
export const formatScore = (value: number | null) => (value === null ? EMPTY : score.format(value));
export const formatNumber = (value: number) => number.format(value);
export const formatSpread = ({ mean, median, sd }: Pick<Spread, "mean" | "median" | "sd">) =>
  `Mean ${formatNumber(mean)} · median ${formatNumber(median)} · SD ${formatNumber(sd)}`;
export const formatDay = (isoDate: string) => day.format(new Date(isoDate));
export const formatMonth = (isoDate: string | null) => (isoDate === null ? EMPTY : month.format(new Date(isoDate)));
export const formatAcademicYear = (year: number) => `${year}/${String(year + 1).slice(2)}`;

const PERIOD_LABEL: Record<StudyPeriod, string> = {
  LP1: "LP1",
  LP2: "LP2",
  LP3: "LP3",
  LP4: "LP4",
  Summer: "Summer",
  Other: "Outside study periods",
};

/** "LP1", "LP3–LP4" for a course that runs over neighbouring study periods, or "LP1, LP3" for one that skips some. */
export function formatPeriods(periods: readonly StudyPeriod[]) {
  const [first = "Other", ...rest] = periods;
  const last = rest.at(-1);
  if (!last) return PERIOD_LABEL[first];
  const start = STUDY_PERIODS.indexOf(first);
  const neighbouring = periods.every((p, i) => STUDY_PERIODS.indexOf(p) === start + i);
  return neighbouring ? `${PERIOD_LABEL[first]}–${PERIOD_LABEL[last]}` : periods.map((p) => PERIOD_LABEL[p]).join(", ");
}

const credits = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
export const formatCredits = (value: number) => `${credits.format(value)} credits`;

const names = new Intl.ListFormat(LOCALE, { style: "long", type: "conjunction" });
/** "Examiner Ana Bove", or "Examiners …" for several. Null without names. */
export const formatExaminers = (examiners: readonly string[]) =>
  examiners.length ? `${examiners.length > 1 ? "Examiners" : "Examiner"} ${names.format(examiners)}` : null;
