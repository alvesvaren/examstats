import { flip, surveySortKey, type Catalog } from "@/domain/catalog";
import type { Question } from "@/domain/evaluation";
import { requirementKey } from "@/domain/degree";
import { togglePick, yearView, type PlannerRound, type PlannerSortKey } from "@/domain/planner";
import type { PlanState, PlannerAction } from "@/domain/planner-state";
import type { StudyPeriod, StudyYear } from "@/domain/programme-plans";
import { useMessages } from "@/hooks/use-messages";
import { CandidateTable } from "./candidate-table";
import { DegreeRule, PickRule } from "./degree-marks";
import { PeriodCard } from "./period-card";

interface YearPlannerProps {
  state: PlanState;
  /** The year of study to fill. It is the state's current year. */
  current: StudyYear;
  catalog: Catalog;
  dispatch: (action: PlannerAction) => void;
}

/**
 * A year of a programme to fill: the study periods with what every student takes already in them, and the courses
 * to choose between for one study period at a time.
 */
export function YearPlanner({ state, current, catalog, dispatch }: YearPlannerProps) {
  const t = useMessages();
  const { years, track, search, pickedKeys, otherPicks } = state;
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
  const { candidates, picked, plan, periodCards, period, sort, dir, survey, listed, planned, pickRules, degreeRules, offered } = view;
  if (!period) return <p className="text-muted-foreground">{t.planner.noCoursesThisYear}</p>;

  // The active column flips its order. Another column starts in its own default order.
  const sortBy = (key: PlannerSortKey) => dispatch({ type: "view", changes: { sort: key, dir: key === sort ? flip(dir) : undefined } });
  const pickSurvey = (question: Question) =>
    dispatch({
      type: "view",
      changes: { sort: surveySortKey(question), dir: undefined, survey: question === "overall" ? undefined : question },
    });
  const inPeriod = (round: PlannerRound) => round.periods.includes(period);
  const setPicks = (keys: string[], keepPeriod?: StudyPeriod) => dispatch({ type: "setPicks", keys, period: keepPeriod });
  // Picking keeps the list on its study period, even once that period is full.
  const toggle = (round: PlannerRound) =>
    setPicks(
      togglePick(
        picked.map((r) => r.key),
        round,
        candidates,
      ),
      period,
    );

  return (
    <>
      <section
        aria-label={t.planner.yourYear}
        className="z-20 -mx-4 flex flex-col gap-3 border-b bg-background px-4 pt-1 pb-3 sm:sticky sm:top-0"
      >
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {periodCards.map((card) => (
            <PeriodCard
              key={card.period}
              {...card}
              active={card.period === period}
              onFocus={() => dispatch({ type: "view", changes: { period: card.period } })}
              onRemove={toggle}
            />
          ))}
        </div>
        <div className="flex flex-col gap-1 text-sm">
          {pickRules.map(({ pick, progress }) => (
            <PickRule key={pick.id} progress={progress} pick={pick} />
          ))}
          {degreeRules.map((rule) => (
            <DegreeRule key={requirementKey(rule.requirement)} rule={rule} offered={offered} />
          ))}
          <p className="flex items-center gap-3 text-muted-foreground">
            {t.planner.inYourYear(planned)}
            {picked.length > 0 && (
              <button type="button" onClick={() => setPicks([])} className="underline underline-offset-2 hover:text-foreground">
                {t.planner.clearPicks}
              </button>
            )}
          </p>
        </div>
      </section>

      <CandidateTable
        period={period}
        listed={listed}
        planInPeriod={plan.some(inPeriod)}
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
