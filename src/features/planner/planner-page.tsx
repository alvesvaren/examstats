import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { catalogQuery, plansQuery } from "@/data/queries";
import { rememberedPicks } from "@/domain/planner-memory";
import { tracksOf } from "@/domain/programme-plans";
import { usePlannerMemory } from "@/hooks/use-planner-memory";
import { PLANNER_HEADING } from "@/lib/page-meta";
import { ProgrammeSearch } from "./programme-search";
import { YearPlanner } from "./year-planner";

const route = getRouteApi("/planner");
export type PlannerSearch = ReturnType<typeof route.useSearch>;

const ALL_TRACKS = "";
/** 16px text on phones, because iOS zooms into focused fields with smaller text. */
const FIELD_SIZE = "[&_select]:h-10 [&_select]:text-base md:[&_select]:text-sm";

export function PlannerPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const { data: plans } = useSuspenseQuery(plansQuery);
  const { data: catalog } = useSuspenseQuery(catalogQuery);
  const { memory, remember } = usePlannerMemory();

  const programme = plans.find((p) => p.code === search.programme);
  if (!programme) return <ProgrammeSearch programmes={plans} swedishNames={catalog.programmes} />;

  const update = (changes: Partial<PlannerSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...changes }), replace: true, resetScroll: false });
  const years = programme.years.map((y) => y.year);
  const year = years.find((y) => y === search.year) ?? years[0];
  const tracks = tracksOf(programme.years.find((y) => y.year === year)?.courses ?? []);
  const track = tracks.find((t) => t === search.track);
  const swedishName = catalog.programmes[programme.code];
  // The header's link to the planner comes back to the year and track last shown.
  const showYear = (next: number) => {
    remember((m) => ({ ...m, last: { programme: programme.code, year: next } }));
    void update({ year: next, track: undefined, period: undefined, picked: rememberedPicks(memory, programme.code, next) });
  };
  const showTrack = (next: string | undefined) => {
    remember((m) => ({ ...m, last: { programme: programme.code, year, track: next } }));
    void update({ track: next });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="-ml-2 self-start" asChild>
          <Link to="/planner">
            <ArrowLeftIcon />
            All programmes
          </Link>
        </Button>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold">{programme.name}</h1>
          <span className="text-muted-foreground">{[programme.code, swedishName].filter(Boolean).join(" · ")}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          value={String(year)}
          onValueChange={(value) => value && showYear(Number(value))}
          aria-label="Year of study"
        >
          {years.map((y) => (
            <ToggleGroupItem key={y} value={String(y)}>
              Year {y}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {tracks.length > 0 && (
          <NativeSelect
            aria-label="Track"
            className={FIELD_SIZE}
            value={track ?? ALL_TRACKS}
            onChange={(event) => showTrack(event.target.value || undefined)}
          >
            <NativeSelectOption value={ALL_TRACKS}>All tracks</NativeSelectOption>
            {tracks.map((t) => (
              <NativeSelectOption key={t} value={t}>
                {t}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </div>

      {year === undefined ? (
        <p className="text-muted-foreground">{PLANNER_HEADING} has no courses for this programme yet.</p>
      ) : (
        <YearPlanner programme={programme} year={year} track={track} search={search} onChange={update} catalog={catalog} />
      )}
    </div>
  );
}
