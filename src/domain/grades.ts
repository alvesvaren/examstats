import { z } from "zod";
import { spreadOf } from "./spread.ts";

const count = z.number().int().nonnegative();

/** Display order everywhere: fail first, then passing grades from lowest to highest. */
export const GRADES = ["U", "3", "4", "5", "G", "VG", "TG"] as const;
export type Grade = (typeof GRADES)[number];

// Built from GRADES because object keys like "3" sort before "U", so the schema cannot hold the order.
export const gradeCountsSchema = z.object(Object.fromEntries(GRADES.map((grade) => [grade, count])) as Record<Grade, typeof count>);

export type GradeCounts = z.infer<typeof gradeCountsSchema>;
export const FAIL_GRADE = "U" satisfies Grade;

/** Grades that carry a number and count toward the average grade. */
const NUMERIC_GRADES = ["3", "4", "5"] as const satisfies readonly Grade[];
export const GRADE_SCALE = { min: Number(NUMERIC_GRADES[0]), max: Number(NUMERIC_GRADES[NUMERIC_GRADES.length - 1]) };

export const emptyCounts = (): GradeCounts => ({ U: 0, "3": 0, "4": 0, "5": 0, G: 0, VG: 0, TG: 0 });

export function sumCounts(list: readonly GradeCounts[]): GradeCounts {
  return list.reduce((sum, counts) => {
    for (const grade of GRADES) sum[grade] += counts[grade];
    return sum;
  }, emptyCounts());
}

export const attemptsOf = (counts: GradeCounts) => GRADES.reduce((sum, grade) => sum + counts[grade], 0);

export const passesOf = (counts: GradeCounts) => attemptsOf(counts) - counts[FAIL_GRADE];

/** Share of attempts that passed, or null when there are no attempts. */
export function passRateOf(counts: GradeCounts): number | null {
  const attempts = attemptsOf(counts);
  return attempts ? passesOf(counts) / attempts : null;
}

/** Mean, median and spread of grades 3 to 5, or null when the counts have no numeric grades. */
export const gradeSpreadOf = (counts: GradeCounts) => spreadOf(NUMERIC_GRADES.map((grade) => [Number(grade), counts[grade]]));

export const averageGradeOf = (counts: GradeCounts) => gradeSpreadOf(counts)?.mean ?? null;
