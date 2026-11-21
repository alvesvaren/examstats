import { Link } from "@tanstack/react-router";
import { ArrowUpRightIcon, ChevronDownIcon } from "lucide-react";
import { memo, type CSSProperties } from "react";
import { cn } from "cn";
import { AverageGradeCell, PassRateCell, StackedCell, SurveyCell } from "@/components/course-cells";
import { SizeBar, Sparkline } from "@/components/marks";
import { MetricInfo, type Metric } from "@/components/metric-label";
import { SortHeader } from "@/components/sort-header";
import { SurveyColumnPicker } from "@/components/survey-column";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  defaultSortDir,
  examinerNamed,
  flip,
  surveySortKey,
  type CatalogCourse,
  type CatalogNewCourse,
  type SortDir,
  type SortKey,
} from "@/domain/catalog";
import type { Question } from "@/domain/evaluation";
import type { InLanguage } from "@/domain/names";
import { useElementSize } from "@/hooks/use-element-size";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useScrollLeftSync } from "@/hooks/use-scroll-left-sync";
import { useWindowVirtualList } from "@/hooks/use-window-virtual-list";
import { useMessages } from "@/hooks/use-messages";
import type { Messages } from "@/lib/i18n/en";

/**
 * Below `lg` the table scrolls sideways and the course column narrows to the course code, so the numbers get the screen.
 * The minimum width is the fixed columns, the survey column, the gaps, the padding and that narrow course column. It
 * goes on the header's grid and on the box of rows, which both hold the padding, so their columns line up.
 */
const TABLE_WIDTH = "min-w-[calc(41.25rem_+_var(--survey-column))]";
/**
 * The survey column is as wide as its header, which changes with the question picked and the language, so its values
 * sit as close to the grade as the other columns sit to each other. `--survey-column` holds its width.
 */
const GRID = cn(
  "grid items-center gap-x-4",
  "grid-cols-[minmax(5rem,1fr)_4.25rem_5rem_4.5rem_4rem_var(--survey-column)_5.5rem_5rem] lg:grid-cols-[minmax(0,1fr)_4.25rem_5rem_4.5rem_4rem_var(--survey-column)_5.5rem_5rem]",
);
/** Stays in view while the table scrolls sideways, covering what scrolls under it, with an edge once something has. */
const PINNED =
  "sticky left-0 z-20 -ml-2 self-stretch bg-background pr-2 pl-2 group-data-scrolled/table:shadow-[1px_0_0_var(--color-border)]";
/** Tooltips inside a row link would swallow taps on touch screens. */
const HOVER_QUERY = "(hover: hover)";
/** Row heights in pixels. The virtual list places rows by them, and the rows are sized by them. */
const ROW_HEIGHT = 61;
const TOGGLE_ROW_HEIGHT = 56;

interface Column {
  key: SortKey;
  metric?: Metric;
  align?: "center" | "end";
  /** The column of a course survey question, which the reader picks. */
  survey?: boolean;
}

/** The columns with the course survey question the reader picked, right before the trend of the course's rating. */
const columnsOf = (survey: Question): Column[] =>
  BASE_COLUMNS.flatMap((column): Column[] =>
    column.key === "trend" ? [{ key: surveySortKey(survey), align: "end", survey: true }, column] : [column],
  );

const BASE_COLUMNS = [
  { key: "name" },
  { key: "programme", align: "center" },
  { key: "attemptsPerYear", metric: "attemptsPerYear", align: "end" },
  { key: "passRate", metric: "passRate", align: "end" },
  { key: "averageGrade", metric: "averageGrade", align: "end" },
  { key: "trend", metric: "trend", align: "end" },
  { key: "lastResult", align: "end" },
] as const satisfies (Column & { key: keyof Messages["list"]["columns"] })[];

type Item = { kind: "course"; course: CatalogCourse } | { kind: "new"; course: CatalogNewCourse } | { kind: "ended"; count: number };

/** The virtual list's key of an item, unique across its kinds. */
function itemKey(item: Item | undefined) {
  if (item?.kind === "course") return item.course.code;
  if (item?.kind === "new") return `new:${item.course.code ?? item.course.name}`;
  return "ended";
}

interface CourseTableProps {
  active: CatalogCourse[];
  /** Courses without results, which come after the active courses. */
  newCourses: CatalogNewCourse[];
  ended: CatalogCourse[];
  showEnded: boolean;
  onToggleEnded: () => void;
  sort: SortKey;
  dir: SortDir;
  onSortChange: (sort: SortKey, dir: SortDir) => void;
  /** The course survey question the survey column shows. */
  survey: Question;
  onPickSurvey: (question: Question) => void;
  /** The search, to show which examiner a course matched by. */
  query: string;
  programmes: Record<string, InLanguage>;
  maxAttempts: number;
  /** Pixels between the top of the viewport and the sticky header, for what sticks above it. */
  stickyTop: number;
}

