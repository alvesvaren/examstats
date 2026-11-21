import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { useDeferredValue, useMemo, type ReactNode } from "react";
import { SearchField } from "@/components/search-field";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { catalogQuery } from "@/data/queries";
import {
  defaultSortDir,
  inScope,
  matchExaminers,
  matchProgrammes,
  queryCourses,
  queryNewCourses,
  surveyColumn,
  surveySortKey,
  type SortDir,
  type SortKey,
} from "@/domain/catalog";
import type { Question } from "@/domain/evaluation";
import { REGULAR_PERIODS, type StudyPeriod } from "@/domain/programme-plans";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { useElementSize } from "@/hooks/use-element-size";
import { useLanguage } from "@/hooks/use-language";
import { useMessages } from "@/hooks/use-messages";
import { useScrollBack } from "@/hooks/use-scroll-back";
import { CourseTable } from "./course-table";

const route = getRouteApi("/");
type ListSearch = ReturnType<typeof route.useSearch>;

/** The study periods the list filters on. Summer courses and those outside study periods are few. */
const PERIOD_FILTERS = REGULAR_PERIODS;
const DEFAULT_SORT: SortKey = "attemptsPerYear";
const EXAMINER_SUGGESTIONS = 3;
/** Typing shows at once. The URL, and the list that follows it, update when typing pauses. */
const SEARCH_DELAY_MS = 150;

export function CourseListPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const language = useLanguage();
  const t = useMessages();
  const { data: snapshot } = useSuspenseQuery(catalogQuery(language));
  const { ref: filtersRef, height: filtersHeight } = useElementSize<HTMLDivElement>();
  const { ref: resultsRef, scrollBack } = useScrollBack<HTMLDivElement>();

  const { sort = DEFAULT_SORT, dir = "desc", programme, examiner, periods, q = "" } = search;
  // A new list can take long to render on a slow device, so it renders in the background and typing stays quick. The
  // render that the URL starts keeps the old query, and the memo spares it filtering again.
  const query = useDeferredValue(q);
  const { active, newCourses, ended } = useMemo(() => {
    const filters = { q: query, programme, examiner, periods, sort, dir };
    return { ...queryCourses(snapshot.courses, filters), newCourses: queryNewCourses(snapshot.newCourses, filters) };
  }, [snapshot.courses, snapshot.newCourses, query, programme, examiner, periods, sort, dir]);
  const scoped = Boolean(programme ?? examiner);
  const programmeMatches = scoped ? [] : matchProgrammes(snapshot.listedProgrammes, query);
  const examinerMatches = scoped ? [] : matchExaminers(snapshot.examiners, query, EXAMINER_SUGGESTIONS);
  const survey = surveyColumn(sort, search.survey);
  // The heading counts the whole scope, whatever the other filters keep.
  const inThisScope = (course: Parameters<typeof inScope>[0]) => inScope(course, { programme, examiner });
  const scopeTotal = snapshot.courses.filter(inThisScope).length + snapshot.newCourses.filter(inThisScope).length;
  const maxAttempts = Math.max(...snapshot.courses.map((c) => c.attemptsPerYear));
  const coursesIn = (code: string) => snapshot.courses.filter((c) => c.programme === code).length;

  // A new filter or sort keeps the filters where they are and starts the list over just below them.
  const updateList = (changes: Partial<ListSearch>, replace = false) => {
    scrollBack();
    void navigate({ search: (prev) => ({ ...prev, ...changes }), replace, resetScroll: false });
  };
  const setQuery = useDebouncedCallback((value: string) => updateList({ q: value || undefined }, true), SEARCH_DELAY_MS);
  const clearScope = () => updateList({ programme: undefined, examiner: undefined });
  const setPeriods = (values: string[]) => {
    const picked = PERIOD_FILTERS.filter((p) => values.includes(p));
    updateList({ periods: picked.length ? picked : undefined }, true);
  };
  const setSort = (key: SortKey, nextDir: SortDir) => updateList({ sort: key, dir: nextDir }, true);
  // Picking a question shows it in the survey column and sorts by it. The column keeps it while sorting by another.
  const pickSurvey = (question: Question) => {
    const key = surveySortKey(question);
    updateList({ sort: key, dir: defaultSortDir(key), survey: question === "overall" ? undefined : question }, true);
  };
  // Opening the group below the list should not move the page.
  const toggleEnded = () =>
    navigate({ search: (prev) => ({ ...prev, ended: search.ended ? undefined : true }), replace: true, resetScroll: false });

  return (
    <div className="flex flex-col gap-4">
      {programme && (
        <ScopeHeading title={snapshot.programmes[programme]?.name ?? programme} onClear={clearScope}>
          {programme} · {t.courses(scopeTotal)}
        </ScopeHeading>
      )}
      {examiner && (
        <ScopeHeading title={examiner} onClear={clearScope}>
          {t.list.examinerOfIn(scopeTotal, snapshot.plans.academicYear)}
        </ScopeHeading>
      )}
      {/* The negative margin cancels the padding the filters need when stuck, so the top of this box is where they stick. */}
      <div ref={resultsRef} className="-mt-2 flex flex-col gap-2">
        <div ref={filtersRef} className="sticky top-0 z-30 flex flex-wrap gap-2 bg-background py-2">
          <SearchField
            key={programme ?? examiner}
            defaultValue={q}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.list.searchPlaceholder}
            aria-label={t.list.search}
            className="min-w-60 flex-1"
          />
          <PeriodFilter periods={periods ?? []} academicYear={snapshot.plans.academicYear} onChange={setPeriods} />
        </div>

        {programmeMatches.length + examinerMatches.length > 0 && (
          <ul className="flex flex-col gap-1">
            {programmeMatches.map((match) => (
              <Suggestion key={match.code} search={{ programme: match.code }} name={match.name}>
                {match.code} · {t.courses(coursesIn(match.code))}
              </Suggestion>
            ))}
            {examinerMatches.map((match) => (
              <Suggestion key={match.name} search={{ examiner: match.name }} name={match.name}>
                {t.list.examinerOf(match.courses)}
              </Suggestion>
            ))}
          </ul>
        )}

        <CourseTable
          active={active}
          newCourses={newCourses}
          ended={ended}
          showEnded={search.ended ?? false}
          onToggleEnded={toggleEnded}
          sort={sort}
          dir={dir}
          onSortChange={setSort}
          survey={survey}
          onPickSurvey={pickSurvey}
          query={query}
          programmes={snapshot.programmes}
          maxAttempts={maxAttempts}
          stickyTop={filtersHeight}
        />
      </div>
    </div>
  );
}

