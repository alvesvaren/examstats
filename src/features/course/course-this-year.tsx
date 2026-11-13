import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { courseYearSummary, type CoursePlacement, type PlanInfo } from "@/domain/programme-plans";
import { formatExaminers, formatPeriods } from "@/lib/format";

const yearList = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" });

interface CourseThisYearProps {
  placements: CoursePlacement[];
  plans: PlanInfo;
}

/** When the course runs this academic year, who examines it, and what the programmes that plan it ask. */
export function CourseThisYear({ placements, plans }: CourseThisYearProps) {
  const { rounds, requirements } = courseYearSummary(placements, plans.ruleNames);
  return (
    <section className="flex flex-col gap-1.5 text-sm">
      <h2 className="text-muted-foreground">{plans.academicYear}</h2>
      <ul className="flex flex-col gap-0.5">
        {rounds.map(({ periods, examiners }) => (
          <li key={periods.join("-")}>
            <span className="font-medium">{formatPeriods(periods)}</span>
            {examiners.length > 0 && <span className="text-muted-foreground"> · {formatExaminers(examiners)}</span>}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">
        {requirements.map(({ requirement, programmes }, index) => (
          <Fragment key={requirement.label}>
            {index > 0 && "; "}
            {index === 0 ? requirement.label : requirement.label.toLowerCase()} in{" "}
            {programmes.map(({ code, years }, i) => (
              <Fragment key={code}>
                {i > 0 && ", "}
                <Link
                  to="/planner"
                  search={{ programme: code, year: years[0] }}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  {code}
                </Link>{" "}
                {years.length > 1 ? "years" : "year"} {yearList.format(years.map(String))}
              </Fragment>
            ))}
          </Fragment>
        ))}
        .
      </p>
    </section>
  );
}
