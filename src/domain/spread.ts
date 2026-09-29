/** How many times each value occurs, such as grades 3, 4 and 5 or survey answers 1 to 5. */
export type Frequencies = readonly (readonly [value: number, count: number])[];

export interface Spread {
  mean: number;
  median: number;
  /** Population standard deviation. */
  sd: number;
  count: number;
}

/** Mean, median and standard deviation of counted values, or null when there are none. */
export function spreadOf(frequencies: Frequencies): Spread | null {
  const sorted = frequencies.filter(([, count]) => count > 0).toSorted(([a], [b]) => a - b);
  const count = sorted.reduce((sum, [, n]) => sum + n, 0);
  if (!count) return null;

  const mean = sorted.reduce((sum, [value, n]) => sum + value * n, 0) / count;
  const variance = sorted.reduce((sum, [value, n]) => sum + n * (value - mean) ** 2, 0) / count;
  // The value at a 0-based position in the sorted list of all values.
  const at = (position: number) => {
    let seen = 0;
    return sorted.find(([, n]) => (seen += n) > position)![0];
  };
  const median = (at(Math.floor((count - 1) / 2)) + at(Math.floor(count / 2))) / 2;
  return { mean, median, sd: Math.sqrt(variance), count };
}
