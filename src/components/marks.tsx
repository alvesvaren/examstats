import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ANSWER_SCALE } from "@/domain/evaluation";
import type { TrendPoint } from "@/domain/snapshot";
import type { Frequencies } from "@/domain/spread";
import { distributionMark } from "@/lib/distribution-mark";
import { useMessages } from "@/hooks/use-messages";

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

/** Rating per academic year on the fixed scale of the survey answers, so rows compare. */
export function Sparkline({ trend, interactive = true, className }: SparklineProps) {
  const t = useMessages();
  const first = trend[0];
  const last = trend.at(-1);
  if (!first || !last || trend.length < 2) return <span className={cn("w-22", className)} />;
  const [firstYear, firstRating] = first;
  const [lastYear, lastRating] = last;

  const x = (i: number) => SPARK_PAD + ((SPARK_WIDTH - 2 * SPARK_PAD) * i) / (trend.length - 1);
  const y = (rating: number) =>
    SPARK_PAD + (SPARK_HEIGHT - 2 * SPARK_PAD) * ((ANSWER_SCALE.max - rating) / (ANSWER_SCALE.max - ANSWER_SCALE.min));
  const path = trend.map(([, rating], i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(rating).toFixed(1)}`).join("");
  const svg = (
    <svg
      width={SPARK_WIDTH}
      height={SPARK_HEIGHT}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      className={cn("text-muted-foreground", interactive && "relative z-10", className)}
      aria-label={t.metrics.trend(first, last)}
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={x(trend.length - 1)} cy={y(lastRating)} r={2.5} className="fill-foreground" />
    </svg>
  );
  if (!interactive) return svg;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{svg}</TooltipTrigger>
      <TooltipContent className="tabular-nums">
        {t.format.academicYear(firstYear)}: {t.format.score(firstRating)} → {t.format.academicYear(lastYear)}: {t.format.score(lastRating)}
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
