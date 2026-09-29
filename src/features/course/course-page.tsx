import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import { RECENT_LABEL } from "@/components/course-cells";
import { GradeBar } from "@/components/grade";
import { MetricLabel } from "@/components/metric-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { catalogQuery, courseQuery } from "@/data/queries";
import { normalize, partLabel, type CatalogCourse } from "@/domain/catalog";
import { gradeSpreadOf } from "@/domain/grades";
import { formatCount, formatDay, formatGrade, formatNumber, formatPercent } from "@/lib/format";
import { GradeBreakdown, OtherInstances, OtherParts } from "./course-sections";
import { CourseSurvey } from "./course-survey";
import { ExamTimeline } from "./exam-timeline";

const route = getRouteApi("/course/$code");
const MAX_PART_TABS = 6;

export function CoursePage() {
  const { code } = route.useParams();
  const { part: partIndex = 0 } = route.useSearch();
  const { course } = route.useLoaderData();
  const { data: snapshot } = useSuspenseQuery(catalogQuery);
  const { data: detail } = useSuspenseQuery(courseQuery(code));
  const navigate = route.useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();

  const selected = detail.parts[partIndex] ? partIndex : 0;
  const part = detail.parts[selected];
  const otherInstances = snapshot.courses
    .filter((c) => c.code !== code && normalize(c.name) === normalize(course.name))
    .toSorted((a, b) => (b.lastResult ?? "").localeCompare(a.lastResult ?? ""));
  const goBack = () => (canGoBack ? router.history.back() : navigate({ to: "/" }));

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="-ml-2 self-start" onClick={goBack}>
        <ArrowLeftIcon />
        Back
      </Button>

      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{course.name}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <span className="tabular-nums">{course.code}</span>
          {course.programme && (
            <Link to="/" search={{ programme: course.programme }} className="underline-offset-4 hover:text-foreground hover:underline">
              {snapshot.programmes[course.programme] ?? course.programme}
            </Link>
          )}
          {course.ended && <Badge variant="secondary">Ended</Badge>}
        </div>
      </header>

      <StatStrip course={course} />

      {part ? (
        <section className="flex flex-col gap-3">
          {detail.parts.length > 1 && (
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={String(selected)}
              onValueChange={(value) => value && navigate({ search: { part: Number(value) }, replace: true })}
              className="flex-wrap"
            >
              {detail.parts.slice(0, MAX_PART_TABS).map((p, index) => (
                <ToggleGroupItem key={index} value={String(index)}>
                  {partLabel(p.type)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          <ExamTimeline key={selected} part={part} />
        </section>
      ) : (
        <p className="text-muted-foreground">No results.</p>
      )}

      <div className="grid gap-10 pt-2 md:grid-cols-2">
        {part && <GradeBreakdown part={part} />}
        <OtherParts parts={detail.parts} selected={selected} />
      </div>
      <CourseSurvey evaluation={course.evaluation} rounds={detail.evaluations} fetchedAt={snapshot.evaluationsFetchedAt} />
      <OtherInstances courses={otherInstances} programmes={snapshot.programmes} />
    </div>
  );
}

function StatStrip({ course }: { course: CatalogCourse }) {
  const { latestExam } = course;
  const gradeSpread = gradeSpreadOf(course.recentGrades);
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border md:grid-cols-4">
      <Stat
        label={<MetricLabel metric="passRate">Pass rate</MetricLabel>}
        value={formatPercent(course.passRate)}
        detail={<GradeBar grades={course.recentGrades} label={RECENT_LABEL} className="mt-1 w-full" />}
      />
      <Stat
        label={<MetricLabel metric="averageGrade">Average grade</MetricLabel>}
        value={formatGrade(course.averageGrade)}
        detail={gradeSpread && `Median ${formatNumber(gradeSpread.median)} · SD ${formatNumber(gradeSpread.sd)}`}
      />
      <Stat label={<MetricLabel metric="attemptsPerYear">Attempts per year</MetricLabel>} value={formatCount(course.attemptsPerYear)} />
      <Stat
        label="Latest exam"
        value={latestExam ? formatPercent(latestExam.passRate) : "–"}
        detail={latestExam && `${formatDay(latestExam.date)} · ${formatCount(latestExam.attempts)} attempts`}
      />
    </dl>
  );
}

function Stat({ label, value, detail }: { label: ReactNode; value: string; detail?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b p-4 odd:border-r md:border-r md:border-b-0 md:last:border-r-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
      {detail && <dd className="text-xs text-muted-foreground tabular-nums">{detail}</dd>}
    </div>
  );
}
