import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TrendPoint } from "@/domain/snapshot";
import { spreadOf, type Frequencies } from "@/domain/spread";
import { formatAcademicYear, formatPercent } from "@/lib/format";

/**
 * A fixed-width track filled up to `value`, so bars compare at a glance. The fill grows with the square root of
 * `value`, so small courses stay visible next to large ones.
 */
export function SizeBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const width = max ? Math.sqrt(value / max) * 100 : 0;
  return (
    <span className={cn("flex h-2 w-16 rounded-sm bg-foreground/10", className)}>
      <span className="rounded-sm bg-foreground/40" style={{ width: `${width}%` }} />
    </span>
  );
}

const SPARK_WIDTH = 88;
const SPARK_HEIGHT = 24;
const SPARK_PAD = 3;

/** Pass rate per academic year on a fixed 0 to 100% scale, so rows compare. */
export function Sparkline({ trend, className }: { trend: readonly TrendPoint[]; className?: string }) {
  const first = trend[0];
  const last = trend.at(-1);
  if (!first || !last || trend.length < 2) return <span className={cn("w-22", className)} />;

  const x = (i: number) => SPARK_PAD + ((SPARK_WIDTH - 2 * SPARK_PAD) * i) / (trend.length - 1);
  const y = (rate: number) => SPARK_PAD + (SPARK_HEIGHT - 2 * SPARK_PAD) * (1 - rate);
  const path = trend.map((t, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(t.passRate).toFixed(1)}`).join("");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <svg
          width={SPARK_WIDTH}
          height={SPARK_HEIGHT}
          viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
          className={cn("relative z-10 text-muted-foreground", className)}
          aria-label={`Pass rate ${formatPercent(first.passRate)} in ${formatAcademicYear(first.academicYear)}, ${formatPercent(last.passRate)} in ${formatAcademicYear(last.academicYear)}`}
        >
          <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
          <circle cx={x(trend.length - 1)} cy={y(last.passRate)} r={2.5} className="fill-foreground" />
        </svg>
      </TooltipTrigger>
      <TooltipContent className="tabular-nums">
        {formatAcademicYear(first.academicYear)}: {formatPercent(first.passRate)} → {formatAcademicYear(last.academicYear)}:{" "}
        {formatPercent(last.passRate)}
      </TooltipContent>
    </Tooltip>
  );
}

/** The scales are whole steps, so each step gets a slot this wide on either side and values at the ends stay inside. */
const HALF_STEP = 0.5;

interface ScaleDotProps {
  value: number;
  min: number;
  max: number;
  /** Marks a reference point on the track, such as the balanced middle of a too low to too high scale. */
  mark?: number;
  dotClassName?: string;
  className?: string;
}

/** A value as a dot on a track from `min` to `max`. */
export function ScaleDot({ value, min, max, mark, dotClassName = "bg-foreground", className }: ScaleDotProps) {
  const position = (x: number) => `${((x - min + HALF_STEP) / (max - min + 2 * HALF_STEP)) * 100}%`;
  return (
    <span className={cn("relative h-3 w-12", className)} aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-border" />
      {mark !== undefined && (
        <span className="absolute inset-y-0 w-px -translate-x-1/2 bg-muted-foreground" style={{ left: position(mark) }} />
      )}
      <span
        className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background", dotClassName)}
        style={{ left: position(value) }}
      />
    </span>
  );
}

/** Colour per tone, and how dark the most common value gets in percent. */
const DISTRIBUTION_TONE = {
  grade: { color: "var(--grade-5)", peak: 100 },
  neutral: { color: "var(--foreground)", peak: 70 },
} as const;

interface DistributionMarkProps {
  frequencies: Frequencies;
  min: number;
  max: number;
  tone?: keyof typeof DISTRIBUTION_TONE;
  className?: string;
}

/**
 * How grades or answers spread over a small scale, drawn inside a track like {@link SizeBar}. Each value's slot is as
 * dark as the value is common, blending into its neighbours. A tick that reaches past the track marks the median.
 */
export function DistributionMark({ frequencies, min, max, tone = "neutral", className }: DistributionMarkProps) {
  const at = (value: number) => ((value - min + HALF_STEP) / (max - min + 2 * HALF_STEP)) * 100;
  const { color, peak } = DISTRIBUTION_TONE[tone];
  const largest = Math.max(1, ...frequencies.map(([, count]) => count));
  const stops = frequencies
    .toSorted(([a], [b]) => a - b)
    .map(([value, count]) => `color-mix(in oklab, ${color} ${(count / largest) * peak}%, transparent) ${at(value)}%`);
  const median = spreadOf(frequencies)?.median;
  return (
    <span className={cn("relative h-2 w-12 rounded-sm bg-foreground/10", className)} aria-hidden>
      <span className="absolute inset-0 rounded-sm" style={{ backgroundImage: `linear-gradient(to right, ${stops.join(", ")})` }} />
      {median !== undefined && (
        <span className="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${at(median)}%` }} />
      )}
    </span>
  );
}
