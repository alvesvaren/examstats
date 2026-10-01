import { expect, it } from "vitest";
import { distributionMark } from "./distribution-mark.ts";

it("shades each value by its share and places the median between the middle values", () => {
  const frequencies = [
    [1, 0],
    [2, 0],
    [3, 6],
    [4, 3],
    [5, 1],
  ] as const;
  const { stops, median } = distributionMark(frequencies, 1, 5);
  expect(stops.map(({ at }) => at)).toEqual([10, 30, 50, 70, 90]);
  // Shares of 60% or more get the darkest shade, 0.7. Smaller shares scale down from there.
  expect(stops.map(({ shade }) => shade)).toEqual([0, 0, 0.7, 0.35, expect.closeTo(0.117)]);
  expect(median).toBe(50);
});

it("leaves an empty distribution light and without a median", () => {
  expect(distributionMark([[1, 0]], 1, 5)).toEqual({ stops: [{ at: 10, shade: 0 }], median: null });
});
