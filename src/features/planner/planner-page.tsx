import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, PlusIcon, RepeatIcon } from "lucide-react";
import { FieldSelect } from "@/components/field-select";
import { Button } from "@/components/ui/button";
import { NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { admissionTo } from "@/domain/eligibility";
import { NO_TRACK } from "@/domain/planner-state";
import { academicYearOf, MASTER_START_YEAR } from "@/domain/programme-plans";
import { useMessages } from "@/hooks/use-messages";
import { StartChooser, TrackChooser } from "./choosers";
import { AdmissionDetails } from "./admission";
import { ChalmersLink, CourseListLink, Prerequisites, Specialisations } from "./master-details";
import { MasterPicker, MastersNotPublished } from "./master-picker";
import { ProgrammeSearch } from "./programme-search";
import { usePlanner } from "./use-planner";
import { YearPlanner } from "./year-planner";

export function PlannerPage() {
  const t = useMessages();
  const { state, catalog, guide, dispatch, openProgramme, rememberProgramme } = usePlanner();
  if (state.kind === "search") {
    return <ProgrammeSearch programmes={state.programmes} names={state.names} onOpen={openProgramme} onRemember={rememberProgramme} />;
  }

  const { programme, otherName, cohort, masters, master, masterAccreditation, years, choosingMaster, current } = state;
  const { tracks, tracksWithoutDegree, track, trackKind, choosingTrack, choosingStart } = state;
  const startYears = cohort.admitted.toReversed();
  const chooseMaster = (code: string | undefined) => dispatch({ type: "chooseMaster", master: code });
  const showStart = (start: number) => dispatch({ type: "showStart", start });
  const showTrack = (next: string) => dispatch({ type: "showTrack", track: next });
  const plan = { programme: programme.code, masterStart: cohort.masterStart, years, picks: state.picks, track: state.programmeTrack };
  const admissions = new Map(masters.map((m) => [m.code, admissionTo(guide, m.code, undefined, plan)] as const));
  const admission = master && admissionTo(guide, master.code, state.masterTrack, plan);
  const admissionRules =
    master && admission?.eligibility.kind === "courses"
      ? { master: master.code, clauses: admission.eligibility.clauses, names: guide.names }
      : undefined;

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
          <CourseListLink code={programme.code} listed={catalog.listedProgrammes} className="text-muted-foreground">
            {[programme.code, otherName].filter(Boolean).join(" · ")}
          </CourseListLink>
          <ChalmersLink code={programme.code} />
        </div>
        {master && (
          <p className="text-muted-foreground">
            {t.planner.mastersYears}{" "}
            <CourseListLink code={master.code} listed={catalog.listedProgrammes}>
              <span className="font-medium text-foreground">{master.name}</span> · {master.code}
            </CourseListLink>{" "}
            <ChalmersLink code={master.code} courseList={masterAccreditation?.courseList} />
          </p>
        )}
        {masterAccreditation && <Specialisations names={masterAccreditation.specialisations} className="text-sm" />}
        {admission && <AdmissionDetails check={admission} guide={guide} programmeName={programme.name} masterStart={cohort.masterStart} />}
        {master && master.prerequisites.length > 0 && (
          <Prerequisites paragraphs={master.prerequisites} className="text-sm">
            {t.planner.prerequisitesOf(master.code)}
          </Prerequisites>
        )}
      </div>

      {choosingStart ? (
        <StartChooser admitted={cohort.admitted} onChoose={showStart} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {cohort.admitted.length > 1 && (
              <FieldSelect
                aria-label={t.planner.startYear}
                value={String(cohort.start)}
                onChange={(event) => showStart(Number(event.target.value))}
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
            {tracks.length > 0 && !choosingTrack && (
              <FieldSelect
                aria-label={t.planner.trackLabel(trackKind)}
                value={track ?? NO_TRACK}
                onChange={(event) => showTrack(event.target.value)}
              >
                <NativeSelectOption value={NO_TRACK}>{t.planner.noTrack(trackKind)}</NativeSelectOption>
                {tracks
                  .filter((name) => !tracksWithoutDegree.includes(name))
                  .map((name) => (
                    <NativeSelectOption key={name} value={name}>
                      {name}
                    </NativeSelectOption>
                  ))}
                {tracksWithoutDegree.length > 0 && (
                  <NativeSelectOptGroup label={t.planner.withoutDegree}>
                    {tracksWithoutDegree.map((name) => (
                      <NativeSelectOption key={name} value={name} disabled className="text-muted-foreground">
                        {name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelectOptGroup>
                )}
              </FieldSelect>
            )}
          </div>

          {state.showsMasters && !cohort.mastersPublished && (
            <MastersNotPublished year={cohort.masterStart} shown={catalog.plans.academicYear} upcoming={cohort.upcomingMasters} />
          )}

          {choosingMaster ? (
            <MasterPicker
              programme={programme}
              masters={masters}
              accredited={state.accredited}
              admissions={admissions}
              names={guide.names}
              catalog={catalog}
              onChoose={chooseMaster}
            />
          ) : current === undefined ? (
            <p className="text-muted-foreground">{t.planner.noCourses}</p>
          ) : choosingTrack ? (
            <TrackChooser
              kind={trackKind}
              planName={current.plan.name}
              tracks={tracks}
              withoutDegree={tracksWithoutDegree}
              onChoose={showTrack}
            />
          ) : (
            <YearPlanner
              years={years}
              current={current}
              track={track}
              search={state.search}
              pickedKeys={state.pickedKeys}
              otherPicks={state.otherPicks}
              courseList={state.courseList}
              admission={admissionRules}
              catalog={catalog}
              dispatch={dispatch}
            />
          )}
        </>
      )}
    </div>
  );
}
