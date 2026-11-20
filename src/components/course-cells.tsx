import type { ReactNode } from "react";
import { cn } from "cn";
import { GradeBar, GradeTally } from "@/components/grade";
import { DistributionMark } from "@/components/marks";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ANSWER_SCALE, answerFrequencies, meanAnswer, type Question } from "@/domain/evaluation";
import { gradeSpreadOf, passRateOf, type GradeCounts } from "@/domain/grades";
import { spreadOf, type Frequencies } from "@/domain/spread";
import { useMessages } from "@/hooks/use-messages";

interface CellProps {
  muted?: boolean;
  /** False on touch screens, where a tooltip inside a row link would swallow taps. */
  interactive?: boolean;
}

interface StackedCellProps extends Pick<CellProps, "interactive"> {
  value: ReactNode;
  /** The mark under the value, if any. */
  children?: ReactNode;
  /** Shown when hovering anywhere on the value or the mark. */
  tooltip?: ReactNode;
  /** Sets the width of the cell, usually to that of its mark. */
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

/** Takes the place of a stacked cell as wide as `className` makes it, so dashes line up with values in the same column. */
const emptyCell = (className: string) => <span className={cn("ml-auto text-center text-muted-foreground", className)}>–</span>;

/** Pass rate above the grade bar it comes from. Shared by the course list and the course page. */
export function PassRateCell({ grades, muted, interactive }: CellProps & { grades: GradeCounts }) {
  const t = useMessages();
  const value = t.format.percent(passRateOf(grades));
  const tooltip = (
    <>
      {t.metrics.recent}
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
  /** What the values are, shown above them on hover. */
  label: string;
}

/** A value above the distribution it comes from. */
export function DistributionCell({ value, frequencies, scale, label, muted, interactive }: DistributionCellProps) {
  const t = useMessages();
  const spread = spreadOf(frequencies);
  const tooltip = (
    <>
      {label}
      {spread && <span>{t.spread(spread)}</span>}
    </>
  );
  return (
    <StackedCell value={value} tooltip={tooltip} interactive={interactive} className="w-12">
      <DistributionMark frequencies={frequencies} {...scale} className={muted ? "opacity-50" : undefined} />
    </StackedCell>
  );
}

/** Average grade on its own. The pass rate bar beside it already shows how the grades spread. */
export function AverageGradeCell({ grades, interactive }: Pick<CellProps, "interactive"> & { grades: GradeCounts }) {
  const t = useMessages();
  const spread = gradeSpreadOf(grades);
  if (!spread) return emptyCell("w-12");
  const tooltip = (
    <>
      {t.metrics.recent}
      <span>{t.spread(spread)}</span>
    </>
  );
  return <StackedCell value={t.format.grade(spread.mean)} tooltip={tooltip} interactive={interactive} className="w-12" />;
}

interface SurveyCellProps extends CellProps {
  question: Question;
  /** How many gave each answer, or none when too few answered. */
  answers: readonly number[] | undefined;
}

/** The mean answer to a course survey question above how the answers spread. The overall impression is the rating. */
export function SurveyCell({ question, answers, muted, interactive }: SurveyCellProps) {
  const t = useMessages();
  if (!answers) return emptyCell("w-12");
  return (
    <DistributionCell
      value={t.format.score(meanAnswer(answers))}
      frequencies={answerFrequencies(answers)}
      scale={ANSWER_SCALE}
      label={t.survey.window(question)}
      muted={muted}
      interactive={interactive}
    />
  );
}
