import { describe, expect, it } from "vitest";
import { emptyCounts } from "./grades.ts";
import { layoutColumns, stackSegments } from "./timeline.ts";

describe("layoutColumns", () => {
  const sittings = [100, 300, 0.5].map((attempts, i) => ({ date: `2025-0${i + 1}-01`, attempts }));

  it("fills the width with gaps between columns and widths proportional to attempts", () => {
    const columns = layoutColumns(sittings, { width: 1000, gap: 2, minWidth: 3 });
    const last = columns.at(-1)!;
    expect(last.x + last.width).toBeCloseTo(1000);
    expect(columns[1]!.width - 3).toBeCloseTo(3 * (columns[0]!.width - 3));
  });

  it("keeps tiny sittings visible", () => {
    const columns = layoutColumns(sittings, { width: 1000, gap: 2, minWidth: 3 });
    expect(columns[2]!.width).toBeGreaterThanOrEqual(3);
  });
});

describe("stackSegments", () => {
  it("stacks U at the bottom and 5 at the top, as shares of the whole", () => {
    const segments = stackSegments({ ...emptyCounts(), U: 2, "3": 1, "5": 1 });
    expect(segments).toEqual([
      { grade: "U", start: 0, end: 0.5 },
      { grade: "3", start: 0.5, end: 0.75 },
      { grade: "5", start: 0.75, end: 1 },
    ]);
  });
});
