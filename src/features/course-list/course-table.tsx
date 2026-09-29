import { Link } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon } from "lucide-react";
import { memo, type CSSProperties } from "react";
import { cn } from "cn";
import { AverageGradeCell, PassRateCell, RatingCell, StackedCell } from "@/components/course-cells";
import { SizeBar, Sparkline } from "@/components/marks";
import { MetricInfo, type Metric } from "@/components/metric-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { defaultSortDir, type CatalogCourse, type SortDir, type SortKey } from "@/domain/catalog";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useWindowVirtualList } from "@/hooks/use-window-virtual-list";
import { formatCount, formatGrade, formatMonth, formatScore } from "@/lib/format";

const DESKTOP_GRID = "grid grid-cols-[minmax(0,1fr)_4.25rem_5rem_4.5rem_4rem_5.5rem_4rem_5rem] items-center gap-x-4";
/** Tailwind's `lg` breakpoint, where the list switches from stacked rows to columns. */
const DESKTOP_QUERY = "(min-width: 1024px)";
/** Row heights in pixels. They must match the `h-*` classes on the rows below. */
const DESKTOP_ROW_HEIGHT = 61;
const MOBILE_ROW_HEIGHT = 100;
const TOGGLE_ROW_HEIGHT = 56;

interface Column {
  key: SortKey;
  label: string;
  metric?: Metric;
  align?: "center" | "end";
}

const COLUMNS: Column[] = [
  { key: "name", label: "Course" },
  { key: "programme", label: "Programme", align: "center" },
  { key: "attemptsPerYear", label: "Attempts", metric: "attemptsPerYear", align: "end" },
  { key: "passRate", label: "Pass rate", metric: "passRate", align: "end" },
  { key: "averageGrade", label: "Grade", metric: "averageGrade", align: "end" },
  { key: "trend", label: "Trend", metric: "trend", align: "end" },
  { key: "rating", label: "Rating", metric: "rating", align: "end" },
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
  /** Pixels between the top of the viewport and the sticky header, for what sticks above it. */
  stickyTop: number;
}

export function CourseTable({
  active,
  ended,
  showEnded,
  onToggleEnded,
  sort,
  dir,
  onSortChange,
  programmes,
  maxAttempts,
  stickyTop,
}: CourseTableProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const items: Item[] = [
    ...active.map((course) => ({ kind: "course" as const, course })),
    ...(ended.length ? [{ kind: "ended" as const, count: ended.length }] : []),
    ...(showEnded ? ended.map((course) => ({ kind: "course" as const, course })) : []),
  ];
  const sortBy = (key: SortKey) => onSortChange(key, key === sort ? flip(dir) : defaultSortDir(key));

  if (!items.length) return <p className="py-10 text-center text-muted-foreground">No courses match.</p>;

  return (
    <div>
      {isDesktop ? (
        <div
          className={cn(DESKTOP_GRID, "sticky z-20 border-b bg-background px-2 py-2 text-xs text-muted-foreground")}
          style={{ top: stickyTop }}
        >
          {COLUMNS.map((column) => (
            <SortHeader key={column.key} column={column} sort={sort} dir={dir} onSort={sortBy} />
          ))}
        </div>
      ) : (
        <MobileSortBar sort={sort} dir={dir} onSortChange={onSortChange} stickyTop={stickyTop} />
      )}
      {/* Row heights differ per layout, so switching layout starts a fresh virtualizer. */}
      <VirtualRows
        key={isDesktop ? "desktop" : "mobile"}
        items={items}
        isDesktop={isDesktop}
        showEnded={showEnded}
        onToggleEnded={onToggleEnded}
        programmes={programmes}
        maxAttempts={maxAttempts}
      />
    </div>
  );
}

interface VirtualRowsProps extends Pick<CourseTableProps, "showEnded" | "onToggleEnded" | "programmes" | "maxAttempts"> {
  items: Item[];
  isDesktop: boolean;
}

