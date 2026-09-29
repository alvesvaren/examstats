import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { AverageGradeCell, PassRateCell } from "@/components/course-cells";
import { GradeBar, GradeChip } from "@/components/grade";
import { GRADE_STYLE } from "@/components/grade-style";
import { partLabel, type CatalogCourse } from "@/domain/catalog";
import { GRADES, attemptsOf, passRateOf, sumCounts } from "@/domain/grades";
import type { Part } from "@/domain/snapshot";
import { formatCount, formatMonth, formatPercent } from "@/lib/format";

const MAX_LISTED = 8;

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-medium text-muted-foreground">{children}</h2>;
}

export function GradeBreakdown({ part }: { part: Part }) {
  const counts = sumCounts(part.sittings.map((s) => s.grades));
  const total = attemptsOf(counts);
  const grades = GRADES.filter((grade) => counts[grade] > 0);
  return (
    <section>
      <SectionTitle>Grades, all {formatCount(total)} attempts</SectionTitle>
      <div className="flex h-6 gap-px overflow-hidden rounded-md">
        {grades.map((grade) => (
          <span key={grade} className={GRADE_STYLE[grade].bg} style={{ flexGrow: counts[grade] }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-col-reverse gap-1.5 text-sm tabular-nums">
        {grades.map((grade) => (
          <li key={grade} className="flex items-center gap-2">
            <GradeChip grade={grade} />
            {formatCount(counts[grade])}
            <span className="ml-auto text-muted-foreground">{formatPercent(counts[grade] / total)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OtherParts({ parts, selected }: { parts: Part[]; selected: number }) {
  const others = parts.map((part, index) => ({ part, index })).filter(({ index }) => index !== selected);
  if (!others.length) return null;
  return (
    <section>
      <SectionTitle>Other parts</SectionTitle>
      <ul className="flex flex-col text-sm">
        {others.slice(0, MAX_LISTED).map(({ part, index }) => {
          const counts = sumCounts(part.sittings.map((s) => s.grades));
          return (
            <li key={index} className="border-t first:border-t-0">
              <Link from="/course/$code" search={{ part: index }} className="flex items-center gap-3 py-2 hover:underline">
                <span className="min-w-0 flex-1 truncate">{partLabel(part.type)}</span>
                <span className="text-muted-foreground tabular-nums">{formatPercent(passRateOf(counts))}</span>
                <GradeBar grades={counts} label={partLabel(part.type)} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const INSTANCE_GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 sm:grid-cols-[minmax(0,1fr)_8.5rem_4.5rem_5.5rem]";

export function OtherInstances({ courses, programmes }: { courses: CatalogCourse[]; programmes: Record<string, string> }) {
  if (!courses.length) return null;
  return (
    <section>
      <SectionTitle>Other instances</SectionTitle>
      <div className={cn(INSTANCE_GRID, "border-b pb-2 text-xs text-muted-foreground")}>
        <span>Course</span>
        <span className="text-right">Pass rate</span>
        <span className="hidden text-right sm:block">Grade</span>
        <span className="hidden text-right sm:block">Last exam</span>
      </div>
      <ul className="flex flex-col text-sm">
        {courses.slice(0, MAX_LISTED).map((course) => (
          <li
            key={course.code}
            className={cn(INSTANCE_GRID, "relative border-b py-2 hover:bg-muted/50", course.ended && "text-muted-foreground")}
          >
            <span className="min-w-0">
              <Link to="/course/$code" params={{ code: course.code }} className="font-medium tabular-nums after:absolute after:inset-0">
                {course.code}
              </Link>
              <span className="block truncate text-xs text-muted-foreground">{course.programme ? programmes[course.programme] : ""}</span>
            </span>
            <PassRateCell grades={course.recentGrades} muted={course.ended} />
            <span className="hidden sm:block">
              <AverageGradeCell grades={course.recentGrades} />
            </span>
            <span className="hidden text-right tabular-nums sm:block">{formatMonth(course.lastResult)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
