import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeftIcon, PlusIcon, RepeatIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { catalogQuery, plansQuery } from "@/data/queries";
import { chosenTrack, NO_TRACK, otherNameOf, trackNoun } from "@/domain/planner";
import { rememberedPicks, withMaster, withStart, withTrack } from "@/domain/planner-memory";
import { academicYearOf, cohortOf, MASTER_START_YEAR, studyYears, tracksOf, type StudyYear } from "@/domain/programme-plans";
import { useLanguage } from "@/hooks/use-language";
import { usePlannerMemory } from "@/hooks/use-planner-memory";
import { PLANNER_HEADING } from "@/lib/page-meta";
import { ChalmersLink, MasterPicker, type Accreditation, MastersNotPublished, Prerequisites, Specialisations } from "./master-picker";
import { StartChooser, TrackChooser } from "./choosers";
import { ProgrammeSearch } from "./programme-search";
import { YearPlanner } from "./year-planner";

const route = getRouteApi("/planner");
export type PlannerSearch = ReturnType<typeof route.useSearch>;

/** 16px text on phones, because iOS zooms into focused fields with smaller text. */
const FIELD_SIZE = "[&_select]:h-10 [&_select]:text-base md:[&_select]:text-sm";

export function PlannerPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const language = useLanguage();
  const { data: catalog } = useSuspenseQuery(catalogQuery(language));
  const { memory, remember } = usePlannerMemory();
  // A start year in the URL is a shared plan and wins. Without one, it is the one this device remembers.
  const cohort = cohortOf(catalog.plans, search.programme, search.start ?? memory.starts[search.programme ?? ""]);
  const { data: plans } = useSuspenseQuery(plansQuery(language, cohort.start));
  const { data: masterPlans } = useSuspenseQuery(plansQuery(language, cohort.masterPlans));

  const programme = plans.find((p) => p.code === search.programme);
  if (!programme) return <ProgrammeSearch programmes={plans} names={catalog.programmes} />;

  const update = (changes: Partial<PlannerSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...changes }), replace: true, resetScroll: false });
  // Upcoming master's programmes come with their own accreditations, since the programme syllabus names the current ones.
  const upcoming = cohort.upcomingMasters;
  const accredited = new Map<string, Accreditation>(
    upcoming
      ? (upcoming.accreditations[programme.code] ?? []).map(({ code, specialisations }) => [
          code,
          { specialisations, courseList: upcoming.masters[code]?.courseList ?? null },
        ])
      : programme.masters.map((code) => [code, { specialisations: [], courseList: null }]),
  );
  const masters = masterPlans.filter((p) => accredited.has(p.code));
  // A master's programme in the URL is a shared plan and wins. Without one, the degree is as this device remembers it.
  const masterCode = search.master ?? memory.masters[programme.code];
  const master = masters.find((p) => p.code === masterCode);
  const years = studyYears(programme, master);
  // Without a master's programme, its first year is where to choose one.
  const choosingMaster = !master && masters.length > 0 && search.year === MASTER_START_YEAR;
  const current = years.find((y) => y.number === search.year) ?? years[0];
  const tracks = choosingMaster ? [] : tracksOf(current?.plan.years.find((y) => y.year === current.year)?.courses ?? []);
  // A track in the URL is a shared plan and wins. Without one, it is the one this device chose in the plan, which a
  // master's programme keeps in both its years. Without either, the student chooses one, or none.
  const trackChoice = current && chosenTrack(tracks, search.track, memory.tracks[current.plan.code]);
  const track = trackChoice || undefined;
  const choosingTrack = tracks.length > 0 && trackChoice === undefined;
  const noun = trackNoun(current?.plan.code ?? programme.code);
  // The plan depends on the start year, and the newest is easy to keep by mistake, so the student chooses it.
  const choosingStart = cohort.admitted.length > 1 && (search.start ?? memory.starts[programme.code]) === undefined;
  const otherName = otherNameOf(catalog.programmes, programme.code);

  const picksIn = (shown: StudyYear | undefined) => shown && rememberedPicks(memory, shown.plan.code, shown.year);
  const start = cohort.start;
  // The header's link to the planner comes back to the start year, year and track last shown.
  const showYear = (next: number) => {
    const shown = years.find((y) => y.number === next);
    const nextTrack = shown && memory.tracks[shown.plan.code];
    remember((m) => ({ ...m, last: { programme: programme.code, start, year: next, track: nextTrack || undefined } }));
    void update({
      start,
      year: next,
      master: master?.code,
      track: nextTrack,
      period: undefined,
      picked: picksIn(shown),
    });
  };
  const showTrack = (next: string) => {
    if (!current) return;
    remember((m) => ({
      ...withTrack(m, current.plan.code, next),
      last: { programme: programme.code, start, year: current.number, track: next || undefined },
    }));
    void update({ track: next, period: undefined });
  };
  const chooseMaster = (code: string | undefined) => {
    const chosen = studyYears(
      programme,
      masters.find((p) => p.code === code),
    );
    remember((m) => ({ ...withMaster(m, programme.code, code), last: { programme: programme.code, start, year: MASTER_START_YEAR } }));
    void update({
      start,
      year: MASTER_START_YEAR,
      master: code,
      track: code ? memory.tracks[code] : undefined,
      period: undefined,
      picked: picksIn(chosen.find((y) => y.number === MASTER_START_YEAR)),
    });
  };
  const showStart = (next: number) => {
    remember((m) => ({ ...withStart(m, programme.code, next), last: { programme: programme.code, start: next, year: current?.number } }));
    void update({ start: next, track: undefined, period: undefined });
  };
  const showsMasters = Boolean(master) || choosingMaster;
  const masterAccreditation = master && accredited.get(master.code);
  // Courses only an upcoming master's course list names link to that list.
  const courseList = master && current?.plan === master ? (masterAccreditation?.courseList ?? null) : null;

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
          <ChalmersLink code={programme.code} />
        </div>
        {master && (
          <p className="text-muted-foreground">
            Years 4 and 5: <span className="font-medium text-foreground">{master.name}</span> · {master.code}{" "}
            <ChalmersLink code={master.code} courseList={masterAccreditation?.courseList} />
          </p>
        )}
        {masterAccreditation && <Specialisations names={masterAccreditation.specialisations} className="text-sm" />}
        {master && master.prerequisites.length > 0 && (
          <Prerequisites paragraphs={master.prerequisites} className="text-sm">
            Prerequisites of {master.code}
          </Prerequisites>
        )}
      </div>

      {choosingStart ? (
        <StartChooser admitted={cohort.admitted} onChoose={showStart} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {cohort.admitted.length > 1 && (
              <NativeSelect
                aria-label="Year you started the programme"
                className={FIELD_SIZE}
                value={String(start)}
                onChange={(event) => showStart(Number(event.target.value))}
              >
                {cohort.admitted.toReversed().map((year) => (
                  <NativeSelectOption key={year} value={String(year)}>
                    Started {academicYearOf(year)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
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
            {tracks.length > 0 && !choosingTrack && (
              <NativeSelect
                aria-label={noun}
                className={FIELD_SIZE}
                value={trackChoice ?? NO_TRACK}
                onChange={(event) => showTrack(event.target.value)}
              >
                <NativeSelectOption value={NO_TRACK}>No {noun}</NativeSelectOption>
                {tracks.map((t) => (
                  <NativeSelectOption key={t} value={t}>
                    {t}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </div>

          {showsMasters && !cohort.mastersPublished && (
            <MastersNotPublished year={cohort.masterStart} shown={catalog.plans.academicYear} upcoming={upcoming} />
          )}

          {choosingMaster ? (
            <MasterPicker programme={programme} masters={masters} accredited={accredited} catalog={catalog} onChoose={chooseMaster} />
          ) : current === undefined ? (
            <p className="text-muted-foreground">{PLANNER_HEADING} has no courses for this programme yet.</p>
          ) : choosingTrack ? (
            <TrackChooser noun={noun} planName={current.plan.name} tracks={tracks} onChoose={showTrack} />
          ) : (
            <YearPlanner
              programme={programme}
              years={years}
              current={current}
              track={track}
              search={search}
              onChange={update}
              catalog={catalog}
              courseList={courseList}
            />
          )}
        </>
      )}
    </div>
  );
}
