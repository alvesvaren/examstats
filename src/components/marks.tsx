import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TrendPoint } from "@/domain/snapshot";
import type { Frequencies } from "@/domain/spread";
import { distributionMark } from "@/lib/distribution-mark";
import { formatAcademicYear, formatPercent } from "@/lib/format";

/**
 * A fixed-width track filled up to `value`, so bars compare at a glance. The fill grows with the square root of
 * `value`, so small courses stay visible next to large ones.
 */
export function SizeBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const width = max ? Math.sqrt(value / max) * 100 : 0;
  return (
    <span className={cn("flex h-2 w-16 rounded-sm bg-foreground/8 dark:bg-foreground/3", className)}>
      <span className="rounded-sm bg-foreground/40" style={{ width: `${width}%` }} />
    </span>
  );
}

const SPARK_WIDTH = 88;
const SPARK_HEIGHT = 24;
const SPARK_PAD = 3;

interface SparklineProps {
  trend: readonly TrendPoint[];
  /** False on touch screens, where a tooltip inside a row link would swallow taps. */
  interactive?: boolean;
  className?: string;
}

/** Pass rate per academic year on a fixed 0 to 100% scale, so rows compare. */
export function Sparkline({ trend, interactive = true, className }: SparklineProps) {
  const first = trend[0];
  const last = trend.at(-1);
  if (!first || !last || trend.length < 2) return <span className={cn("w-22", className)} />;
  const [firstYear, firstRate] = first;
  const [lastYear, lastRate] = last;

  const x = (i: number) => SPARK_PAD + ((SPARK_WIDTH - 2 * SPARK_PAD) * i) / (trend.length - 1);
  const y = (rate: number) => SPARK_PAD + (SPARK_HEIGHT - 2 * SPARK_PAD) * (1 - rate);
  const path = trend.map(([, rate], i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(rate).toFixed(1)}`).join("");
  const svg = (
    <svg
      width={SPARK_WIDTH}
      height={SPARK_HEIGHT}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      className={cn("text-muted-foreground", interactive && "relative z-10", className)}
      aria-label={`Pass rate ${formatPercent(firstRate)} in ${formatAcademicYear(firstYear)}, ${formatPercent(lastRate)} in ${formatAcademicYear(lastYear)}`}
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={x(trend.length - 1)} cy={y(lastRate)} r={2.5} className="fill-foreground" />
    </svg>
  );
  if (!interactive) return svg;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{svg}</TooltipTrigger>
      <TooltipContent className="tabular-nums">
        {formatAcademicYear(firstYear)}: {formatPercent(firstRate)} → {formatAcademicYear(lastYear)}: {formatPercent(lastRate)}
      </TooltipContent>
    </Tooltip>
  );
}

interface DistributionMarkProps {
  frequencies: Frequencies;
  min: number;
  max: number;
  className?: string;
}

/**
 * How grades or answers spread over a small scale, drawn inside a track like {@link SizeBar}. Each value's slot is darker
 * the larger its share, blending into its neighbours, so an even spread stays light and a clear favourite stands out.
 * A tick that reaches past the track marks the median.
 */
export function DistributionMark({ frequencies, min, max, className }: DistributionMarkProps) {
  const { stops, median } = distributionMark(frequencies, min, max);
  const gradient = stops.map(({ at, shade }) => `color-mix(in oklab, var(--foreground) ${shade * 100}%, transparent) ${at}%`);
  return (
    <span className={cn("relative h-2 w-12 rounded-sm bg-foreground/10", className)} aria-hidden>
      <span className="absolute inset-0 rounded-sm" style={{ backgroundImage: `linear-gradient(to right, ${gradient.join(", ")})` }} />
      {median !== null && (
        <span className="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${median}%` }} />
      )}
    </span>
  );
}