export function CourseTable(props: CourseTableProps) {
  const t = useMessages();
  if (!props.active.length && !props.newCourses.length && !props.ended.length) {
    return <p className="py-10 text-center text-muted-foreground">{t.list.noMatch}</p>;
  }
  return <Table {...props} />;
}

/** The table, once some course matches. It mounts with its header, which it measures. */
function Table({
  active,
  newCourses,
  ended,
  showEnded,
  onToggleEnded,
  sort,
  dir,
  onSortChange,
  survey,
  onPickSurvey,
  query,
  programmes,
  maxAttempts,
  stickyTop,
}: CourseTableProps) {
  const canHover = useMediaQuery(HOVER_QUERY);
  const t = useMessages();
  const { leaderRef: bodyRef, followerRef: headerRef, onScroll } = useScrollLeftSync<HTMLDivElement, HTMLDivElement>();
  const { ref: surveyHeaderRef, width: surveyHeaderWidth } = useElementSize<HTMLDivElement>();
  const items: Item[] = [
    ...active.map((course) => ({ kind: "course" as const, course })),
    ...newCourses.map((course) => ({ kind: "new" as const, course })),
    ...(ended.length ? [{ kind: "ended" as const, count: ended.length }] : []),
    ...(showEnded ? ended.map((course) => ({ kind: "course" as const, course })) : []),
  ];
  const sortBy = (key: SortKey) => onSortChange(key, key === sort ? flip(dir) : defaultSortDir(key));
  const columnLabels: Partial<Record<SortKey, string>> = t.list.columns;
  const labelOf = (column: Column) => (column.survey ? t.survey.questions[survey].short : (columnLabels[column.key] ?? column.key));
  // The values of the survey column take 3rem.
  const surveyColumn: CSSProperties & Record<"--survey-column", string> = { "--survey-column": `max(3rem, ${surveyHeaderWidth}px)` };

  // A box that scrolls sideways cannot also stick to the page, so the header sits outside it and follows its scroll.
  return (
    <div style={surveyColumn}>
      <div ref={headerRef} className="group/table sticky z-30 overflow-hidden border-b bg-background" style={{ top: stickyTop }}>
        <div className={cn(GRID, TABLE_WIDTH, "px-2 py-2 text-xs text-muted-foreground")}>
          {columnsOf(survey).map((column) => (
            <SortHeader
              // The survey header keeps its element when the question changes, so its size stays measured.
              key={column.survey ? "survey" : column.key}
              ref={column.survey ? surveyHeaderRef : undefined}
              sortKey={column.key}
              label={labelOf(column)}
              sort={sort}
              dir={dir}
              onSort={sortBy}
              className={cn(
                column.align === "end" && "justify-end",
                column.align === "center" && "justify-center",
                column.key === "name" && PINNED,
                // Sized by its content, which sets the column's width.
                column.survey && "w-max justify-self-end",
              )}
            >
              {column.metric && <MetricInfo metric={column.metric} name={labelOf(column).toLowerCase()} />}
              {column.survey && <SurveyColumnPicker question={survey} onPick={onPickSurvey} />}
            </SortHeader>
          ))}
        </div>
      </div>
      <div ref={bodyRef} onScroll={onScroll} className="group/table overflow-x-auto overscroll-x-none">
        <VirtualRows
          items={items}
          survey={survey}
          query={query}
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
  survey: Question;
  query: string;
  canHover: boolean;
}

function VirtualRows({ items, survey, query, canHover, showEnded, onToggleEnded, programmes, maxAttempts }: VirtualRowsProps) {
  const t = useMessages();
  const { listRef, virtualizer } = useWindowVirtualList({
    count: items.length,
    rowHeight: (index) => (items[index]?.kind === "ended" ? TOGGLE_ROW_HEIGHT : ROW_HEIGHT),
    getItemKey: (index) => itemKey(items[index]),
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
                survey={survey}
                examiner={query ? examinerNamed(item.course, query) : undefined}
                canHover={canHover}
                programmeName={item.course.programme ? programmes[item.course.programme]?.name : undefined}
                maxAttempts={maxAttempts}
              />
            ) : item.kind === "new" ? (
              <NewCourseRow course={item.course} examiner={query ? examinerNamed(item.course, query) : undefined} />
            ) : (
              <button
                type="button"
                onClick={onToggleEnded}
                aria-expanded={showEnded}
                style={{ height: TOGGLE_ROW_HEIGHT }}
                className="flex w-full items-center border-b bg-background text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <span className="sticky left-0 flex items-center gap-2 px-2">
                  {t.list.ended} · {t.format.count(item.count)}
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

interface CourseRowProps {
  course: CatalogCourse;
  survey: Question;
  /** The examiner the search matched the course by, if any. */
  examiner: string | undefined;
  /** False on touch screens, where tooltips would swallow taps on the row link. */
  canHover: boolean;
  programmeName?: string;
  maxAttempts: number;
}

/**
 * The whole row links to the course. Controls inside it sit above the link with `relative z-10`.
 * Memoized because the virtualizer re-renders on every scroll frame and rows carry several tooltips.
 */
const CourseRow = memo(function CourseRow({ course, survey, examiner, canHover, programmeName, maxAttempts }: CourseRowProps) {
  const t = useMessages();
  const muted = course.ended && "opacity-50";
  return (
    <div
      style={{ height: ROW_HEIGHT }}
      className={cn("group relative border-b bg-background px-2 hover:bg-row-hover", course.ended && "text-muted-foreground")}
    >
      <Link to="/course/$code" params={{ code: course.code }} className="absolute inset-0" aria-label={`${course.code} ${course.name}`} />
      <div className={cn(GRID, "h-full")}>
        {/* Taps pass through the pinned column to the row link below it. */}
        {/* The code leads on phones and the name on wider screens. */}
        <div
          className={cn(PINNED, "pointer-events-none flex min-w-0 flex-col justify-center group-hover:bg-row-hover lg:flex-col-reverse")}
        >
          <span
            className={cn(
              "truncate tabular-nums lg:text-xs lg:font-normal lg:text-muted-foreground",
              course.ended ? "font-normal" : "font-medium",
            )}
          >
            {course.code}
            {examiner && <span className="text-xs font-normal text-muted-foreground"> · {examiner}</span>}
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
          <StackedCell value={t.format.count(course.attemptsPerYear)} className="w-16">
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
          <SurveyCell question={survey} answers={course.surveyAnswers[survey]} muted={course.ended} interactive={canHover} />
        </div>
        <div className="flex justify-end">
          <Sparkline trend={course.trend} interactive={canHover} className={cn(muted)} />
        </div>
        <div className="text-right tabular-nums">{t.format.month(course.lastResult)}</div>
      </div>
    </div>
  );
});

interface NewCourseRowProps {
  course: CatalogNewCourse;
  /** The examiner the search matched the course by, if any. */
  examiner: string | undefined;
}

/**
 * A course without results. The whole row links to chalmers.se, since the course has no page here: to its syllabus, or
 * for a course without a code, to the course list that names it. Such a course shows the master's programmes whose
 * lists name it where others show their code, and leads with its name on phones too, since that is all that tells it
 * apart. Below `lg` the note sits right after the course, where the table shows it before scrolling sideways.
 */
const NewCourseRow = memo(function NewCourseRow({ course, examiner }: NewCourseRowProps) {
  const t = useMessages();
  const { code } = course;
  const href = code ? t.chalmers.syllabus(code) : (course.courseList ?? t.chalmers.masters);
  return (
    <div style={{ height: ROW_HEIGHT }} className="group relative border-b bg-background px-2 hover:bg-row-hover">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="absolute inset-0"
        aria-label={t.onChalmers([code, course.name].filter(Boolean).join(" "))}
      />
      <div className={cn(GRID, "h-full")}>
        <div
          className={cn(
            PINNED,
            // Such a course has no programme, so its name takes that column too.
            "pointer-events-none col-span-2 flex min-w-0 flex-col justify-center group-hover:bg-row-hover",
            code ? "lg:flex-col-reverse" : "flex-col-reverse",
          )}
        >
          <span
            className={cn(
              "truncate tabular-nums",
              code ? "font-medium lg:text-xs lg:font-normal lg:text-muted-foreground" : "text-xs text-muted-foreground",
            )}
          >
            {code ?? course.masters.join(" · ")}
            {examiner && <span className="text-xs font-normal text-muted-foreground"> · {examiner}</span>}
          </span>
          <span
            className={cn("truncate", code ? "text-xs text-muted-foreground lg:text-base lg:font-medium lg:text-inherit" : "font-medium")}
          >
            {course.name}
            <ArrowUpRightIcon className="ml-0.5 inline size-3.5 align-[-0.125em] text-muted-foreground" />
          </span>
        </div>
        <span className="col-span-6 text-xs text-muted-foreground lg:text-right">{code ? t.noResultsYet : t.newCourse}</span>
      </div>
    </div>
  );
});
