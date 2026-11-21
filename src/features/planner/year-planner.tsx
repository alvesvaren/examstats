import { flip, surveySortKey, type Catalog } from "@/domain/catalog";
import type { Question } from "@/domain/evaluation";
import { togglePick, UNSCHEDULED, yearView, type Lane, type PlannerRound, type PlannerSortKey } from "@/domain/planner";
import type { PlannerAction, PlannerSearch } from "@/domain/planner-state";
import type { StudyPick, StudyYear } from "@/domain/programme-plans";
import { useMessages } from "@/hooks/use-messages";
import { CandidateTable } from "./candidate-table";
import { DegreeRule, PickRule } from "./degree-marks";
import { PeriodCard } from "./period-card";

interface YearPlannerProps {
  /** Every year of study of the degree. */
  years: readonly StudyYear[];
  /** The year of study to fill. */
  current: StudyYear;
  track: string | undefined;
  search: PlannerSearch;
  /** The round keys picked in the current year. */
  pickedKeys: readonly string[];
  /** The picks of the other years of study. */
  otherPicks: readonly StudyPick[];
  /** The course list of the upcoming master's programme the year belongs to, which its new courses link to. */
  courseList: string | null;
  catalog: Catalog;
  dispatch: (action: PlannerAction) => void;
}

/**
 * A year of a programme to fill: the study periods with what every student takes already in them, and the courses
 * of one study period at a time, those every student takes locked among those to choose between.
 */
export function YearPlanner({ years, current, track, search, pickedKeys, otherPicks, courseList, catalog, dispatch }: YearPlannerProps) {
  const t = useMessages();
  const view = yearView({
    years,
    current,
    track,
    pickedKeys,
    otherPicks,
    period: search.period,
    sort: search.sort,
    dir: search.dir,
    survey: search.survey,
    stats: catalog.byCode,
    ruleNames: t.ruleNames(catalog.plans.ruleNames),
  });
  const { candidates, picked, laneCards, lane, sort, dir, survey, listed, planned, pendingCourses, pickRules, degreeRules, offered } = view;
  if (!lane) return <p className="text-muted-foreground">{t.planner.noCoursesThisYear}</p>;

  // The active column flips its order. Another column starts in its own default order.
  const sortBy = (key: PlannerSortKey) => dispatch({ type: "view", changes: { sort: key, dir: key === sort ? flip(dir) : undefined } });
  const pickSurvey = (question: Question) =>
    dispatch({
      type: "view",
      changes: { sort: surveySortKey(question), dir: undefined, survey: question === "overall" ? undefined : question },
    });
  const setPicks = (keys: string[], keepLane?: Lane) => dispatch({ type: "setPicks", keys, period: keepLane });
  // Picking keeps the list on its lane, even once that study period is full.
  const toggle = (round: PlannerRound) =>
    setPicks(
      togglePick(
        picked.map((r) => r.key),
        round,
        candidates,
      ),
      lane,
    );

  return (
    <>
      <section
        aria-label={t.planner.yourYear}
        className="z-20 -mx-4 flex flex-col gap-3 border-b bg-background px-4 pt-1 pb-3 sm:sticky sm:top-0"
      >
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {laneCards.map((card) => (
            <PeriodCard
              key={card.lane}
              {...card}
              active={card.lane === lane}
              onFocus={() => dispatch({ type: "view", changes: { period: card.lane } })}
              onRemove={toggle}
              // The courses without a study period are often many, with long names.
              className={card.lane === UNSCHEDULED ? "col-span-2" : undefined}
            />
          ))}
        </div>
        <div className="flex flex-col gap-1 text-sm">
          {pickRules.map(({ pick, marker, progress }) => (
            <PickRule key={pick.id} pick={pick} marker={marker} progress={progress} />
          ))}
          {degreeRules.map((rule) => (
            <DegreeRule key={rule.marker} rule={rule} offered={offered} />
          ))}
          <p className="flex items-center gap-3 text-muted-foreground">
            {t.planner.inYourYear(planned, pendingCourses)}
            {picked.length > 0 && (
              <button type="button" onClick={() => setPicks([])} className="underline underline-offset-2 hover:text-foreground">
                {t.planner.clearPicks}
              </button>
            )}
          </p>
        </div>
      </section>

      <CandidateTable
        lane={lane}
        listed={listed}
        courseList={courseList}
        sort={sort}
        dir={dir}
        survey={survey}
        onSort={sortBy}
        onPickSurvey={pickSurvey}
        onToggle={toggle}
      />
    </>
  );
}