function ScopeHeading({ title, onClear, children }: { title: string; onClear: () => void; children: ReactNode }) {
  const t = useMessages();
  return (
    <div className="flex flex-col gap-2">
      <Button variant="ghost" size="sm" className="-ml-2 self-start" onClick={onClear}>
        <ArrowLeftIcon />
        {t.allCourses}
      </Button>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <span className="text-muted-foreground">{children}</span>
      </div>
    </div>
  );
}

/** A programme or examiner the search matched, which scopes the list. */
function Suggestion({
  search,
  name,
  children,
}: {
  search: { programme: string } | { examiner: string };
  name: string;
  children: ReactNode;
}) {
  return (
    <li>
      <Link to="/" search={search} className="flex items-baseline gap-3 rounded-md border px-3 py-2 hover:bg-muted/50">
        <span className="font-medium">{name}</span>
        <span className="text-sm text-muted-foreground">{children}</span>
      </Link>
    </li>
  );
}

interface PeriodFilterProps {
  periods: readonly StudyPeriod[];
  academicYear: string;
  onChange: (periods: string[]) => void;
}

/** Keeps the courses that run in any of the picked study periods this year. */
function PeriodFilter({ periods, academicYear, onChange }: PeriodFilterProps) {
  const label = useMessages().list.runsIn(academicYear);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ToggleGroup type="multiple" variant="outline" spacing={0} value={[...periods]} onValueChange={onChange} aria-label={label}>
          {PERIOD_FILTERS.map((p) => (
            <ToggleGroupItem key={p} value={p} className="h-10 px-3">
              {p}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
