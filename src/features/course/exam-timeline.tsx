import { useState } from "react";
import { cn } from "cn";
import { GradeTally } from "@/components/grade";
import { GRADE_STYLE } from "@/components/grade-style";
import { attemptsOf, passRateOf, type GradeCounts } from "@/domain/grades";
import type { Part } from "@/domain/snapshot";
import { layoutColumns, stackSegments } from "@/domain/timeline";
import { useElementWidth } from "@/hooks/use-element-width";
import { formatCount, formatDay, formatPercent } from "@/lib/format";

/** The chart draws in real pixels, so the gaps below are exact at every width. */
const HEIGHT = 280;
const AXIS_LEFT = 40;
const TOP = 8;
const BOTTOM = 26;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;
const GRID_SHARES = [0, 0.5, 1];
const GRADE_GAP = 1;
const EXAM_GAP = 2;
const MIN_COLUMN_WIDTH = 3;
/** Below this width the chart scrolls sideways instead of squeezing columns. Courses with many exams scroll too. */
const MIN_CHART_WIDTH = 640;
const MIN_YEAR_LABEL_GAP = 44;
/** Near an edge the tooltip anchors to that edge instead of centring on the column. */
const TOOLTIP_EDGE_SHARE = 0.2;

const y = (share: number) => Math.round(TOP + PLOT_HEIGHT * (1 - share));

/** One column per sitting, oldest first. Width shows attempts, height splits them by grade. */
export function ExamTimeline({ part }: { part: Part }) {
  // The tooltip lives outside the scrolling box, so it records the scroll offset it was opened at.
  const [hovered, setHovered] = useState<{ index: number; scrollLeft: number } | null>(null);
  const { ref, width: viewportWidth } = useElementWidth<HTMLDivElement>();

  const items = part.sittings.map((sitting) => ({ ...sitting, attempts: attemptsOf(sitting.grades) }));
  const width = Math.max(viewportWidth, MIN_CHART_WIDTH, AXIS_LEFT + items.length * (MIN_COLUMN_WIDTH + EXAM_GAP));
  // Edges are rounded to whole pixels so every gap renders sharp and equally wide.
  const columns = layoutColumns(items, { width: width - AXIS_LEFT, gap: EXAM_GAP, minWidth: MIN_COLUMN_WIDTH }).map((column) => {
    const x = Math.round(column.x);
    return { ...column, x, width: Math.round(column.x + column.width) - x };
  });
  const yearLabels = columns.reduce<{ year: string; x: number }[]>((labels, column) => {
    const year = column.item.date.slice(0, 4);
    const previous = labels.at(-1);
    if (!previous || (year !== previous.year && column.x - previous.x >= MIN_YEAR_LABEL_GAP)) labels.push({ year, x: column.x });
    return labels;
  }, []);
  const active = hovered && columns[hovered.index];
  const hover = (index: number) => setHovered({ index, scrollLeft: ref.current?.scrollLeft ?? 0 });

  return (
    <div className="relative">
      {active && hovered && (
        <SittingTooltip
          date={active.item.date}
          grades={active.item.grades}
          center={AXIS_LEFT + active.x + active.width / 2 - hovered.scrollLeft}
          viewportWidth={viewportWidth}
        />
      )}
      <div ref={ref} className="overflow-x-auto" onScroll={() => setHovered(null)}>
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="block"
          role="img"
          aria-label={`${part.sittings.length} sittings from ${part.sittings[0]?.date ?? ""} to ${part.sittings.at(-1)?.date ?? ""}`}
          onPointerLeave={() => setHovered(null)}
        >
          {GRID_SHARES.map((share) => (
            <g key={share}>
              <line x1={AXIS_LEFT} x2={width} y1={y(share) + 0.5} y2={y(share) + 0.5} className="stroke-border" />
              <text x={AXIS_LEFT - 8} y={y(share) + 4} textAnchor="end" className="fill-muted-foreground text-xs">
                {formatPercent(share)}
              </text>
            </g>
          ))}
          {columns.map((column, i) => (
            <g
              key={`${column.item.date}-${i}`}
              transform={`translate(${AXIS_LEFT + column.x} 0)`}
              onPointerEnter={() => hover(i)}
              onPointerDown={() => hover(i)}
              className={cn("transition-opacity", hovered && hovered.index !== i && "opacity-50")}
            >
              {stackSegments(column.item.grades).map((segment, index, segments) => {
                const top = y(segment.end) + (index < segments.length - 1 ? GRADE_GAP : 0);
                return (
                  <rect
                    key={segment.grade}
                    y={top}
                    width={column.width}
                    height={Math.max(0, y(segment.start) - top)}
                    className={GRADE_STYLE[segment.grade].fill}
                  />
                );
              })}
              <rect width={column.width + EXAM_GAP} height={HEIGHT} fill="transparent" />
            </g>
          ))}
          {yearLabels.map((label) => (
            <text key={label.year} x={AXIS_LEFT + label.x} y={HEIGHT - 6} className="fill-muted-foreground text-xs">
              {label.year}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

interface SittingTooltipProps {
  date: string;
  grades: GradeCounts;
  /** Column centre relative to the visible part of the chart. */
  center: number;
  viewportWidth: number;
}

function SittingTooltip({ date, grades, center, viewportWidth }: SittingTooltipProps) {
  const share = viewportWidth ? center / viewportWidth : 0;
  const align = share < TOOLTIP_EDGE_SHARE ? "translate-x-0" : share > 1 - TOOLTIP_EDGE_SHARE ? "-translate-x-full" : "-translate-x-1/2";
  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-full z-30 mb-2 rounded-md border bg-popover px-3 py-2 text-sm whitespace-nowrap text-popover-foreground shadow-md",
        align,
      )}
      style={{ left: center }}
    >
      <div className="font-medium">{formatDay(date)}</div>
      <div className="text-muted-foreground tabular-nums">
        {formatPercent(passRateOf(grades))} passed · {formatCount(attemptsOf(grades))} attempts
      </div>
      <GradeTally grades={grades} className="mt-2 flex-nowrap" />
    </div>
  );
}
