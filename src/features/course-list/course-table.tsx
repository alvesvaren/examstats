import { Link } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import { AverageGradeCell, PassRateCell } from "@/components/course-cells";
import { SizeBar, Sparkline } from "@/components/marks";
import { MetricInfo, type Metric } from "@/components/metric-label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CatalogCourse, SortDir, SortKey } from "@/domain/catalog";
import { useWindowVirtualList } from "@/hooks/use-window-virtual-list";
import { formatCount, formatMonth, formatPercent } from "@/lib/format";

const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-2 md:grid-cols-[minmax(0,1fr)_5.5rem_8.5rem_8rem_5.5rem_7rem_5.5rem]";
const ROW_HEIGHT = 57;

interface Column {
  key: SortKey;
  label: string;
  metric?: Metric;
  align?: "end";
  mobile?: boolean;
}

const COLUMNS: Column[] = [
  { key: "name", label: "Course", mobile: true },
  { key: "programme", label: "Programme" },
  { key: "attemptsPerYear", label: "Attempts/yr", metric: "attemptsPerYear", align: "end" },
  { key: "passRate", label: "Pass rate", metric: "passRate", align: "end" },
  { key: "trend", label: "Trend", metric: "trend", align: "end", mobile: true },
  { key: "averageGrade", label: "Grade", metric: "averageGrade", align: "end" },
  { key: "lastResult", label: "Last exam", align: "end" },
];

type Item = { kind: "course"; course: CatalogCourse } | { kind: "ended"; count: number };

interface CourseTableProps {
  active: CatalogCourse[];
  ended: CatalogCourse[];
  showEnded: boolean;
  onToggleEnded: () => void;
  sort: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  programmes: Record<string, string>;
  maxAttempts: number;
}

export function CourseTable({ active, ended, showEnded, onToggleEnded, sort, dir, onSort, programmes, maxAttempts }: CourseTableProps) {
  const items: Item[] = [
    ...active.map((course) => ({ kind: "course" as const, course })),
    ...(ended.length ? [{ kind: "ended" as const, count: ended.length }] : []),
    ...(showEnded ? ended.map((course) => ({ kind: "course" as const, course })) : []),
  ];
  const { listRef, virtualizer } = useWindowVirtualList({ count: items.length, estimateSize: ROW_HEIGHT });

  if (!items.length) return <p className="py-10 text-center text-muted-foreground">No courses match.</p>;

  return (
    <div>
      <div className={cn(ROW_GRID, "sticky top-0 z-20 border-b bg-background py-2 text-xs text-muted-foreground")}>
        {COLUMNS.map((column) => (
          <SortHeader key={column.key} column={column} sort={sort} dir={dir} onSort={onSort} />
        ))}
      </div>
      <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const item = items[row.index]!;
          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              className="absolute inset-x-0 top-0"
              style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)` }}
            >
              {item.kind === "course" ? (
                <CourseRow course={item.course} programmeName={item.course.programme ? programmes[item.course.programme] : undefined} maxAttempts={maxAttempts} />
              ) : (
                <button
                  type="button"
                  onClick={onToggleEnded}
                  aria-expanded={showEnded}
                  className="flex w-full items-center justify-between border-b px-2 py-4 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Ended courses · {formatCount(item.count)}
                  <ChevronDownIcon className={cn("size-4 transition-transform", showEnded && "rotate-180")} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SortHeader({ column, sort, dir, onSort }: { column: Column; sort: SortKey; dir: SortDir; onSort: (key: SortKey) => void }) {
  const isActive = sort === column.key;
  const Arrow = dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <div
      className={cn("items-center gap-1", column.mobile ? "flex" : "hidden md:flex", column.align === "end" && "justify-end")}
      aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className={cn("inline-flex items-center gap-0.5 font-medium hover:text-foreground", isActive && "text-foreground")}
      >
        {column.label}
        {isActive && <Arrow className="size-3" aria-hidden />}
      </button>
      {column.metric && <MetricInfo metric={column.metric} name={column.label.toLowerCase()} />}
    </div>
  );
}

function CourseRow({ course, programmeName, maxAttempts }: { course: CatalogCourse; programmeName?: string; maxAttempts: number }) {
  const muted = course.ended && "opacity-50";
  return (
    <div className={cn(ROW_GRID, "relative border-b py-2.5 hover:bg-muted/50", course.ended && "text-muted-foreground")}>
      <div className="min-w-0">
        <Link
          to="/course/$code"
          params={{ code: course.code }}
          className={cn("block truncate after:absolute after:inset-0", course.ended ? "font-normal" : "font-medium")}
        >
          {course.name}
        </Link>
        <div className="flex gap-2 text-xs text-muted-foreground tabular-nums">
          <span>{course.code}</span>
          <span className="md:hidden">
            {formatCount(course.attemptsPerYear)}/yr · {formatPercent(course.passRate)}
          </span>
        </div>
      </div>
      <div className="hidden md:block">
        {course.programme && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" asChild className="relative z-10">
                <Link to="/" search={{ programme: course.programme }}>
                  {course.programme}
                </Link>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{programmeName ?? course.programme}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="hidden items-center justify-end gap-2 tabular-nums md:flex">
        {formatCount(course.attemptsPerYear)}
        <SizeBar value={course.attemptsPerYear} max={maxAttempts} className={cn(muted)} />
      </div>
      <div className="hidden justify-end md:flex">
        <PassRateCell grades={course.recentGrades} muted={course.ended} />
      </div>
      <div className="flex justify-end">
        <Sparkline trend={course.trend} className={cn(muted)} />
      </div>
      <div className="hidden justify-end md:flex">
        <AverageGradeCell grades={course.recentGrades} muted={course.ended} />
      </div>
      <div className="hidden text-right tabular-nums md:block">{formatMonth(course.lastResult)}</div>
    </div>
  );
}
