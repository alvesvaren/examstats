import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeftIcon, PlusIcon, RepeatIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { catalogQuery, plansQuery } from "@/data/queries";
import { otherNameOf } from "@/domain/planner";
import { rememberedPicks, withMaster } from "@/domain/planner-memory";
import { MASTER_START_YEAR, studyYears, tracksOf, type StudyYear } from "@/domain/programme-plans";
import { useLanguage } from "@/hooks/use-language";
import { usePlannerMemory } from "@/hooks/use-planner-memory";
import { PLANNER_HEADING } from "@/lib/page-meta";
import { MasterPicker, Prerequisites } from "./master-picker";
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
  const language = useLanguage();
  const { data: plans } = useSuspenseQuery(plansQuery(language));
  const { data: catalog } = useSuspenseQuery(catalogQuery(language));
  const { memory, remember } = usePlannerMemory();

  const programme = plans.find((p) => p.code === search.programme);
  if (!programme) return <ProgrammeSearch programmes={plans} names={catalog.programmes} />;

  const update = (changes: Partial<PlannerSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...changes }), replace: true, resetScroll: false });
  const masters = plans.filter((p) => programme.masters.includes(p.code));
  // A master's programme in the URL is a shared plan and wins. Without one, the degree is as this device remembers it.
  const masterCode = search.master ?? memory.masters[programme.code];
  const master = masters.find((p) => p.code === masterCode);
  const years = studyYears(programme, master);
  // Without a master's programme, its first year is where to choose one.
  const choosingMaster = !master && masters.length > 0 && search.year === MASTER_START_YEAR;
  const current = years.find((y) => y.number === search.year) ?? years[0];
  const tracks = choosingMaster ? [] : tracksOf(current?.plan.years.find((y) => y.year === current.year)?.courses ?? []);
  const track = tracks.find((t) => t === search.track);
  const otherName = otherNameOf(catalog.programmes, programme.code);

  const picksIn = (shown: StudyYear | undefined) => shown && rememberedPicks(memory, shown.plan.code, shown.year);
  // The header's link to the planner comes back to the year and track last shown.
  const showYear = (next: number) => {
    remember((m) => ({ ...m, last: { programme: programme.code, year: next } }));
    void update({
      year: next,
      master: master?.code,
      track: undefined,
      period: undefined,
      picked: picksIn(years.find((y) => y.number === next)),
    });
  };
  const showTrack = (next: string | undefined) => {
    remember((m) => ({ ...m, last: { programme: programme.code, year: current?.number, track: next } }));
    void update({ track: next });
  };
  const chooseMaster = (code: string | undefined) => {
    const chosen = studyYears(
      programme,
      masters.find((p) => p.code === code),
    );
    remember((m) => ({ ...withMaster(m, programme.code, code), last: { programme: programme.code, year: MASTER_START_YEAR } }));
    void update({
      year: MASTER_START_YEAR,
      master: code,
      track: undefined,
      period: undefined,
      picked: picksIn(chosen.find((y) => y.number === MASTER_START_YEAR)),
    });
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
          <span className="text-muted-foreground">{[programme.code, otherName].filter(Boolean).join(" · ")}</span>
        </div>
        {master && (
          <p className="text-muted-foreground">
            Years 4 and 5: <span className="font-medium text-foreground">{master.name}</span> · {master.code}
          </p>
        )}
        {master && master.prerequisites.length > 0 && (
          <Prerequisites paragraphs={master.prerequisites} className="text-sm">
            Prerequisites of {master.code}
          </Prerequisites>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            value={choosingMaster || !current ? "" : String(current.number)}
            onValueChange={(value) => value && showYear(Number(value))}
            aria-label="Year of study"
          >
            {years.map(({ number }) => (
              <ToggleGroupItem key={number} value={String(number)}>
                Year {number}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {masters.length > 0 &&
            (master ? (
              <Button variant="ghost" onClick={() => chooseMaster(undefined)}>
                <RepeatIcon />
                Change master
              </Button>
            ) : (
              <Button
                variant="outline"
                aria-pressed={choosingMaster}
                onClick={() => showYear(MASTER_START_YEAR)}
                className="border-dashed aria-pressed:border-primary aria-pressed:bg-muted dark:aria-pressed:border-primary"
              >
                <PlusIcon />
                Add master
              </Button>
            ))}
        </div>
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

      {choosingMaster ? (
        <MasterPicker programme={programme} masters={masters} catalog={catalog} onChoose={chooseMaster} />
      ) : current === undefined ? (
        <p className="text-muted-foreground">{PLANNER_HEADING} has no courses for this programme yet.</p>
      ) : (
        <YearPlanner
          programme={programme}
          years={years}
          current={current}
          track={track}
          search={search}
          onChange={update}
          catalog={catalog}
        />
      )}
    </div>
  );
}
