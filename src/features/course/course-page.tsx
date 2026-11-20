import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon, ArrowUpRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { GradeBar } from "@/components/grade";
import { MetricLabel } from "@/components/metric-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { catalogQuery, courseQuery } from "@/data/queries";
import { normalize, type CatalogCourse } from "@/domain/catalog";
import { latestExam } from "@/domain/course-stats";
import { roundsThisYear } from "@/domain/programme-plans";
import { gradeSpreadOf } from "@/domain/grades";
import { useLanguage } from "@/hooks/use-language";
import { useMessages } from "@/hooks/use-messages";
import { GradeBreakdown, OtherInstances, OtherParts } from "./course-sections";
import { CourseSurvey } from "./course-survey";
import { CourseThisYear } from "./course-this-year";
import { ExamTimeline } from "./exam-timeline";

const route = getRouteApi("/course/$code");
const MAX_PART_TABS = 6;

export function CoursePage() {
  const { code } = route.useParams();
  const { part: partIndex = 0, survey } = route.useSearch();
  const language = useLanguage();
  const t = useMessages();
  const { data: snapshot } = useSuspenseQuery(catalogQuery(language));
  // The loader checked that the course exists. The catalog names it in the language picked since.
  const loaded = route.useLoaderData().course;
  const course = snapshot.courses.find((c) => c.code === code) ?? loaded;
  const { data: detail } = useSuspenseQuery(courseQuery(code));
  const navigate = route.useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();

  const selected = detail.parts[partIndex] ? partIndex : 0;
  const part = detail.parts[selected];
  const [mainPart] = detail.parts;
  const latest = latestExam(mainPart?.sittings ?? []);
  const credits = detail.placements[0]?.credits;
  const moduleCredits = new Map(detail.placements.flatMap((p) => p.modules).map((m) => [m.code, m.credits]));
  const seatsText = t.course.seatsIn(
    roundsThisYear(detail.placements).flatMap(({ periods, seats }) => (seats ? { seats, periods: t.periods(periods) } : [])),
  );
  const otherInstances = snapshot.courses
    .filter((c) => c.code !== code && normalize(c.swedishName) === normalize(course.swedishName))
    .toSorted((a, b) => (b.lastResult ?? "").localeCompare(a.lastResult ?? ""));
  // Picking a survey round only swaps the summary beside the list, so the page stays where it is.
  const setSurvey = (key: string) => navigate({ search: (prev) => ({ ...prev, survey: key }), replace: true, resetScroll: false });
  const goBack = () => (canGoBack ? router.history.back() : navigate({ to: "/" }));

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="-ml-2 self-start" onClick={goBack}>
        <ArrowLeftIcon />
        {t.course.back}
      </Button>

      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{course.name}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <span className="tabular-nums">{course.code}</span>
          {course.programme && (
            <Link to="/" search={{ programme: course.programme }} className="underline-offset-4 hover:text-foreground hover:underline">
              {snapshot.programmes[course.programme]?.name ?? course.programme}
            </Link>
          )}
          {credits !== undefined && <span className="tabular-nums">{t.credits(credits)}</span>}
          {course.ended && <Badge variant="secondary">{t.course.ended}</Badge>}
          {detail.placements.length > 0 && (
            <a
              href={t.chalmers.syllabus(code)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 underline-offset-4 hover:text-foreground hover:underline"
            >
              {t.course.syllabus}
              <ArrowUpRightIcon className="size-3.5" />
            </a>
          )}
        </div>
      </header>

      {detail.placements.length > 0 && (
        <CourseThisYear placements={detail.placements} plans={snapshot.plans} programmes={snapshot.programmes} />
      )}

      <StatStrip course={course} latest={latest} seats={seatsText} />

      {part ? (
        <section className="flex flex-col gap-3">
          {detail.parts.length > 1 && (
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={String(selected)}
              onValueChange={(value) => value && navigate({ search: (prev) => ({ ...prev, part: Number(value) }), replace: true })}
              className="flex-wrap"
            >
              {detail.parts.slice(0, MAX_PART_TABS).map((p, index) => {
                const partCredits = moduleCredits.get(p.code);
                return (
                  <ToggleGroupItem key={index} value={String(index)}>
                    {t.part(p.type)}
                    {partCredits !== undefined && <span className="text-muted-foreground tabular-nums">{t.credits(partCredits)}</span>}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          )}
          <ExamTimeline key={selected} part={part} />
        </section>
      ) : (
        <p className="text-muted-foreground">{t.course.noResults}</p>
      )}

      <div className="grid gap-10 pt-2 md:grid-cols-2">
        {part && <GradeBreakdown part={part} />}
        <OtherParts parts={detail.parts} selected={selected} />
      </div>
      <CourseSurvey rounds={detail.evaluations} selected={survey} onSelect={setSurvey} fetchedAt={snapshot.evaluationsFetchedAt} />
      <OtherInstances courses={otherInstances} programmes={snapshot.programmes} />
    </div>
  );
}

interface StatStripProps {
  course: CatalogCourse;
  latest: ReturnType<typeof latestExam>;
  /** The seats of this year's rounds that limit them, in words. Empty when none does. */
  seats: string;
}

function StatStrip({ course, latest, seats }: StatStripProps) {
  const t = useMessages();
  const gradeSpread = gradeSpreadOf(course.recentGrades);
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border md:grid-cols-4">
      <Stat
        label={<MetricLabel metric="passRate">{t.course.passRate}</MetricLabel>}
        value={t.format.percent(course.passRate)}
        detail={<GradeBar grades={course.recentGrades} label={t.metrics.recent} className="mt-1 w-full" />}
      />
      <Stat
        label={<MetricLabel metric="averageGrade">{t.course.averageGrade}</MetricLabel>}
        value={t.format.grade(course.averageGrade)}
        detail={gradeSpread && t.medianAndSd(gradeSpread.median, gradeSpread.sd)}
      />
      <Stat
        label={<MetricLabel metric="attemptsPerYear">{t.course.attemptsPerYear}</MetricLabel>}
        value={t.format.count(course.attemptsPerYear)}
        detail={seats}
      />
      <Stat
        label={t.course.latestExam}
        value={t.format.percent(latest?.passRate ?? null)}
        detail={latest && `${t.format.day(latest.date)} · ${t.attempts(latest.attempts)}`}
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
