import { Link } from "@tanstack/react-router";
import { ArrowUpRightIcon, CheckIcon, LockIcon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { PassRateCell, SurveyCell } from "@/components/course-cells";
import { MetricInfo } from "@/components/metric-label";
import { SortHeader } from "@/components/sort-header";
import { SurveyColumnPicker } from "@/components/survey-column";
import { Badge } from "@/components/ui/badge";
import { amountTowards, openRequirements, pickProgress, requirementProgress } from "@/domain/degree";
import { defaultSortDir, flip, surveyColumn, surveySortKey, type Catalog } from "@/domain/catalog";
import {
  candidatesIn,
  creditsIn,
  exclusiveWith,
  findElsewhere,
  firstOpenPeriod,
  lectureClash,
  PERIOD_CREDITS,
  periodsOf,
  plannerYear,
  togglePick,
  type PlanElsewhere,
  type PlannerRound,
  type PlannerSortKey,
} from "@/domain/planner";
import type { PlanState, PlannerAction } from "@/domain/planner-state";
import {
  plannedCourses,
  planYear,
  type PlanChoice,
  type PlanRequirement,
  type StudyPeriod,
  type StudyYear,
} from "@/domain/programme-plans";
import type { Question } from "@/domain/evaluation";
import { useMessages } from "@/hooks/use-messages";
import type { Messages } from "@/lib/i18n/en";

/** Sort headers sit right-aligned over their numbers. */
const HEADER = "justify-end text-xs text-muted-foreground";
const DEFAULT_SORT: PlannerSortKey = "rating";
/** The add button, the course, its pass rate and a course survey question. Phones get narrower numbers, so the name keeps its room. */
const ROW = "grid grid-cols-[2rem_minmax(0,1fr)_4rem_6rem] items-center gap-x-2 sm:grid-cols-[2rem_minmax(0,1fr)_5.5rem_6.5rem] sm:gap-x-3";

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
  const { years, track, search, pickedKeys, otherPicks: other } = state;
  // The programme whose plan holds this year: the master's programme in years 4 and 5.
  const t = useMessages();
  const { plan: yearProgramme, year } = current;
  const { rounds, picks } = planYear(yearProgramme, year, { track, ruleNames: t.ruleNames(catalog.plans.ruleNames) });
  const stats = new Map(catalog.courses.map((c) => [c.code, c]));
  const { fixed, candidates } = plannerYear(rounds, stats);
  const picked = candidates.filter((c) => pickedKeys.includes(c.key));
  const plan = [...fixed, ...picked];
  const periods = periodsOf([...fixed, ...candidates]);
  const period = periods.find((p) => p === search.period) ?? firstOpenPeriod(periods, plan);
  const sort = search.sort ?? DEFAULT_SORT;
  if (!period) return <p className="text-muted-foreground">{t.planner.noCoursesThisYear}</p>;

  const dir = search.dir ?? defaultSortDir(sort);
  const listed = candidatesIn(candidates, period, sort, dir);
  const survey = surveyColumn(sort, search.survey);
  // The active column flips its order. Another column starts in its own default order.
  const sortBy = (key: PlannerSortKey) => dispatch({ type: "view", changes: { sort: key, dir: key === sort ? flip(dir) : undefined } });
  const pickSurvey = (question: Question) =>
    dispatch({
      type: "view",
      changes: { sort: surveySortKey(question), dir: undefined, survey: question === "overall" ? undefined : question },
    });
  const planned = plan.reduce((sum, r) => sum + r.credits, 0);
  // Degree requirements count the whole degree: the compulsory courses and the picks of every year of every plan.
  const plans = [...new Set(years.map((y) => y.plan))];
  const allPicks = [...other, ...picked.map((r) => ({ programme: yearProgramme.code, year, key: r.key }))];
  const courses = plannedCourses(plans, allPicks, track);
  const degreeRules = openRequirements(plans, track).map((requirement) => ({
    requirement,
    ...requirementProgress(requirement, courses),
  }));
  const offered = new Set(plans.flatMap((p) => p.years.flatMap((y) => y.courses.map((c) => c.code))));
  const marksOf = (round: PlannerRound) =>
    degreeRules.flatMap((rule) => {
      const amount = Math.max(...round.codes.map((code) => amountTowards(rule.requirement, { code, themes: round.themes })));
      return amount > 0 ? { ...rule, amount } : [];
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
  const warningsOf = (round: PlannerRound) => {
    const clash = lectureClash(round, plan);
    const exclusive = exclusiveWith(round, plan);
    return [clash && t.planner.sameLectures(clash.name, fixed.includes(clash)), exclusive && t.planner.exclusive(exclusive.name)].filter(
      (warning) => typeof warning === "string",
    );
  };

  return (
    <>
      <section
        aria-label={t.planner.yourYear}
        className="z-20 -mx-4 flex flex-col gap-3 border-b bg-background px-4 pt-1 pb-3 sm:sticky sm:top-0"
      >
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {periods.map((p) => (
            <PeriodCard
              key={p}
              period={p}
              fixed={fixed.filter((r) => r.periods.includes(p))}
              picked={picked.filter((r) => r.periods.includes(p))}
              active={p === period}
              onFocus={() => dispatch({ type: "view", changes: { period: p } })}
              onRemove={toggle}
            />
          ))}
        </div>
        <div className="flex flex-col gap-1 text-sm">
          {picks.map((pick) => (
            <PickRule key={pick.id} progress={pickProgress(pick, yearProgramme, courses)} pick={pick} />
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

      <section>
        <div className={cn(ROW, "items-end border-b pb-2")}>
          <h2 className="col-span-2 text-xl font-semibold">
            {t.periods([period])}{" "}
            <span className="text-base font-normal text-muted-foreground">{t.planner.toChooseFrom(listed.length)}</span>
          </h2>
          <SortHeader sortKey="passRate" label={t.list.columns.passRate} sort={sort} dir={dir} onSort={sortBy} className={HEADER}>
            <span className="hidden sm:inline-flex">
              <MetricInfo metric="passRate" name={t.list.columns.passRate.toLowerCase()} />
            </span>
          </SortHeader>
          <SortHeader
            sortKey={surveySortKey(survey)}
            label={t.survey.questions[survey].short}
            sort={sort}
            dir={dir}
            onSort={sortBy}
            className={HEADER}
          >
            <SurveyColumnPicker question={survey} onPick={pickSurvey} />
          </SortHeader>
        </div>
        <ul>
          {listed.map((round) => (
            <Candidate
              key={round.key}
              round={round}
              survey={survey}
              period={period}
              picked={picked.includes(round)}
              elsewhere={findElsewhere(round, picked, other)}
              warnings={warningsOf(round)}
              marks={marksOf(round)}
              onToggle={() => toggle(round)}
            />
          ))}
        </ul>
        {listed.length === 0 && (
          <p className="py-6 text-muted-foreground">{plan.some(inPeriod) ? t.planner.allInYear : t.planner.noCoursesInPeriod}</p>
        )}
      </section>
    </>
  );
}

interface PeriodCardProps {
  period: StudyPeriod;
  /** Rounds in this study period that every student takes. */
  fixed: PlannerRound[];
  picked: PlannerRound[];
  active: boolean;
  onFocus: () => void;
  onRemove: (round: PlannerRound) => void;
}

/** A study period of the year with what is in it, how full it is, and whether two of its courses meet. */
function PeriodCard({ period, fixed, picked, active, onFocus, onRemove }: PeriodCardProps) {
  const t = useMessages();
  const rounds = [...fixed, ...picked];
  const credits = creditsIn(rounds, period);
  const free = PERIOD_CREDITS - credits;
  const pace = credits > PERIOD_CREDITS ? ` (${t.format.percent(credits / PERIOD_CREDITS)})` : "";
  const fill = `${t.of(t.format.number(credits), t.credits(PERIOD_CREDITS))}${pace}`;
  const clashing = rounds.some((round) => lectureClash(round, rounds));
  return (
    <div
      className={cn(
        "relative flex flex-col gap-1.5 rounded-xl border-2 p-2.5 transition-colors",
        active ? "border-primary bg-card shadow-md" : "border-transparent bg-muted/60 hover:bg-muted",
      )}
    >
      <button
        type="button"
        onClick={onFocus}
        aria-pressed={active}
        aria-label={`${t.periods([period])}, ${fill}`}
        className="flex flex-col gap-1 text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-lg leading-none font-semibold">{t.periods([period])}</span>
          <span className={cn("text-right text-xs tabular-nums", free < 0 ? "font-semibold text-grade-u" : "text-muted-foreground")}>
            {fill}
          </span>
        </span>
        <span className="h-1.5 overflow-hidden rounded-full bg-border">
          <span
            className={cn("block h-full rounded-full", free < 0 ? "bg-grade-u" : "bg-primary")}
            style={{ width: `${Math.min(1, credits / PERIOD_CREDITS) * 100}%` }}
          />
        </span>
      </button>
      {fixed.map((round) => (
        <span key={round.key} className="pointer-events-none flex items-center gap-1.5 text-sm text-muted-foreground">
          <LockIcon className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{round.name}</span>
          <Span round={round} />
        </span>
      ))}
      {picked.map((round) => (
        <span
          key={round.key}
          className="pointer-events-none flex items-center gap-1.5 rounded-md bg-primary px-1.5 py-0.5 text-sm text-primary-foreground"
        >
          <span className="truncate">{round.name}</span>
          <Span round={round} />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(round);
            }}
            aria-label={t.planner.remove(round.name)}
            className="pointer-events-auto relative z-10 -mr-0.5 shrink-0 opacity-70 hover:opacity-100"
          >
            <XIcon className="size-3.5" />
          </button>
        </span>
      ))}
      {clashing && <span className="pointer-events-none text-xs font-medium text-grade-u">{t.planner.shareLectures}</span>}
      {free > 0 && (
        <span className="pointer-events-none rounded-md border border-dashed px-1.5 py-0.5 text-left text-sm text-muted-foreground">
          {t.planner.roomFor(free)}
        </span>
      )}
    </div>
  );
}

/** The study periods of a round that runs over several, so its other periods explain themselves. */
function Span({ round }: { round: PlannerRound }) {
  const t = useMessages();
  return <span className="ml-auto shrink-0 text-xs opacity-75">{round.periods.length > 1 && t.periods(round.periods)}</span>;
}

/** Marks the compulsory electives, in the list and in the rule that explains them. */
function PickMarker() {
  return <span className="inline-block size-2 shrink-0 rounded-full bg-primary" aria-hidden />;
}

/** Chalmers' own words when they say more than a label, else a sentence from the numbers, if there are any. */
function pickText({ text, minCourses, minCredits }: PlanChoice, t: Messages) {
  if (text && !/^compulsory elective$/i.test(text)) return text;
  if (minCourses) return t.planner.pickAtLeast(t.courses(minCourses));
  if (minCredits) return t.planner.pickAtLeast(t.credits(minCredits));
  return t.planner.pickSome;
}

/** "3 of 2 courses" or "7.5 of 15 credits". */
const progressText = ({ have, need, unit }: { have: number; need: number; unit: "courses" | "credits" }, t: Messages) =>
  t.of(t.format.number(have), unit === "courses" ? t.format.count(need) : t.credits(need));

/** A rule that asks for some of the marked courses, and how far the courses of every year go towards it. */
function PickRule({ pick, progress }: { pick: PlanChoice; progress: ReturnType<typeof pickProgress> }) {
  const t = useMessages();
  const { have, need, unit, done } = progress;
  return (
    <p className="flex items-baseline gap-2">
      <PickMarker />
      <span>
        {pickText(pick, t)}{" "}
        {need !== null && (
          <span className={cn("whitespace-nowrap", done ? "font-medium text-grade-4" : "text-muted-foreground")}>
            {done && <CheckIcon className="mr-0.5 inline size-4 align-[-0.2em]" aria-hidden />}
            {progressText({ have, need, unit }, t)}
          </span>
        )}
      </span>
    </p>
  );
}

/** A degree requirement the student has to choose courses for, with how far the whole plan goes towards it. */
interface DegreeRuleProgress extends ReturnType<typeof requirementProgress> {
  requirement: PlanRequirement;
}

const requirementKey = (requirement: PlanRequirement) => (requirement.kind === "theme" ? requirement.theme : requirement.courses.join());

/** Marks the courses of a list the degree needs some of. Faded once the plan has enough of them. */
function ListMarker({ done }: { done: boolean }) {
  return <span className={cn("inline-block size-2 shrink-0 rotate-45 bg-primary", done && "opacity-40")} aria-hidden />;
}

/** What a degree requirement asks for, in short. A list of one course names it, and says so when no year of the plan has it. */
function requirementText(requirement: PlanRequirement, offered: ReadonlySet<string>, t: Messages) {
  if (requirement.kind === "theme") return t.planner.themeCredits;
  const [code, ...others] = requirement.courses;
  if (code && others.length === 0) return t.planner.courseForDegree(code, offered.has(code));
  return t.planner.someOfMarked(requirement.minCourses);
}

/** A requirement of the whole degree, and how far the compulsory courses and the picks of every year go towards it. */
function DegreeRule({ rule, offered }: { rule: DegreeRuleProgress; offered: ReadonlySet<string> }) {
  const t = useMessages();
  const { requirement, have, need, unit, done } = rule;
  return (
    <p className="flex items-baseline gap-2">
      {requirement.kind === "theme" ? (
        <Badge variant="outline" title={t.planner.themes[requirement.theme].name} className={cn(done && "opacity-50")}>
          {t.planner.themes[requirement.theme].short}
        </Badge>
      ) : (
        <ListMarker done={done} />
      )}
      <span>
        {requirementText(requirement, offered, t)}{" "}
        <span className={cn("whitespace-nowrap", done ? "font-medium text-grade-4" : "text-muted-foreground")}>
          {done && <CheckIcon className="mr-0.5 inline size-4 align-[-0.2em]" aria-hidden />}
          {progressText({ have, need, unit }, t)}
        </span>
      </span>
    </p>
  );
}

/** What a course gives towards a degree requirement. Faded once the plan meets the requirement. */
function DegreeMark({ mark }: { mark: DegreeRuleProgress & { amount: number } }) {
  const t = useMessages();
  const { requirement, done, amount } = mark;
  if (requirement.kind === "courses") {
    return (
      <span className="inline-flex items-center">
        <ListMarker done={done} />
        <span className="sr-only">{t.planner.oneOfDegree}</span>
      </span>
    );
  }
  return (
    <Badge variant="outline" title={t.planner.themes[requirement.theme].name} className={cn(done && "opacity-50")}>
      {t.planner.themes[requirement.theme].short} {t.credits(amount)}
    </Badge>
  );
}

/** Links to the course page, or to the syllabus on chalmers.se for a course without results. A round of several courses has no one page. */
function CourseLink({ round }: { round: PlannerRound }) {
  const t = useMessages();
  const [code, ...others] = round.codes;
  if (!code || others.length > 0) return <>{round.name}</>;
  if (round.stats) {
    return (
      <Link to="/course/$code" params={{ code }} className="hover:underline">
        {round.name}
      </Link>
    );
  }
  return (
    <a href={t.chalmers.syllabus(code)} target="_blank" rel="noreferrer" className="hover:underline">
      {round.name}
      <ArrowUpRightIcon className="ml-0.5 inline size-3.5 align-[-0.125em] text-muted-foreground" />
    </a>
  );
}

interface CandidateProps {
  round: PlannerRound;
  /** The course survey question the list shows. */
  survey: Question;
  /** The study period the list shows. */
  period: StudyPeriod;
  picked: boolean;
  /** Where another round of the same course is in the plan. It greys this round out. */
  elsewhere: PlanElsewhere | undefined;
  warnings: string[];
  /** What the course gives towards the degree requirements the student has to choose courses for. */
  marks: (DegreeRuleProgress & { amount: number })[];
  onToggle: () => void;
}

function Candidate({ round, survey, period, picked, elsewhere, warnings, marks, onToggle }: CandidateProps) {
  const t = useMessages();
  const { requirement, stats } = round;
  const inOtherYear = Boolean(elsewhere?.year);
  // A round over several study periods gives only part of its credits in the one listed.
  const here = round.periodCredits[round.periods.indexOf(period)] ?? 0;
  const creditsText = round.periods.length > 1 ? t.planner.creditsIn(round.credits, here, t.periods([period])) : t.credits(round.credits);
  const details = [
    round.codes.join(", "),
    creditsText,
    round.block && t.planner.block(round.block),
    round.seats && t.planner.seats(round.seats),
    requirement.kind !== "elective" && requirement.kind !== "compulsoryElective" && t.requirement(requirement),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className={cn(ROW, "border-b py-2.5", picked && "bg-row-hover", elsewhere && "text-muted-foreground")}>
      <button
        type="button"
        onClick={onToggle}
        disabled={inOtherYear}
        aria-pressed={picked}
        aria-label={
          elsewhere?.year
            ? t.planner.inOtherYear(round.name, elsewhere.year)
            : picked
              ? t.planner.removeFromYear(round.name)
              : t.planner.addToYear(round.name)
        }
        className={cn(
          "grid size-8 place-items-center rounded-full border-2",
          picked ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary",
          inOtherYear && "cursor-not-allowed opacity-40 hover:border-border",
        )}
      >
        {picked ? <CheckIcon className="size-4" /> : <PlusIcon className="size-4" />}
      </button>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={cn("line-clamp-2", !elsewhere && "font-medium")}>
            {requirement.kind === "compulsoryElective" && (
              <span className="mr-1.5 inline-flex align-middle">
                <PickMarker />
              </span>
            )}
            <CourseLink round={round} />
          </span>
          {round.periods.length > 1 && <Badge variant="outline">{t.planner.runs(t.periods(round.periods))}</Badge>}
          {marks.map((mark) => (
            <DegreeMark key={requirementKey(mark.requirement)} mark={mark} />
          ))}
        </span>
        <span className="text-xs text-muted-foreground">{details}</span>
        {warnings.map((warning) => (
          <span key={warning} className="text-xs font-medium text-grade-u">
            {warning}
          </span>
        ))}
        {elsewhere && (
          <span className="text-xs text-muted-foreground">
            {elsewhere.year
              ? t.planner.elsewhereInYear(elsewhere.year, t.periods(elsewhere.periods))
              : t.planner.elsewhereInThisYear(t.periods(elsewhere.periods))}
          </span>
        )}
      </div>
      {stats ? (
        <>
          <PassRateCell grades={stats.recentGrades} muted={Boolean(elsewhere)} />
          <SurveyCell question={survey} answers={stats.surveyAnswers[survey]} muted={Boolean(elsewhere)} />
        </>
      ) : (
        <span className="col-span-2 text-right text-xs text-muted-foreground">{t.noResultsYet}</span>
      )}
    </li>
  );
}
