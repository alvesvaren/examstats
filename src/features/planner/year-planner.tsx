import { Link } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpRightIcon, CheckIcon, LockIcon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { PassRateCell, RatingCell } from "@/components/course-cells";
import { MetricInfo } from "@/components/metric-label";
import { Badge } from "@/components/ui/badge";
import type { Catalog } from "@/domain/catalog";
import {
  candidatesIn,
  creditsIn,
  exclusiveWith,
  firstOpenPeriod,
  lectureClash,
  PERIOD_CREDITS,
  periodsOf,
  pickProgress,
  plannerYear,
  togglePick,
  type PlannerRound,
  type PlannerSortKey,
} from "@/domain/planner";
import { rememberedPicks, withPicks } from "@/domain/planner-memory";
import { planYear, syllabusUrl, type PlanChoice, type ProgrammePlan, type StudyPeriod } from "@/domain/programme-plans";
import { usePlannerMemory } from "@/hooks/use-planner-memory";
import { formatCount, formatCredits, formatNumber, formatPeriods } from "@/lib/format";

const DEFAULT_SORT: PlannerSortKey = "rating";
/** The add button, the course, its pass rate and its rating. Phones get narrower numbers, so the name keeps its room. */
const ROW = "grid grid-cols-[2rem_minmax(0,1fr)_4rem_3rem] items-center gap-x-2 sm:grid-cols-[2rem_minmax(0,1fr)_5.5rem_4.5rem] sm:gap-x-3";

const COLUMNS = [
  { key: "passRate", label: "Pass rate" },
  { key: "rating", label: "Rating" },
] as const satisfies readonly { key: PlannerSortKey; label: string }[];

interface YearSearch {
  period?: StudyPeriod;
  sort?: PlannerSortKey;
  picked?: string[];
}

interface YearPlannerProps {
  programme: ProgrammePlan;
  year: number;
  track: string | undefined;
  search: YearSearch;
  onChange: (changes: YearSearch) => void;
  catalog: Catalog;
}

/**
 * A year of a programme to fill: the study periods with what every student takes already in them, and the courses
 * to choose between for one study period at a time.
 */
