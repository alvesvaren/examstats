const LOCALE = "en-GB";

const percent = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 0 });
const count = new Intl.NumberFormat(LOCALE);
const grade = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });
const month = new Intl.DateTimeFormat(LOCALE, { month: "short", year: "numeric" });

const EMPTY = "–";

export const formatPercent = (value: number | null) => (value === null ? EMPTY : percent.format(value));
export const formatCount = (value: number) => count.format(value);
export const formatGrade = (value: number | null) => (value === null ? EMPTY : grade.format(value));
export const formatDay = (isoDate: string) => day.format(new Date(isoDate));
export const formatMonth = (isoDate: string | null) => (isoDate === null ? EMPTY : month.format(new Date(isoDate)));
export const formatAcademicYear = (year: number) => `${year}/${String(year + 1).slice(2)}`;
