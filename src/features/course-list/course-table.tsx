import { Link } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import { AverageGradeCell, PassRateCell } from "@/components/course-cells";
import { SizeBar, Sparkline } from "@/components/marks";
import { MetricInfo, type Metric } from "@/components/metric-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { defaultSortDir, type CatalogCourse, type SortDir, type SortKey } from "@/domain/catalog";
import { useWindowVirtualList } from "@/hooks/use-window-virtual-list";
import { formatCount, formatMonth } from "@/lib/format";

const DESKTOP_GRID = "grid grid-cols-[minmax(0,1fr)_5.5rem_8.5rem_8rem_5.5rem_7rem_5.5rem] items-center gap-x-4";
const ROW_HEIGHT = 84;

interface Column {
  key: SortKey;
  label: string;
  metric?: Metric;
  align?: "end";
}

const COLUMNS: Column[] = [
  { key: "name", label: "Course" },
  { key: "programme", label: "Programme" },
  { key: "attemptsPerYear", label: "Attempts/yr", metric: "attemptsPerYear", align: "end" },
  { key: "passRate", label: "Pass rate", metric: "passRate", align: "end" },
  { key: "trend", label: "Trend", metric: "trend", align: "end" },
  { key: "averageGrade", label: "Grade", metric: "averageGrade", align: "end" },
  { key: "lastResult", label: "Last exam", align: "end" },
];

const flip = (dir: SortDir): SortDir => (dir === "asc" ? "desc" : "asc");

type Item = { kind: "course"; course: CatalogCourse } | { kind: "ended"; count: number };

interface CourseTableProps {
  active: CatalogCourse[];
  ended: CatalogCourse[];
  showEnded: boolean;
  onToggleEnded: () => void;
  sort: SortKey;
  dir: SortDir;
  onSortChange: (sort: SortKey, dir: SortDir) => void;
  programmes: Record<string, string>;
  maxAttempts: number;
}

export function CourseTable({ active, ended, showEnded, onToggleEnded, sort, dir, onSortChange, programmes, maxAttempts }: CourseTableProps) {
  const items: Item[] = [
    ...active.map((course) => ({ kind: "course" as const, course })),
    ...(ended.length ? [{ kind: "ended" as const, count: ended.length }] : []),
    ...(showEnded ? ended.map((course) => ({ kind: "course" as const, course })) : []),
  ];
  const { listRef, virtualizer } = useWindowVirtualList({ count: items.length, estimateSize: ROW_HEIGHT });
  const sortBy = (key: SortKey) => onSortChange(key, key === sort ? flip(dir) : defaultSortDir(key));

  if (!items.length) return <p className="py-10 text-center text-muted-foreground">No courses match.</p>;

  return (
    <div>
      <div className={cn(DESKTOP_GRID, "sticky top-0 z-20 hidden border-b bg-background px-2 py-2 text-xs text-muted-foreground md:grid")}>
        {COLUMNS.map((column) => (
          <SortHeader key={column.key} column={column} sort={sort} dir={dir} onSort={sortBy} />
        ))}
      </div>
      <MobileSortBar sort={sort} dir={dir} onSortChange={onSortChange} />
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
      className={cn("flex items-center gap-1", column.align === "end" && "justify-end")}
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

/** Column headers do not fit on a phone, so sorting gets its own controls. */
function MobileSortBar({ sort, dir, onSortChange }: Pick<CourseTableProps, "sort" | "dir" | "onSortChange">) {
  const Arrow = dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
  const select = (value: string) => {
    const column = COLUMNS.find((c) => c.key === value);
    if (column) onSortChange(column.key, defaultSortDir(column.key));
  };
  // 16px text, because iOS zooms into focused fields with smaller text.
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background py-2 md:hidden">
      <span className="text-sm text-muted-foreground">Sort by</span>
      <NativeSelect value={sort} onChange={(event) => select(event.target.value)} aria-label="Sort by" className="[&_select]:text-base">
        {COLUMNS.map((column) => (
          <NativeSelectOption key={column.key} value={column.key}>
            {column.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Button variant="ghost" size="icon-sm" onClick={() => onSortChange(sort, flip(dir))} aria-label={dir === "asc" ? "Sort descending" : "Sort ascending"}>
        <Arrow />
      </Button>
    </div>
  );
}

interface CourseRowProps {
  course: CatalogCourse;
  programmeName?: string;
  maxAttempts: number;
}

/** The whole row links to the course. Controls inside it sit above the link with `relative z-10`. */
function CourseRow({ course, programmeName, maxAttempts }: CourseRowProps) {
  return (
    <div className={cn("relative border-b px-2 hover:bg-muted/50", course.ended && "text-muted-foreground")}>
      <Link to="/course/$code" params={{ code: course.code }} className="absolute inset-0" aria-label={`${course.code} ${course.name}`} />
      <MobileRow course={course} maxAttempts={maxAttempts} />
      <DesktopRow course={course} programmeName={programmeName} maxAttempts={maxAttempts} />
    </div>
  );
}

function MobileRow({ course, maxAttempts }: Omit<CourseRowProps, "programmeName">) {
  return (
    <div className="flex flex-col gap-1 py-3 md:hidden">
      <div className="flex items-center justify-between gap-3">
        <span className={cn("text-lg tabular-nums", course.ended ? "font-medium" : "font-semibold")}>{course.code}</span>
        <PassRateCell grades={course.recentGrades} muted={course.ended} interactive={false} />
      </div>
      <span className="truncate text-sm">{course.name}</span>
      <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground tabular-nums">
        <span className="flex items-center gap-1.5">
          {formatCount(course.attemptsPerYear)}/yr
          <SizeBar value={course.attemptsPerYear} max={maxAttempts} className={cn("w-12", course.ended && "opacity-50")} />
        </span>
        <AverageGradeCell grades={course.recentGrades} muted={course.ended} />
        {course.programme && <span className="ml-auto">{course.programme}</span>}
      </div>
    </div>
  );
}

function DesktopRow({ course, programmeName, maxAttempts }: CourseRowProps) {
  const muted = course.ended && "opacity-50";
  return (
    <div className={cn(DESKTOP_GRID, "hidden py-2.5 md:grid")}>
      <div className="min-w-0">
        <span className={cn("block truncate", course.ended ? "font-normal" : "font-medium")}>{course.name}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{course.code}</span>
      </div>
      <div>
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
      <div className="flex items-center justify-end gap-2 tabular-nums">
        {formatCount(course.attemptsPerYear)}
        <SizeBar value={course.attemptsPerYear} max={maxAttempts} className={cn(muted)} />
      </div>
      <div className="flex justify-end">
        <PassRateCell grades={course.recentGrades} muted={course.ended} />
      </div>
      <div className="flex justify-end">
        <Sparkline trend={course.trend} className={cn(muted)} />
      </div>
      <div className="flex justify-end">
        <AverageGradeCell grades={course.recentGrades} muted={course.ended} />
      </div>
      <div className="text-right tabular-nums">{formatMonth(course.lastResult)}</div>
    </div>
  );
}
