import type { Language } from "../domain/names.ts";
import { STUDY_PERIODS, type StudyPeriod } from "../domain/programme-plans.ts";

/** The locale each language formats numbers and dates in. */
const LOCALES = { en: "en-GB", sv: "sv-SE" } as const satisfies Record<Language, string>;

const EMPTY = "–";

/** Numbers, dates and lists written the way `locale` writes them. Words around them live in the messages. */
function createFormat(locale: string) {
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const count = new Intl.NumberFormat(locale);
  const grade = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const score = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const credits = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const month = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
  const and = new Intl.ListFormat(locale, { style: "long", type: "conjunction" });
  const or = new Intl.ListFormat(locale, { style: "long", type: "disjunction" });
  const plural = new Intl.PluralRules(locale);

  return {
    percent: (value: number | null) => (value === null ? EMPTY : percent.format(value)),
    count: (value: number) => count.format(value),
    grade: (value: number | null) => (value === null ? EMPTY : grade.format(value)),
    score: (value: number | null) => (value === null ? EMPTY : score.format(value)),
    number: (value: number) => number.format(value),
    credits: (value: number) => credits.format(value),
    day: (isoDate: string) => day.format(new Date(isoDate)),
    month: (isoDate: string | null) => (isoDate === null ? EMPTY : month.format(new Date(isoDate))),
    academicYear: (year: number) => `${year}/${String(year + 1).slice(2)}`,
    /** "Ana Bove and Moa Johansson". */
    list: (items: readonly string[]) => and.format(items),
    /** "A or B". */
    either: (items: readonly string[]) => or.format(items),
    /** The items and the words between them, such as ", " and " and ", to render the items as links. */
    listParts: (items: readonly string[]) => and.formatToParts(items),
    /** Whether `value` takes the singular form of a word. */
    isOne: (value: number) => plural.select(value) === "one",
  };
}

export type Format = ReturnType<typeof createFormat>;

export const FORMATS: Record<Language, Format> = { en: createFormat(LOCALES.en), sv: createFormat(LOCALES.sv) };

/**
 * Writes study periods with `labels`: "LP1", "LP3–LP4" for a course that runs over neighbouring study periods, or
 * "LP1, LP3" for one that skips some.
 */
export const periodsWith = (labels: Record<StudyPeriod, string>) => (periods: readonly StudyPeriod[]) => {
  const [first = "Other", ...rest] = periods;
  const last = rest.at(-1);
  if (!last) return labels[first];
  const start = STUDY_PERIODS.indexOf(first);
  const neighbouring = periods.every((p, i) => STUDY_PERIODS.indexOf(p) === start + i);
  return neighbouring ? `${labels[first]}–${labels[last]}` : periods.map((p) => labels[p]).join(", ");
};
