import { Link } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon } from "lucide-react";
import { memo, type CSSProperties } from "react";
import { cn } from "cn";
import { AverageGradeCell, PassRateCell, RatingCell, StackedCell } from "@/components/course-cells";
import { SizeBar, Sparkline } from "@/components/marks";
import { MetricInfo, type Metric } from "@/components/metric-label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { defaultSortDir, type CatalogCourse, type SortDir, type SortKey } from "@/domain/catalog";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useScrollLeftSync } from "@/hooks/use-scroll-left-sync";
import { useWindowVirtualList } from "@/hooks/use-window-virtual-list";
import { formatCount, formatMonth } from "@/lib/format";

/**
 * Below `lg` the table scrolls sideways and the course column narrows to the course code, so the numbers get the screen.
 * The minimum width is the fixed columns, the gaps, the padding and that narrow course column.
 */
const TABLE_WIDTH = "min-w-[45.25rem]";
const GRID = cn(
  "grid items-center gap-x-4",
  TABLE_WIDTH,
  "grid-cols-[minmax(5rem,1fr)_4.25rem_5rem_4.5rem_4rem_5.5rem_4rem_5rem] lg:grid-cols-[minmax(0,1fr)_4.25rem_5rem_4.5rem_4rem_5.5rem_4rem_5rem]",
);
/** Stays in view while the table scrolls sideways, covering what scrolls under it, with an edge once something has. */
const PINNED =
  "sticky left-0 z-20 -ml-2 self-stretch bg-background pr-2 pl-2 group-data-scrolled/table:shadow-[1px_0_0_var(--color-border)]";
/** Tooltips inside a row link would swallow taps on touch screens. */
const HOVER_QUERY = "(hover: hover)";
/** Row heights in pixels. They must match the `h-*` classes on the rows below. */
const ROW_HEIGHT = 61;
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
  const canHover = useMediaQuery(HOVER_QUERY);
  const { leaderRef: bodyRef, followerRef: headerRef, onScroll } = useScrollLeftSync<HTMLDivElement, HTMLDivElement>();
  const items: Item[] = [
    ...active.map((course) => ({ kind: "course" as const, course })),
    ...(ended.length ? [{ kind: "ended" as const, count: ended.length }] : []),
    ...(showEnded ? ended.map((course) => ({ kind: "course" as const, course })) : []),
  ];
  const sortBy = (key: SortKey) => onSortChange(key, key === sort ? flip(dir) : defaultSortDir(key));

  if (!items.length) return <p className="py-10 text-center text-muted-foreground">No courses match.</p>;

  // A box that scrolls sideways cannot also stick to the page, so the header sits outside it and follows its scroll.
  return (
    <div>
      <div ref={headerRef} className="group/table sticky z-30 overflow-hidden border-b bg-background" style={{ top: stickyTop }}>
        <div className={cn(GRID, "px-2 py-2 text-xs text-muted-foreground")}>
          {COLUMNS.map((column) => (
            <SortHeader key={column.key} column={column} sort={sort} dir={dir} onSort={sortBy} />
          ))}
        </div>
      </div>
      <div ref={bodyRef} onScroll={onScroll} className="group/table overflow-x-auto overscroll-x-none">
        <VirtualRows
          items={items}
          canHover={canHover}
          showEnded={showEnded}
          onToggleEnded={onToggleEnded}
          programmes={programmes}
          maxAttempts={maxAttempts}
        />
      </div>
    </div>
  );
}

interface VirtualRowsProps extends Pick<CourseTableProps, "showEnded" | "onToggleEnded" | "programmes" | "maxAttempts"> {
  items: Item[];
  canHover: boolean;
}

function VirtualRows({ items, canHover, showEnded, onToggleEnded, programmes, maxAttempts }: VirtualRowsProps) {
  const { listRef, virtualizer } = useWindowVirtualList({
    count: items.length,
    rowHeight: (index) => (items[index]?.kind === "ended" ? TOGGLE_ROW_HEIGHT : ROW_HEIGHT),
    getItemKey: (index) => {
      const item = items[index];
      return item?.kind === "course" ? item.course.code : "ended";
    },
  });

  return (
    <div
      ref={listRef}
      className={cn("relative [overflow-anchor:none] row-lines", TABLE_WIDTH)}
      style={{ height: virtualizer.getTotalSize(), "--row-height": `${ROW_HEIGHT}px` } as CSSProperties}
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
                canHover={canHover}
                programmeName={item.course.programme ? programmes[item.course.programme] : undefined}
                maxAttempts={maxAttempts}
              />
            ) : (
              <button
                type="button"
                onClick={onToggleEnded}
                aria-expanded={showEnded}
                className="flex h-14 w-full items-center border-b bg-background text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <span className="sticky left-0 flex items-center gap-2 px-2">
                  Ended courses · {formatCount(item.count)}
                  <ChevronDownIcon className={cn("size-4 transition-transform", showEnded && "rotate-180")} />
                </span>
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
      className={cn(
        "flex items-center gap-1",
        column.align === "end" && "justify-end",
        column.align === "center" && "justify-center",
        column.key === "name" && PINNED,
      )}
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

interface CourseRowProps {
  course: CatalogCourse;
  /** False on touch screens, where tooltips would swallow taps on the row link. */
  canHover: boolean;
  programmeName?: string;
  maxAttempts: number;
}

/**
 * The whole row links to the course. Controls inside it sit above the link with `relative z-10`.
 * Memoized because the virtualizer re-renders on every scroll frame and rows carry several tooltips.
 */
const CourseRow = memo(function CourseRow({ course, canHover, programmeName, maxAttempts }: CourseRowProps) {
  const muted = course.ended && "opacity-50";
  return (
    <div className={cn("group relative h-[61px] border-b bg-background px-2 hover:bg-row-hover", course.ended && "text-muted-foreground")}>
      <Link to="/course/$code" params={{ code: course.code }} className="absolute inset-0" aria-label={`${course.code} ${course.name}`} />
      <div className={cn(GRID, "h-full")}>
        {/* Taps pass through the pinned column to the row link below it. */}
        {/* The code leads on phones and the name on wider screens. */}
        <div
          className={cn(PINNED, "pointer-events-none flex min-w-0 flex-col justify-center group-hover:bg-row-hover lg:flex-col-reverse")}
        >
          <span
            className={cn("tabular-nums lg:text-xs lg:font-normal lg:text-muted-foreground", course.ended ? "font-normal" : "font-medium")}
          >
            {course.code}
          </span>
          <span
            className={cn(
              "truncate text-xs text-muted-foreground lg:text-base lg:text-inherit",
              course.ended ? "font-normal" : "lg:font-medium",
            )}
          >
            {course.name}
          </span>
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
          <PassRateCell grades={course.recentGrades} muted={course.ended} interactive={canHover} />
        </div>
        <div className="flex justify-end">
          <AverageGradeCell grades={course.recentGrades} interactive={canHover} />
        </div>
        <div className="flex justify-end">
          <Sparkline trend={course.trend} interactive={canHover} className={cn(muted)} />
        </div>
        <div className="flex justify-end">
          <RatingCell answers={course.overallAnswers} muted={course.ended} interactive={canHover} />
        </div>
        <div className="text-right tabular-nums">{formatMonth(course.lastResult)}</div>
      </div>
    </div>
  );
});
