import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GRADE_STYLE } from "@/components/grade-style";
import { GRADES, type Grade, type GradeCounts } from "@/domain/grades";
import { formatCount } from "@/lib/format";

/** A grade shown as a coloured tile with its label inside. */
export function GradeChip({ grade, className }: { grade: Grade; className?: string }) {
  const { bg, text } = GRADE_STYLE[grade];
  return (
    <span className={cn("inline-grid h-5 min-w-5 place-items-center rounded px-1 text-xs font-semibold tabular-nums", bg, text, className)}>
      {grade}
    </span>
  );
}

/** Each grade present, as a chip followed by its count. */
export function GradeTally({ grades, className }: { grades: GradeCounts; className?: string }) {
  return (
    <span className={cn("flex flex-wrap gap-x-3 gap-y-1 tabular-nums", className)}>
      {GRADES.filter((grade) => grades[grade] > 0).map((grade) => (
        <span key={grade} className="inline-flex items-center gap-1">
          <GradeChip grade={grade} />
          {formatCount(grades[grade])}
        </span>
      ))}
    </span>
  );
}

interface GradeBarProps {
  grades: GradeCounts;
  label?: string;
  className?: string;
  /** Touch screens cannot hover, so a bar without a tooltip lets taps reach the row link underneath. */
  interactive?: boolean;
}

/** Grade distribution as one thin bar, U first. Hover shows the counts. */
export function GradeBar({ grades, label, className, interactive = true }: GradeBarProps) {
  const present = GRADES.filter((grade) => grades[grade] > 0);
  if (!present.length) return <span className={cn("h-2 w-16 rounded-sm bg-muted", className)} />;
  const bar = (
    <span className="flex h-2 w-full gap-px overflow-hidden rounded-sm">
      {present.map((grade) => (
        <span key={grade} className={GRADE_STYLE[grade].bg} style={{ flexGrow: grades[grade] }} />
      ))}
    </span>
  );
  if (!interactive) return <span className={cn("flex w-16", className)}>{bar}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={present.map((grade) => `${grade}: ${grades[grade]}`).join(", ")}
          className={cn("relative z-10 -my-2 flex h-6 w-16 items-center", className)}
        >
          {bar}
        </span>
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-1.5">
        {label}
        <GradeTally grades={grades} />
      </TooltipContent>
    </Tooltip>
  );
}
