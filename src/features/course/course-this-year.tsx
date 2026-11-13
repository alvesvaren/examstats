import { Link } from "@tanstack/react-router";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { InLanguage } from "@/domain/names";
import { courseYearSummary, type CoursePlacement, type PlanInfo } from "@/domain/programme-plans";
import { formatList, formatPeriods } from "@/lib/format";

/** Years as short ranges, such as "1–2" or "1, 3". */
function formatYears(years: readonly number[]) {
  const ranges: number[][] = [];
  for (const year of years) {
    const last = ranges.at(-1);
    if (last && last.at(-1) === year - 1) last.push(year);
    else ranges.push([year]);
  }
  return ranges.map((r) => (r.length > 1 ? `${r[0]}–${r.at(-1)}` : String(r[0]))).join(", ");
}

interface CourseThisYearProps {
  placements: CoursePlacement[];
  plans: PlanInfo;
  /** Programme names by code, in the language picked. */
  programmes: Readonly<Record<string, InLanguage>>;
}

/** When the course runs this academic year, who examines it, and what the programmes that plan it ask. */
export function CourseThisYear({ placements, plans, programmes: names }: CourseThisYearProps) {
  const { rounds, requirements } = courseYearSummary(placements, plans.ruleNames);
  return (
    <section className="flex flex-col gap-1.5 text-sm">
      <h2 className="text-muted-foreground">
        {rounds.some((r) => r.examiners.length > 0) ? `Examiners ${plans.academicYear}` : plans.academicYear}
      </h2>
      <ul className="flex flex-col gap-0.5">
        {rounds.map(({ periods, examiners }) => (
          <li key={periods.join("-")}>
            <span className="font-medium">{formatPeriods(periods)}</span>
            {examiners.length > 0 && <span className="text-muted-foreground"> · {formatList(examiners)}</span>}
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {requirements.map(({ requirement, programmes }) => (
          <div key={requirement.label} className="contents">
            <dt className="text-muted-foreground">{requirement.label}</dt>
            <dd className="flex flex-wrap gap-x-3 gap-y-0.5">
              {programmes.map(({ code, name, years }) => (
                <Tooltip key={code}>
                  <TooltipTrigger asChild>
                    <Link to="/planner" search={{ programme: code, year: years[0] }} className="underline-offset-4 hover:underline">
                      {code}
                      <span className="ml-1 text-muted-foreground tabular-nums">{formatYears(years)}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    {names[code]?.name ?? name}, {years.length > 1 ? "years" : "year"} {formatList(years.map(String))}
                  </TooltipContent>
                </Tooltip>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