export function YearPlanner({ programme, year, track, search, onChange, catalog }: YearPlannerProps) {
  const { rounds, picks } = planYear(programme, year, { track, ruleNames: catalog.plans.ruleNames });
  const stats = new Map(catalog.courses.map((c) => [c.code, c]));
  const { fixed, candidates } = plannerYear(rounds, stats);
  const { memory, remember } = usePlannerMemory();
  // Picks in the URL are a shared plan and win. Without them, the year is as this device remembers it.
  const pickedKeys = search.picked ?? rememberedPicks(memory, programme.code, year) ?? [];
  const picked = candidates.filter((c) => pickedKeys.includes(c.key));
  const plan = [...fixed, ...picked];
  const periods = periodsOf([...fixed, ...candidates]);
  const period = periods.find((p) => p === search.period) ?? firstOpenPeriod(periods, plan);
  const sort = search.sort ?? DEFAULT_SORT;
  if (!period) return <p className="text-muted-foreground">The plan has no courses for this year.</p>;

  const listed = candidatesIn(candidates, period, sort);
  const planned = plan.reduce((sum, r) => sum + r.credits, 0);
  const inPeriod = (round: PlannerRound) => round.periods.includes(period);
  const setPicks = (keys: string[], changes: YearSearch = {}) => {
    remember((m) => ({ ...withPicks(m, programme.code, year, keys), last: { programme: programme.code, year, track } }));
    onChange({ ...changes, picked: keys.length ? keys : undefined });
  };
  // Picking keeps the list on its study period, even once that period is full.
  const toggle = (round: PlannerRound) =>
    setPicks(
      togglePick(
        picked.map((r) => r.key),
        round,
        candidates,
      ),
      { period },
    );
  const warningsOf = (round: PlannerRound) => {
    const clash = lectureClash(round, plan);
    const exclusive = exclusiveWith(round, plan);
    return [
      clash && `Same lecture times as ${clash.name}${fixed.includes(clash) ? ", which is compulsory" : ""}`,
      exclusive && `Only one of this and ${exclusive.name} counts towards the degree`,
    ].filter((warning) => typeof warning === "string");
  };

  return (
    <>
      <section aria-label="Your year" className="z-20 -mx-4 flex flex-col gap-3 border-b bg-background px-4 pt-1 pb-3 sm:sticky sm:top-0">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {periods.map((p) => (
            <PeriodCard
              key={p}
              period={p}
              fixed={fixed.filter((r) => r.periods.includes(p))}
              picked={picked.filter((r) => r.periods.includes(p))}
              active={p === period}
              onFocus={() => onChange({ period: p })}
              onRemove={toggle}
            />
          ))}
        </div>
        <div className="flex flex-col gap-1 text-sm">
          {picks.map((pick) => (
            <PickRule key={pick.id} pick={pick} picked={picked} />
          ))}
          <p className="flex items-center gap-3 text-muted-foreground">
            {formatCredits(planned)} in your year
            {picked.length > 0 && (
              <button type="button" onClick={() => setPicks([])} className="underline underline-offset-2 hover:text-foreground">
                Clear my picks
              </button>
            )}
          </p>
        </div>
      </section>

      <section>
        <div className={cn(ROW, "items-end border-b pb-2")}>
          <h2 className="col-span-2 text-xl font-semibold">
            {formatPeriods([period])}{" "}
            <span className="text-base font-normal text-muted-foreground">{formatCount(listed.length)} to choose from</span>
          </h2>
          {COLUMNS.map((column) => (
            <SortHeader key={column.key} column={column} active={column.key === sort} onSort={(key) => onChange({ sort: key })} />
          ))}
        </div>
        <ul>
          {listed.map((round) => (
            <Candidate
              key={round.key}
              round={round}
              period={period}
              picked={picked.includes(round)}
              elsewhere={picked.find((r) => r !== round && r.codes[0] === round.codes[0])}
              warnings={warningsOf(round)}
              onToggle={() => toggle(round)}
            />
          ))}
        </ul>
        {listed.length === 0 && (
          <p className="py-6 text-muted-foreground">
            {plan.some(inPeriod)
              ? "Every course in this study period is already in your year."
              : "The plan has no courses in this study period."}
          </p>
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
  const rounds = [...fixed, ...picked];
  const credits = creditsIn(rounds, period);
  const free = PERIOD_CREDITS - credits;
  const clashing = rounds.some((round) => lectureClash(round, rounds));
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border-2 p-2.5 transition-colors",
        active ? "border-primary bg-card shadow-md" : "border-transparent bg-muted/60 hover:bg-muted",
      )}
    >
      <button type="button" onClick={onFocus} aria-pressed={active} className="flex flex-col gap-1 text-left">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-lg leading-none font-semibold">{formatPeriods([period])}</span>
          <span className={cn("text-xs tabular-nums", free < 0 ? "font-semibold text-grade-u" : "text-muted-foreground")}>
            {formatNumber(credits)} of {formatCredits(PERIOD_CREDITS)}
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
        <span key={round.key} className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <LockIcon className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{round.name}</span>
          <Span round={round} />
        </span>
      ))}
      {picked.map((round) => (
        <span key={round.key} className="flex items-center gap-1.5 rounded-md bg-primary px-1.5 py-0.5 text-sm text-primary-foreground">
          <span className="truncate">{round.name}</span>
          <Span round={round} />
          <button
            type="button"
            onClick={() => onRemove(round)}
            aria-label={`Remove ${round.name}`}
            className="-mr-0.5 shrink-0 opacity-70 hover:opacity-100"
          >
            <XIcon className="size-3.5" />
          </button>
        </span>
      ))}
      {clashing && <span className="text-xs font-medium text-grade-u">Two of these share lecture times</span>}
      {free > 0 && (
        <button
          type="button"
          onClick={onFocus}
          className="rounded-md border border-dashed px-1.5 py-0.5 text-left text-sm text-muted-foreground"
        >
          Room for {formatCredits(free)}
        </button>
      )}
    </div>
  );
}

/** The study periods of a round that runs over several, so its other periods explain themselves. */
function Span({ round }: { round: PlannerRound }) {
  return <span className="ml-auto shrink-0 text-xs opacity-75">{round.periods.length > 1 && formatPeriods(round.periods)}</span>;
}

/** Marks the compulsory electives, in the list and in the rule that explains them. */
function PickMarker() {
  return <span className="inline-block size-2 shrink-0 rounded-full bg-primary" aria-hidden />;
}

/** Chalmers' own words when they say more than a label, else a sentence from the numbers. */
function pickText({ text, minCourses, minCredits }: PlanChoice) {
  if (text && !/^compulsory elective$/i.test(text)) return text;
  const amount = minCourses ? `${formatCount(minCourses)} ${minCourses === 1 ? "course" : "courses"}` : formatCredits(minCredits ?? 0);
  return `Pick at least ${amount} of the marked courses.`;
}

