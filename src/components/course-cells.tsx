import type { ReactNode } from "react";
import { cn } from "cn";
import { GradeBar, GradeTally } from "@/components/grade";
import { DistributionMark } from "@/components/marks";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RECENT_YEARS } from "@/domain/course-stats";
import { ANSWER_SCALE, EVALUATION_YEARS, answerFrequencies, type EvaluationSummary } from "@/domain/evaluation";
import { GRADE_SCALE, averageGradeOf, gradeFrequencies, passRateOf, type GradeCounts } from "@/domain/grades";
import { spreadOf, type Frequencies } from "@/domain/spread";
import { formatGrade, formatPercent, formatScore, formatSpread } from "@/lib/format";

export const RECENT_LABEL = `Main exam, last ${RECENT_YEARS} years`;
const RATING_LABEL = `Overall impression, last ${EVALUATION_YEARS} years`;

interface CellProps {
  muted?: boolean;
  /** False on touch screens, where a tooltip inside a row link would swallow taps. */
  interactive?: boolean;
}

interface StackedCellProps extends Pick<CellProps, "interactive"> {
  value: ReactNode;
  /** The mark under the value. */
  children: ReactNode;
  /** Shown when hovering anywhere on the value or the mark. */
  tooltip?: ReactNode;
  /** Sets the width of the cell to that of its mark. */
  className: string;
}

/** A value centred above a mark, right-aligned for table columns. */
export function StackedCell({ value, children, tooltip, className, interactive = true }: StackedCellProps) {
  const style = cn("ml-auto flex flex-col items-center gap-1.5 tabular-nums", className);
  // A tight line keeps the digits and the mark visually centred as one block.
  const content = (
    <>
      <span className="leading-none">{value}</span>
      {children}
    </>
  );
  if (!tooltip || !interactive) return <span className={style}>{content}</span>;
  // Above the row link, so hovering the cell shows the tooltip.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn("relative z-10", style)}>
          {content}
        </span>
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-1.5 tabular-nums">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/** Takes the place of a {@link DistributionCell}, so dashes line up with values in the same column. */
const EMPTY_CELL = <span className="ml-auto w-12 text-center text-muted-foreground">–</span>;

/** Pass rate with the grade bar it comes from, stacked or side by side. Shared by the course list and the course page. */
export function PassRateCell({ grades, muted, interactive, inline }: CellProps & { grades: GradeCounts; inline?: boolean }) {
  const value = formatPercent(passRateOf(grades));
  if (inline) {
    return (
      <span className="flex items-center justify-end gap-2 tabular-nums">
        {value}
        <GradeBar grades={grades} label={RECENT_LABEL} interactive={interactive} className={muted ? "opacity-50" : undefined} />
      </span>
    );
  }
  const tooltip = (
    <>
      {RECENT_LABEL}
      <GradeTally grades={grades} />
    </>
  );
  return (
    <StackedCell value={value} tooltip={tooltip} interactive={interactive} className="w-16">
      <GradeBar grades={grades} interactive={false} className={muted ? "opacity-50" : undefined} />
    </StackedCell>
  );
}

interface DistributionCellProps extends CellProps {
  value: string;
  frequencies: Frequencies;
  scale: { min: number; max: number };
  tone?: "grade" | "neutral";
  /** What the values are, shown above them on hover. */
  label: string;
}

/** A value above the distribution it comes from. */
export function DistributionCell({ value, frequencies, scale, tone, label, muted, interactive }: DistributionCellProps) {
  const spread = spreadOf(frequencies);
  const tooltip = (
    <>
      {label}
      {spread && <span>{formatSpread(spread)}</span>}
    </>
  );
  return (
    <StackedCell value={value} tooltip={tooltip} interactive={interactive} className="w-12">
      <DistributionMark frequencies={frequencies} {...scale} tone={tone} className={muted ? "opacity-50" : undefined} />
    </StackedCell>
  );
}

export function AverageGradeCell({ grades, muted, interactive }: CellProps & { grades: GradeCounts }) {
  const average = averageGradeOf(grades);
  if (average === null) return EMPTY_CELL;
  return (
    <DistributionCell
      value={formatGrade(average)}
      frequencies={gradeFrequencies(grades)}
      scale={GRADE_SCALE}
      tone="grade"
      label={RECENT_LABEL}
      muted={muted}
      interactive={interactive}
    />
  );
}

/** Overall impression from course surveys. Shared by the course list and the course page. */
export function RatingCell({ evaluation, muted, interactive }: CellProps & { evaluation: EvaluationSummary | null }) {
  if (!evaluation) return EMPTY_CELL;
  return (
    <DistributionCell
      value={formatScore(evaluation.mean)}
      frequencies={answerFrequencies(evaluation.overallAnswers)}
      scale={ANSWER_SCALE}
      label={RATING_LABEL}
      muted={muted}
      interactive={interactive}
    />
  );
}
