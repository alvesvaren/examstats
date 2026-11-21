import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, PlusIcon, RepeatIcon } from "lucide-react";
import { FieldSelect } from "@/components/field-select";
import { Button } from "@/components/ui/button";
import { NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { academicYearOf, MASTER_START_YEAR } from "@/domain/programme-plans";
import { useMessages } from "@/hooks/use-messages";
import { ChalmersLink, Prerequisites, Specialisations } from "./master-details";
import { MasterPicker, MastersNotPublished, UnplannedCourses } from "./master-picker";
import { ProgrammeSearch } from "./programme-search";
import { usePlanner } from "./use-planner";
import { YearPlanner } from "./year-planner";

const ALL_TRACKS = "";

export function PlannerPage() {
  const t = useMessages();
  const { state, catalog, dispatch, openProgramme, rememberProgramme } = usePlanner();
  if (state.kind === "search") {
    return <ProgrammeSearch programmes={state.programmes} names={state.names} onOpen={openProgramme} onRemember={rememberProgramme} />;
  }

  const { programme, otherName, cohort, masters, master, masterAccreditation, years, choosingMaster, current, tracks, track } = state;
  const startYears = cohort.admitted.toReversed();
  const chooseMaster = (code: string | undefined) => dispatch({ type: "chooseMaster", master: code });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="-ml-2 self-start" asChild>
          <Link to="/planner">
            <ArrowLeftIcon />
            {t.allProgrammes}
          </Link>
        </Button>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold">{programme.name}</h1>
          <span className="text-muted-foreground">{[programme.code, otherName].filter(Boolean).join(" · ")}</span>
          <ChalmersLink code={programme.code} />
        </div>
        {master && (
          <p className="text-muted-foreground">
            {t.planner.mastersYears} <span className="font-medium text-foreground">{master.name}</span> · {master.code}{" "}
            <ChalmersLink code={master.code} courseList={masterAccreditation?.courseList} />
          </p>
        )}
        {masterAccreditation && <Specialisations names={masterAccreditation.specialisations} className="text-sm" />}
        {master && master.prerequisites.length > 0 && (
          <Prerequisites paragraphs={master.prerequisites} className="text-sm">
            {t.planner.prerequisitesOf(master.code)}
          </Prerequisites>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {cohort.admitted.length > 1 && (
          <FieldSelect
            aria-label={t.planner.startYear}
            value={String(cohort.start)}
            onChange={(event) => dispatch({ type: "showStart", start: Number(event.target.value) })}
          >
            {startYears.map((year) => (
              <NativeSelectOption key={year} value={String(year)}>
                {t.planner.started(academicYearOf(year))}
              </NativeSelectOption>
            ))}
          </FieldSelect>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            value={choosingMaster || !current ? "" : String(current.number)}
            onValueChange={(value) => value && dispatch({ type: "showYear", year: Number(value) })}
            aria-label={t.planner.yearOfStudy}
          >
            {years.map(({ number }) => (
              <ToggleGroupItem key={number} value={String(number)}>
                {t.planner.year(number)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {masters.length > 0 &&
            (master ? (
              <Button variant="ghost" onClick={() => chooseMaster(undefined)}>
                <RepeatIcon />
                {t.planner.changeMaster}
              </Button>
            ) : (
              <Button
                variant="outline"
                aria-pressed={choosingMaster}
                onClick={() => dispatch({ type: "showYear", year: MASTER_START_YEAR })}
                className="border-dashed aria-pressed:border-primary aria-pressed:bg-muted dark:aria-pressed:border-primary"
              >
                <PlusIcon />
                {t.planner.addMaster}
              </Button>
            ))}
        </div>
        {tracks.length > 0 && (
          <FieldSelect
            aria-label={t.planner.track}
            value={track ?? ALL_TRACKS}
            onChange={(event) => dispatch({ type: "showTrack", track: event.target.value || undefined })}
          >
            <NativeSelectOption value={ALL_TRACKS}>{t.planner.allTracks}</NativeSelectOption>
            {tracks.map((name) => (
              <NativeSelectOption key={name} value={name}>
                {name}
              </NativeSelectOption>
            ))}
          </FieldSelect>
        )}
      </div>

      {state.showsMasters && !cohort.mastersPublished && (
        <MastersNotPublished year={cohort.masterStart} shown={catalog.plans.academicYear} upcoming={cohort.upcomingMasters} />
      )}
      {master && state.unplanned && (
        <UnplannedCourses
          master={master.code}
          names={state.unplanned}
          shown={catalog.plans.academicYear}
          courseList={masterAccreditation?.courseList ?? null}
        />
      )}

      {choosingMaster ? (
        <MasterPicker programme={programme} masters={masters} accredited={state.accredited} catalog={catalog} onChoose={chooseMaster} />
      ) : current === undefined ? (
        <p className="text-muted-foreground">{t.planner.noCourses}</p>
      ) : (
        <YearPlanner
          years={years}
          current={current}
          track={track}
          search={state.search}
          pickedKeys={state.pickedKeys}
          otherPicks={state.otherPicks}
          catalog={catalog}
          dispatch={dispatch}
        />
      )}
    </div>
  );
}