function VirtualRows({ items, isDesktop, showEnded, onToggleEnded, programmes, maxAttempts }: VirtualRowsProps) {
  const courseHeight = isDesktop ? DESKTOP_ROW_HEIGHT : MOBILE_ROW_HEIGHT;
  const { listRef, virtualizer } = useWindowVirtualList({
    count: items.length,
    rowHeight: (index) => (items[index]?.kind === "ended" ? TOGGLE_ROW_HEIGHT : courseHeight),
    getItemKey: (index) => {
      const item = items[index];
      return item?.kind === "course" ? item.course.code : "ended";
    },
  });

  return (
    <div
      ref={listRef}
      className="relative [overflow-anchor:none] row-lines"
      style={{ height: virtualizer.getTotalSize(), "--row-height": `${courseHeight}px` } as CSSProperties}
    >
      {virtualizer.getVirtualItems().map((row) => {
        const item = items[row.index]!;
        return (
          <div
            key={row.key}
            className="absolute inset-x-0 top-0"
            style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)` }}
          >
            {item.kind === "course" ? (
              <CourseRow
                course={item.course}
                isDesktop={isDesktop}
                programmeName={item.course.programme ? programmes[item.course.programme] : undefined}
                maxAttempts={maxAttempts}
              />
            ) : (
              <button
                type="button"
                onClick={onToggleEnded}
                aria-expanded={showEnded}
                className="flex h-14 w-full items-center justify-between border-b bg-background px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Ended courses · {formatCount(item.count)}
                <ChevronDownIcon className={cn("size-4 transition-transform", showEnded && "rotate-180")} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SortHeader({ column, sort, dir, onSort }: { column: Column; sort: SortKey; dir: SortDir; onSort: (key: SortKey) => void }) {
  const isActive = sort === column.key;
  const Arrow = dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <div
      className={cn("flex items-center gap-1", column.align === "end" && "justify-end", column.align === "center" && "justify-center")}
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
function MobileSortBar({ sort, dir, onSortChange, stickyTop }: Pick<CourseTableProps, "sort" | "dir" | "onSortChange" | "stickyTop">) {
  const Arrow = dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
  const select = (value: string) => {
    const column = COLUMNS.find((c) => c.key === value);
    if (column) onSortChange(column.key, defaultSortDir(column.key));
  };
  // 16px text, because iOS zooms into focused fields with smaller text.
  return (
    <div className="sticky z-20 flex items-center gap-2 border-b bg-background py-2" style={{ top: stickyTop }}>
      <span className="text-sm text-muted-foreground">Sort by</span>
      <NativeSelect value={sort} onChange={(event) => select(event.target.value)} aria-label="Sort by" className="[&_select]:text-base">
        {COLUMNS.map((column) => (
          <NativeSelectOption key={column.key} value={column.key}>
            {column.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onSortChange(sort, flip(dir))}
        aria-label={dir === "asc" ? "Sort descending" : "Sort ascending"}
      >
        <Arrow />
      </Button>
    </div>
  );
}

interface CourseRowProps {
  course: CatalogCourse;
  isDesktop: boolean;
  programmeName?: string;
  maxAttempts: number;
}

/**
 * The whole row links to the course. Controls inside it sit above the link with `relative z-10`.
 * Memoized because the virtualizer re-renders on every scroll frame and rows carry several tooltips.
 */
const CourseRow = memo(function CourseRow({ course, isDesktop, programmeName, maxAttempts }: CourseRowProps) {
  return (
    <div
      className={cn(
        "relative border-b bg-background px-2 hover:bg-muted/50",
        isDesktop ? "h-[61px]" : "h-[100px]",
        course.ended && "text-muted-foreground",
      )}
    >
      <Link to="/course/$code" params={{ code: course.code }} className="absolute inset-0" aria-label={`${course.code} ${course.name}`} />
      {isDesktop ? (
        <DesktopRow course={course} programmeName={programmeName} maxAttempts={maxAttempts} />
      ) : (
        <MobileRow course={course} maxAttempts={maxAttempts} />
      )}
    </div>
  );
});

function MobileRow({ course, maxAttempts }: Pick<CourseRowProps, "course" | "maxAttempts">) {
  return (
    <div className="flex h-full flex-col justify-center gap-1">
      <div className="flex items-center justify-between gap-3">
        <span className={cn("text-lg tabular-nums", course.ended ? "font-medium" : "font-semibold")}>{course.code}</span>
        <PassRateCell grades={course.recentGrades} muted={course.ended} interactive={false} inline />
      </div>
      <span className="truncate text-sm">{course.name}</span>
      <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground tabular-nums">
        <span className="flex items-center gap-1.5">
          {formatCount(course.attemptsPerYear)}/yr
          <SizeBar value={course.attemptsPerYear} max={maxAttempts} className={cn("w-12", course.ended && "opacity-50")} />
        </span>
        <span>Grade {formatGrade(course.averageGrade)}</span>
        <span>Rating {formatScore(course.evaluation?.mean ?? null)}</span>
        {course.programme && <span className="ml-auto">{course.programme}</span>}
      </div>
    </div>
  );
}

function DesktopRow({ course, programmeName, maxAttempts }: Omit<CourseRowProps, "isDesktop">) {
  const muted = course.ended && "opacity-50";
  return (
    <div className={cn(DESKTOP_GRID, "h-full")}>
      <div className="min-w-0">
        <span className={cn("block truncate", course.ended ? "font-normal" : "font-medium")}>{course.name}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{course.code}</span>
      </div>
      <div className="flex justify-center">
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
      <div className="flex justify-end">
        <StackedCell value={formatCount(course.attemptsPerYear)} className="w-16">
          <SizeBar value={course.attemptsPerYear} max={maxAttempts} className={cn(muted)} />
        </StackedCell>
      </div>
      <div className="flex justify-end">
        <PassRateCell grades={course.recentGrades} muted={course.ended} />
      </div>
      <div className="flex justify-end">
        <AverageGradeCell grades={course.recentGrades} />
      </div>
      <div className="flex justify-end">
        <Sparkline trend={course.trend} className={cn(muted)} />
      </div>
      <div className="flex justify-end">
        <RatingCell evaluation={course.evaluation} muted={course.ended} />
      </div>
      <div className="text-right tabular-nums">{formatMonth(course.lastResult)}</div>
    </div>
  );
}
