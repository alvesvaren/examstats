import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeftIcon, SearchIcon } from "lucide-react";
import { cn } from "cn";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { catalogQuery } from "@/data/queries";
import {
  defaultSortDir,
  inScope,
  matchExaminers,
  matchProgrammes,
  queryCourses,
  surveyColumn,
  surveySortKey,
  type SortDir,
  type SortKey,
} from "@/domain/catalog";
import type { Question } from "@/domain/evaluation";
import type { InLanguage } from "@/domain/names";
import type { StudyPeriod } from "@/domain/programme-plans";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { useElementSize } from "@/hooks/use-element-size";
import { useLanguage } from "@/hooks/use-language";
import { useScrollBack } from "@/hooks/use-scroll-back";
import { formatCourses } from "@/lib/format";
import { CourseTable } from "./course-table";

const route = getRouteApi("/");
type ListSearch = ReturnType<typeof route.useSearch>;

const ALL_PROGRAMMES = "all";
/** The study periods the list filters on. Summer courses and those outside study periods are few. */
const PERIOD_FILTERS = ["LP1", "LP2", "LP3", "LP4"] as const satisfies readonly StudyPeriod[];
const DEFAULT_SORT: SortKey = "attemptsPerYear";
const EXAMINER_SUGGESTIONS = 3;
/** Typing shows at once. The URL, and the list that follows it, update when typing pauses. */
const SEARCH_DELAY_MS = 150;
/** 16px text on phones, because iOS zooms into focused fields with smaller text. */
const FIELD_SIZE = "[&_select]:h-10 [&_select]:text-base md:[&_select]:text-sm";

export function CourseListPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const language = useLanguage();
  const { data: snapshot } = useSuspenseQuery(catalogQuery(language));
  const { ref: filtersRef, height: filtersHeight } = useElementSize<HTMLDivElement>();
  const { ref: resultsRef, scrollBack } = useScrollBack<HTMLDivElement>();

  const { sort = DEFAULT_SORT, dir = "desc", programme, examiner, periods = [], q = "" } = search;
  const { active, ended } = queryCourses(snapshot.courses, { q, programme, examiner, periods, sort, dir });
  const scoped = Boolean(programme ?? examiner);
  const programmeMatches = scoped ? [] : matchProgrammes(snapshot.listedProgrammes, q);
  const examinerMatches = scoped ? [] : matchExaminers(snapshot.examiners, q, EXAMINER_SUGGESTIONS);
  const survey = surveyColumn(sort, search.survey);
  // The heading counts the whole scope, whatever the other filters keep.
  const scopeTotal = formatCourses(snapshot.courses.filter((c) => inScope(c, { programme, examiner })).length);
  const maxAttempts = Math.max(...snapshot.courses.map((c) => c.attemptsPerYear));
  const coursesIn = (code: string) => snapshot.courses.filter((c) => c.programme === code).length;

  // A new filter or sort keeps the filters where they are and starts the list over just below them.
  const updateList = (changes: Partial<ListSearch>, replace = false) => {
    scrollBack();
    void navigate({ search: (prev) => ({ ...prev, ...changes }), replace, resetScroll: false });
  };
  const setQuery = useDebouncedCallback((value: string) => updateList({ q: value || undefined }, true), SEARCH_DELAY_MS);
  // A list has one scope, a programme or an examiner.
  const setProgramme = (value: string | undefined) => updateList({ programme: value, examiner: undefined, q: undefined });
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
          {programme} · {scopeTotal}
        </ScopeHeading>
      )}
      {examiner && (
        <ScopeHeading title={examiner} onClear={clearScope}>
          Examiner of {scopeTotal} in {snapshot.plans.academicYear}
        </ScopeHeading>
      )}
      {/* The negative margin cancels the padding the filters need when stuck, so the top of this box is where they stick. */}
      <div ref={resultsRef} className="-mt-2 flex flex-col gap-2">
        <div ref={filtersRef} className="sticky top-0 z-30 flex flex-wrap gap-2 bg-background py-2">
          <div className="relative min-w-60 flex-1 basis-full sm:basis-0">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              key={programme ?? examiner ?? ALL_PROGRAMMES}
              type="search"
              defaultValue={q}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Course, programme or examiner, use ; for several"
              aria-label="Search"
              autoComplete="off"
              spellCheck={false}
              className="h-10 pl-9 text-base"
            />
          </div>
          <ProgrammeSelect programme={programme} programmes={snapshot.listedProgrammes} onChange={setProgramme} />
          <PeriodFilter periods={periods} academicYear={snapshot.plans.academicYear} onChange={setPeriods} />
        </div>

        {programmeMatches.length + examinerMatches.length > 0 && (
          <ul className="flex flex-col gap-1">
            {programmeMatches.map((match) => (
              <Suggestion key={match.code} search={{ programme: match.code }} name={match.name}>
                {match.code} · {formatCourses(coursesIn(match.code))}
              </Suggestion>
            ))}
            {examinerMatches.map((match) => (
              <Suggestion key={match.name} search={{ examiner: match.name }} name={match.name}>
                Examiner of {formatCourses(match.courses)}
              </Suggestion>
            ))}
          </ul>
        )}

        <CourseTable
          active={active}
          ended={ended}
          showEnded={search.ended ?? false}
          onToggleEnded={toggleEnded}
          sort={sort}
          dir={dir}
          onSortChange={setSort}
          survey={survey}
          onPickSurvey={pickSurvey}
          query={q}
          programmes={snapshot.programmes}
          maxAttempts={maxAttempts}
          stickyTop={filtersHeight}
        />
      </div>
    </div>
  );
}

function ScopeHeading({ title, onClear, children }: { title: string; onClear: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Button variant="ghost" size="sm" className="-ml-2 self-start" onClick={onClear}>
        <ArrowLeftIcon />
        All courses
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
  const label = `Runs in the study period in ${academicYear}`;
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

interface ProgrammeSelectProps {
  programme?: string;
  programmes: Record<string, InLanguage>;
  onChange: (programme: string | undefined) => void;
}

function ProgrammeSelect({ programme, programmes, onChange }: ProgrammeSelectProps) {
  const options = Object.entries(programmes)
    .map(([code, { name }]) => [code, name] as const)
    .toSorted(([, a], [, b]) => a.localeCompare(b, "sv"));
  return (
    <NativeSelect
      value={programme ?? ALL_PROGRAMMES}
      onChange={(event) => {
        const { value } = event.target;
        onChange(value === ALL_PROGRAMMES ? undefined : value);
      }}
      aria-label="Programme"
      className={cn("min-w-0 flex-1 sm:w-72 sm:flex-none", FIELD_SIZE)}
    >
      <NativeSelectOption value={ALL_PROGRAMMES}>All programmes</NativeSelectOption>
      {options.map(([code, name]) => (
        <NativeSelectOption key={code} value={code}>
          {name === code ? code : `${name} · ${code}`}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
