import { GRADES, attemptsOf, type GradeCounts } from "./grades.ts";

interface LayoutOptions {
  width: number;
  gap: number;
  minWidth: number;
}

/** Places one column per sitting across `width`. Each column gets `minWidth` plus a share of the rest by attempts. */
export function layoutColumns<T extends { attempts: number }>(items: readonly T[], { width, gap, minWidth }: LayoutOptions) {
  const total = items.reduce((sum, item) => sum + item.attempts, 0);
  const spare = Math.max(0, width - gap * (items.length - 1) - minWidth * items.length);
  let x = 0;
  return items.map((item) => {
    const columnWidth = minWidth + (total ? (spare * item.attempts) / total : spare / items.length);
    const column = { item, x, width: columnWidth };
    x += columnWidth + gap;
    return column;
  });
}

/** Grade segments as shares from 0 at the bottom to 1 at the top, U at the bottom and the highest grade on top. */
export function stackSegments(counts: GradeCounts) {
  const attempts = attemptsOf(counts);
  let start = 0;
  return GRADES.filter((grade) => counts[grade] > 0).map((grade) => {
    const end = start + counts[grade] / attempts;
    const segment = { grade, start, end };
    start = end;
    return segment;
  });
}
