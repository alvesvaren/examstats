import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TrendPoint } from "@/domain/snapshot";
import type { Spread } from "@/domain/spread";
import { formatAcademicYear, formatPercent } from "@/lib/format";

/** Bar length grows with the square root of `value`, so small courses stay visible next to large ones. */
export function SizeBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const width = max ? Math.sqrt(value / max) * 100 : 0;
  return (
    <span className={cn("flex h-2 w-16", className)}>
      <span className="rounded-sm bg-foreground/35" style={{ width: `${width}%` }} />
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
          <line x1={0} x2={SPARK_WIDTH} y1={y(0.5)} y2={y(0.5)} className="stroke-border" />
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
  const position = (x: number) => `${((x - min) / (max - min)) * 100}%`;
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

/** Literal class names per tone, so Tailwind can see them. */
const SPREAD_TONE = {
  grade: { dot: "bg-grade-5", band: "bg-grade-5/30" },
  neutral: { dot: "bg-foreground", band: "bg-foreground/20" },
} as const;

interface SpreadMarkProps {
  spread: Pick<Spread, "mean" | "median" | "sd">;
  min: number;
  max: number;
  tone?: keyof typeof SPREAD_TONE;
  className?: string;
}

/**
 * A compact box plot for a small scale: the dot is the mean, the tick the median, and the band one standard deviation
 * on either side of the mean. Quartiles would collapse onto whole grades, so the band shows spread instead.
 */
export function SpreadMark({ spread, min, max, tone = "neutral", className }: SpreadMarkProps) {
  const { mean, median, sd } = spread;
  const at = (value: number) => `${((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100}%`;
  const { dot, band } = SPREAD_TONE[tone];
  return (
    <span className={cn("relative h-2 w-12", className)} aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      <span
        className={cn("absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full", band)}
        style={{ left: at(mean - sd), right: `calc(100% - ${at(mean + sd)})` }}
      />
      <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-foreground/60" style={{ left: at(median) }} />
      <span
        className={cn("absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-background", dot)}
        style={{ left: at(mean) }}
      />
    </span>
  );
}
