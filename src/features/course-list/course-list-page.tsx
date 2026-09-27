import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { SearchIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { catalogQuery } from "@/data/queries";
import { matchProgrammes, queryCourses, type SortDir, type SortKey } from "@/domain/catalog";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { formatCount } from "@/lib/format";
import { CourseTable } from "./course-table";

const route = getRouteApi("/");

const ALL_PROGRAMMES = "all";
const DEFAULT_SORT: SortKey = "attemptsPerYear";
/** Typing shows at once. The URL, and the list that follows it, update when typing pauses. */
const SEARCH_DELAY_MS = 150;
/** 16px text on phones, because iOS zooms into focused fields with smaller text. */
const FIELD_SIZE = "[&_select]:h-10 [&_select]:text-base md:[&_select]:text-sm";

export function CourseListPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const { data: snapshot } = useSuspenseQuery(catalogQuery);

  const { sort = DEFAULT_SORT, dir = "desc", programme, q = "" } = search;
  const { active, ended } = queryCourses(snapshot.courses, { q, programme, sort, dir });
  const programmeMatches = programme ? [] : matchProgrammes(snapshot.programmes, q);
  const maxAttempts = Math.max(...snapshot.courses.map((c) => c.attemptsPerYear));
  const coursesIn = (code: string) => snapshot.courses.filter((c) => c.programme === code).length;

  const setQuery = useDebouncedCallback(
    (value: string) => navigate({ search: (prev) => ({ ...prev, q: value || undefined }), replace: true }),
    SEARCH_DELAY_MS,
  );
  const setProgramme = (value: string | undefined) => navigate({ search: (prev) => ({ ...prev, programme: value, q: undefined }) });
  const setSort = (key: SortKey, nextDir: SortDir) => navigate({ search: (prev) => ({ ...prev, sort: key, dir: nextDir }), replace: true });
  const toggleEnded = () => navigate({ search: (prev) => ({ ...prev, ended: search.ended ? undefined : true }), replace: true });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            key={programme ?? ALL_PROGRAMMES}
            type="search"
            defaultValue={q}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Course, code or programme"
            aria-label="Search"
            autoComplete="off"
            spellCheck={false}
            className="h-10 pl-9 text-base"
          />
        </div>
        <ProgrammeSelect programme={programme} programmes={snapshot.programmes} />
      </div>

      {programmeMatches.length > 0 && (
        <ul className="flex flex-col gap-1">
          {programmeMatches.map((match) => (
            <li key={match.code}>
              <Link
                to="/"
                search={{ programme: match.code }}
                className="flex items-baseline gap-3 rounded-md border px-3 py-2 hover:bg-muted/50"
              >
                <span className="font-medium">{match.name}</span>
                <span className="text-sm text-muted-foreground">
                  {match.code} · {formatCount(coursesIn(match.code))} courses
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {programme && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-2">
          <h1 className="text-2xl font-semibold">{snapshot.programmes[programme] ?? programme}</h1>
          <span className="text-muted-foreground">
            {programme} · {formatCount(active.length + ended.length)} courses
          </span>
          <Button variant="ghost" size="sm" onClick={() => setProgramme(undefined)}>
            <XIcon />
            All programmes
          </Button>
        </div>
      )}

      <CourseTable
        active={active}
        ended={ended}
        showEnded={search.ended ?? false}
        onToggleEnded={toggleEnded}
        sort={sort}
        dir={dir}
        onSortChange={setSort}
        programmes={snapshot.programmes}
        maxAttempts={maxAttempts}
      />
    </div>
  );
}

function ProgrammeSelect({ programme, programmes }: { programme?: string; programmes: Record<string, string> }) {
  const navigate = route.useNavigate();
  const options = Object.entries(programmes).sort(([, a], [, b]) => a.localeCompare(b, "sv"));
  return (
    <NativeSelect
      value={programme ?? ALL_PROGRAMMES}
      onChange={(event) => {
        const { value } = event.target;
        navigate({ search: (prev) => ({ ...prev, programme: value === ALL_PROGRAMMES ? undefined : value, q: undefined }) });
      }}
      aria-label="Programme"
      className={cn("w-full sm:w-72", FIELD_SIZE)}
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