/** A rule that asks for some of the marked courses, and how far the picks go towards it. */
function PickRule({ pick, picked }: { pick: PlanChoice; picked: readonly PlannerRound[] }) {
  const { have, need, unit, done } = pickProgress(pick, picked);
  return (
    <p className="flex items-baseline gap-2">
      <PickMarker />
      <span>
        {pickText(pick)}{" "}
        {need !== null && (
          <span className={cn("whitespace-nowrap", done ? "font-medium text-grade-4" : "text-muted-foreground")}>
            {done && <CheckIcon className="mr-0.5 inline size-4 align-[-0.2em]" aria-hidden />}
            {formatNumber(have)} of {unit === "courses" ? formatCount(need) : formatCredits(need)} in your year
          </span>
        )}
      </span>
    </p>
  );
}

interface SortHeaderProps {
  column: (typeof COLUMNS)[number];
  active: boolean;
  onSort: (key: PlannerSortKey) => void;
}

function SortHeader({ column, active, onSort }: SortHeaderProps) {
  return (
    <div className="flex items-center justify-end gap-1 text-xs whitespace-nowrap text-muted-foreground">
      <button
        type="button"
        onClick={() => onSort(column.key)}
        aria-pressed={active}
        className={cn("inline-flex items-center gap-0.5 font-medium hover:text-foreground", active && "text-foreground")}
      >
        {column.label}
        {active && <ArrowDownIcon className="size-3" aria-hidden />}
      </button>
      <span className="hidden sm:inline-flex">
        <MetricInfo metric={column.key} name={column.label.toLowerCase()} />
      </span>
    </div>
  );
}

/** Links to the course page, or to the syllabus on chalmers.se for a course without results. A round of several courses has no one page. */
function CourseLink({ round }: { round: PlannerRound }) {
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
    <a href={syllabusUrl(code)} target="_blank" rel="noreferrer" className="hover:underline">
      {round.name}
      <ArrowUpRightIcon className="ml-0.5 inline size-3.5 align-[-0.125em] text-muted-foreground" />
    </a>
  );
}

interface CandidateProps {
  round: PlannerRound;
  /** The study period the list shows. */
  period: StudyPeriod;
  picked: boolean;
  /** The round of the same course that is in the year, when another one is. It greys this round out. */
  elsewhere: PlannerRound | undefined;
  warnings: string[];
  onToggle: () => void;
}

function Candidate({ round, period, picked, elsewhere, warnings, onToggle }: CandidateProps) {
  const { requirement, stats } = round;
  // A round over several study periods gives only part of its credits in the one listed.
  const here = round.periodCredits[round.periods.indexOf(period)] ?? 0;
  const creditsText =
    round.periods.length > 1
      ? `${formatCredits(round.credits)}, ${formatNumber(here)} in ${formatPeriods([period])}`
      : formatCredits(round.credits);
  const details = [
    round.codes.join(", "),
    creditsText,
    round.block && `block ${round.block}`,
    requirement.kind !== "elective" && requirement.kind !== "compulsoryElective" && requirement.label,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className={cn(ROW, "border-b py-2.5", picked && "bg-row-hover", elsewhere && "text-muted-foreground")}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={picked}
        aria-label={picked ? `Remove ${round.name} from your year` : `Add ${round.name} to your year`}
        className={cn(
          "grid size-8 place-items-center rounded-full border-2",
          picked ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary",
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
          {round.periods.length > 1 && <Badge variant="outline">Runs {formatPeriods(round.periods)}</Badge>}
        </span>
        <span className="text-xs text-muted-foreground">{details}</span>
        {warnings.map((warning) => (
          <span key={warning} className="text-xs font-medium text-grade-u">
            {warning}
          </span>
        ))}
        {elsewhere && (
          <span className="text-xs text-muted-foreground">
            In your year in {formatPeriods(elsewhere.periods)}. Adding it here moves it.
          </span>
        )}
      </div>
      {stats ? (
        <>
          <PassRateCell grades={stats.recentGrades} muted={Boolean(elsewhere)} />
          <RatingCell answers={stats.overallAnswers} muted={Boolean(elsewhere)} />
        </>
      ) : (
        <span className="col-span-2 text-right text-xs text-muted-foreground">No results yet</span>
      )}
    </li>
  );
}
