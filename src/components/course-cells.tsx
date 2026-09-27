import { GradeBar } from "@/components/grade";
import { GradeScale } from "@/components/marks";
import { RECENT_YEARS } from "@/domain/course-stats";
import { averageGradeOf, passRateOf, type GradeCounts } from "@/domain/grades";
import { formatGrade, formatPercent } from "@/lib/format";

const RECENT_LABEL = `Main exam, last ${RECENT_YEARS} years`;

/** Pass rate with the grade bar it comes from. Shared by the course list and the course page. */
export function PassRateCell({ grades, muted, interactive }: { grades: GradeCounts; muted?: boolean; interactive?: boolean }) {
  return (
    <span className="flex items-center justify-end gap-2 tabular-nums">
      {formatPercent(passRateOf(grades))}
      <GradeBar grades={grades} label={RECENT_LABEL} interactive={interactive} className={muted ? "opacity-50" : undefined} />
    </span>
  );
}

export function AverageGradeCell({ grades, muted }: { grades: GradeCounts; muted?: boolean }) {
  const average = averageGradeOf(grades);
  if (average === null) return <span className="text-right text-muted-foreground">–</span>;
  return (
    <span className="flex items-center justify-end gap-2 tabular-nums">
      {formatGrade(average)}
      <GradeScale average={average} className={muted ? "opacity-50" : undefined} />
    </span>
  );
}
