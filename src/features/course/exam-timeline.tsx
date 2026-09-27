import { useState } from "react";
import { cn } from "cn";
import { GRADE_STYLE, GradeTally } from "@/components/grade";
import { attemptsOf, passRateOf, type GradeCounts } from "@/domain/grades";
import type { Part } from "@/domain/snapshot";
import { layoutColumns, stackSegments } from "@/domain/timeline";
import { formatCount, formatDay, formatPercent } from "@/lib/format";

const WIDTH = 1000;
const HEIGHT = 280;
const AXIS_LEFT = 40;
const TOP = 8;
const BOTTOM = 26;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;
const GRID_SHARES = [0, 0.5, 1];
const MIN_COLUMN_WIDTH = 3;
/** Past this many sittings, a 1px gap keeps small columns from vanishing. */
const DENSE_SITTINGS = 80;
const MIN_YEAR_LABEL_GAP = 44;
/** The tooltip sits right of the hovered column, or left of it past this share of the width. */
const TOOLTIP_FLIP_SHARE = 0.6;
const TOOLTIP_OFFSET_PX = 8;

const y = (share: number) => TOP + PLOT_HEIGHT * (1 - share);

/** One column per sitting, oldest first. Width shows attempts, height splits them by grade. */
export function ExamTimeline({ part }: { part: Part }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const gap = part.sittings.length > DENSE_SITTINGS ? 1 : 2;
  const items = part.sittings.map((sitting) => ({ ...sitting, attempts: attemptsOf(sitting.grades) }));
  const columns = layoutColumns(items, { width: WIDTH - AXIS_LEFT, gap, minWidth: MIN_COLUMN_WIDTH });
  const yearLabels = columns.reduce<{ year: string; x: number }[]>((labels, column) => {
    const year = column.item.date.slice(0, 4);
    const previous = labels.at(-1);
    if (!previous || (year !== previous.year && column.x - previous.x >= MIN_YEAR_LABEL_GAP)) labels.push({ year, x: column.x });
    return labels;
  }, []);
  const active = hovered === null ? null : columns[hovered];

  return (
    <div className="overflow-x-auto">
      <div className="relative min-w-[640px]">
        {active && (
          <SittingTooltip
            date={active.item.date}
            grades={active.item.grades}
            start={AXIS_LEFT + active.x}
            end={AXIS_LEFT + active.x + active.width}
          />
        )}
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`${part.sittings.length} sittings from ${part.sittings[0]?.date ?? ""} to ${part.sittings.at(-1)?.date ?? ""}`}
          onPointerLeave={() => setHovered(null)}
        >
          {GRID_SHARES.map((share) => (
            <g key={share}>
              <line x1={AXIS_LEFT} x2={WIDTH} y1={y(share)} y2={y(share)} className="stroke-border" />
              <text x={AXIS_LEFT - 8} y={y(share) + 4} textAnchor="end" className="fill-muted-foreground text-xs">
                {formatPercent(share)}
              </text>
            </g>
          ))}
          {columns.map((column, i) => (
            <g
              key={`${column.item.date}-${i}`}
              transform={`translate(${AXIS_LEFT + column.x} 0)`}
              onPointerEnter={() => setHovered(i)}
              onPointerDown={() => setHovered(i)}
              className={cn("transition-opacity", hovered !== null && hovered !== i && "opacity-50")}
            >
              {stackSegments(column.item.grades).map((segment) => (
                <rect
                  key={segment.grade}
                  y={y(segment.end)}
                  width={column.width}
                  height={PLOT_HEIGHT * (segment.end - segment.start)}
                  className={cn(GRADE_STYLE[segment.grade].fill, "stroke-background")}
                  strokeWidth={1}
                />
              ))}
              <rect width={column.width + gap} height={HEIGHT} fill="transparent" />
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

function SittingTooltip({ date, grades, start, end }: { date: string; grades: GradeCounts; start: number; end: number }) {
  const position =
    end / WIDTH < TOOLTIP_FLIP_SHARE
      ? { left: `calc(${(end / WIDTH) * 100}% + ${TOOLTIP_OFFSET_PX}px)` }
      : { right: `calc(${100 - (start / WIDTH) * 100}% + ${TOOLTIP_OFFSET_PX}px)` };
  return (
    <div
      className="pointer-events-none absolute top-2 z-30 rounded-md border bg-popover px-3 py-2 text-sm whitespace-nowrap text-popover-foreground shadow-md"
      style={position}
    >
      <div className="font-medium">{formatDay(date)}</div>
      <div className="text-muted-foreground tabular-nums">
        {formatPercent(passRateOf(grades))} passed · {formatCount(attemptsOf(grades))} attempts
      </div>
      <GradeTally grades={grades} className="mt-2 flex-nowrap" />
    </div>
  );
}
