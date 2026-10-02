/**
 * The geometry of a distribution mark, shared by the `DistributionMark` component and the link preview image, which
 * draws the same mark without CSS variables. The image's function imports this file, so imports use relative paths.
 */
import { spreadOf, type Frequencies } from "../domain/spread.ts";

/** The scales are whole steps, so each step gets a slot this wide on either side and values at the ends stay inside. */
const HALF_STEP = 0.5;

/** A value with this share of all answers or more gets the darkest shade. */
const FULL_SHARE = 0.6;
/** The darkest shade, as a share of the foreground colour. */
const DARKEST = 0.7;

/**
 * Gradient stops, one per value, each as a position in percent of the track and a shade from 0 to {@link DARKEST}, and
 * the median's position, or null without values.
 */
export function distributionMark(frequencies: Frequencies, min: number, max: number) {
  const at = (value: number) => ((value - min + HALF_STEP) / (max - min + 2 * HALF_STEP)) * 100;
  const total = frequencies.reduce((sum, [, count]) => sum + count, 0);
  const shade = (count: number) => (total ? Math.min(1, count / total / FULL_SHARE) * DARKEST : 0);
  const median = spreadOf(frequencies)?.median;
  return {
    stops: frequencies.toSorted(([a], [b]) => a - b).map(([value, count]) => ({ at: at(value), shade: shade(count) })),
    median: median === undefined ? null : at(median),
  };
}
