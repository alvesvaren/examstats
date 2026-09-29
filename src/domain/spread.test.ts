import { describe, expect, it } from "vitest";
import { spreadOf } from "./spread.ts";

describe("spreadOf", () => {
  it("gives mean, median and population standard deviation", () => {
    // 1, 3, 3, 5: mean 3, deviations 4 + 0 + 0 + 4 over 4 answers.
    expect(
      spreadOf([
        [1, 1],
        [3, 2],
        [5, 1],
      ]),
    ).toEqual({ mean: 3, median: 3, sd: Math.sqrt(2), count: 4 });
  });

  it("averages the two middle values when the count is even", () => {
    expect(
      spreadOf([
        [3, 1],
        [4, 0],
        [5, 1],
      ]),
    ).toEqual({ mean: 4, median: 4, sd: 1, count: 2 });
    expect(
      spreadOf([
        [4, 3],
        [5, 3],
      ])?.median,
    ).toBe(4.5);
  });

  it("is null without values", () => {
    expect(
      spreadOf([
        [3, 0],
        [4, 0],
      ]),
    ).toBeNull();
    expect(spreadOf([])).toBeNull();
  });
});
