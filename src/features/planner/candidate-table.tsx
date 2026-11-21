import { Link } from "@tanstack/react-router";
import { ArrowUpRightIcon, CheckIcon, LockIcon, PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";
import { PassRateCell, SurveyCell } from "@/components/course-cells";
import { MetricInfo } from "@/components/metric-label";
import { SortHeader } from "@/components/sort-header";
import { SurveyColumnPicker } from "@/components/survey-column";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { surveySortKey, type SortDir } from "@/domain/catalog";
import type { Question } from "@/domain/evaluation";
import { UNSCHEDULED, type Lane, type ListedRound, type PlannerRound, type PlannerSortKey, type RoundWarning } from "@/domain/planner";
import { useMessages } from "@/hooks/use-messages";
import type { Messages } from "@/lib/i18n/en";
import { RoundMarks } from "./degree-marks";
import { laneLabel } from "./lane-label";

/** Sort headers sit right-aligned over their numbers. */
const HEADER = "justify-end text-xs text-muted-foreground";
/** The add button, the course, its pass rate and a course survey question. Phones get narrower numbers, so the name keeps its room. */
const ROW = "grid grid-cols-[2rem_minmax(0,1fr)_4rem_6rem] items-center gap-x-2 sm:grid-cols-[2rem_minmax(0,1fr)_5.5rem_6.5rem] sm:gap-x-3";

interface CandidateTableProps {
  /** The lane the list shows. */
  lane: Lane;
  listed: ListedRound[];
  /** The course list of an upcoming master's programme, which the courses only it names link to. */
  courseList: string | null;
  sort: PlannerSortKey;
  dir: SortDir;
  /** The course survey question the list shows. */
  survey: Question;
  onSort: (key: PlannerSortKey) => void;
  onPickSurvey: (question: Question) => void;
  onToggle: (round: PlannerRound) => void;
}

/**
 * The courses of one lane, sortable by pass rate and by a course survey question: those to choose between, and those
 * every student takes, locked.
 */
export function CandidateTable({ lane, listed, courseList, sort, dir, survey, onSort, onPickSurvey, onToggle }: CandidateTableProps) {
  const t = useMessages();
  const toChoose = listed.filter((l) => !l.fixed).length;
  return (
    <section>
      <div className={cn(ROW, "items-end border-b pb-2")}>
        <h2 className="col-span-2 text-xl font-semibold">
          {laneLabel(lane, t)} <span className="text-base font-normal text-muted-foreground">{t.planner.toChooseFrom(toChoose)}</span>
        </h2>
        <SortHeader sortKey="passRate" label={t.list.columns.passRate} sort={sort} dir={dir} onSort={onSort} className={HEADER}>
          <span className="hidden sm:inline-flex">
            <MetricInfo metric="passRate" name={t.list.columns.passRate.toLowerCase()} />
          </span>
        </SortHeader>
        <SortHeader
          sortKey={surveySortKey(survey)}
          label={t.survey.questions[survey].short}
          sort={sort}
          dir={dir}
          onSort={onSort}
          className={HEADER}
        >
          <SurveyColumnPicker question={survey} onPick={onPickSurvey} />
        </SortHeader>
      </div>
      <ul>
        {listed.map((listedRound) => (
          <Candidate
            key={listedRound.round.key}
            {...listedRound}
            survey={survey}
            lane={lane}
            courseList={courseList}
            onToggle={() => onToggle(listedRound.round)}
          />
        ))}
      </ul>
      {toChoose === 0 && (
        <p className="py-6 text-muted-foreground">{listed.length > 0 ? t.planner.allInYear : t.planner.noCoursesInPeriod}</p>
      )}
    </section>
  );
}

/** The warning in words. */
const warningText = (warning: RoundWarning, t: Messages) =>
  warning.kind === "sameLectures" ? t.planner.sameLectures(warning.name, warning.fixed) : t.planner.exclusive(warning.name);

/** Opens in a new tab, with an arrow that says so. */
function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="hover:underline">
      {children}
      <ArrowUpRightIcon className="ml-0.5 inline size-3.5 align-[-0.125em] text-muted-foreground" />
    </a>
  );
}

/**
 * Links to the course page, or to the syllabus on chalmers.se for a course without results. A course only an upcoming
 * master's programme's course list names has no syllabus yet, so it links to that list. A round of several courses
 * has no one page.
 */
function CourseLink({ round, courseList }: { round: PlannerRound; courseList: string | null }) {
  const t = useMessages();
  const [code, ...others] = round.codes;
  if (round.pending) return courseList ? <ExternalLink href={courseList}>{round.name}</ExternalLink> : <>{round.name}</>;
  if (!code || others.length > 0) return <>{round.name}</>;
  if (round.stats) {
    return (
      <Link to="/course/$code" params={{ code }} className="hover:underline">
        {round.name}
      </Link>
    );
  }
  return <ExternalLink href={t.chalmers.syllabus(code)}>{round.name}</ExternalLink>;
}

/** Says that every student takes the round, in place of the button that adds a course to the year. */
function Locked({ name }: { name: string }) {
  const t = useMessages();
  const label = t.planner.inProgrammePlan(name);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="img" aria-label={label} className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground">
          <LockIcon className="size-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

interface CandidateProps extends ListedRound {
  /** The course survey question the list shows. */
  survey: Question;
  /** The lane the list shows. */
  lane: Lane;
  courseList: string | null;
  onToggle: () => void;
}

function Candidate({ round, survey, lane, courseList, fixed, picked, elsewhere, warnings, picks, marks, onToggle }: CandidateProps) {
  const t = useMessages();
  const { requirement, stats } = round;
  const inOtherYear = Boolean(elsewhere?.year);
  // A round over several study periods gives only part of its credits in the one listed.
  const creditsText = round.pending
    ? t.planner.creditsNotKnown
    : lane !== UNSCHEDULED && round.periods.length > 1
      ? t.planner.creditsIn(round.credits, round.periodCredits[round.periods.indexOf(lane)] ?? 0, t.periods([lane]))
      : t.credits(round.credits);
  const details = [
    // A course only a course list names has a made-up code.
    !round.pending && round.codes.join(", "),
    creditsText,
    round.block && t.planner.block(round.block),
    round.seats && t.planner.seats(round.seats),
    requirement.kind !== "elective" && requirement.kind !== "compulsoryElective" && t.requirement(requirement),
    round.preliminary && t.planner.preliminary,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className={cn(ROW, "border-b py-2.5", (picked || fixed) && "bg-row-hover", elsewhere && "text-muted-foreground")}>
      {fixed ? (
        <Locked name={round.name} />
      ) : (
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
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={cn("line-clamp-2", !elsewhere && "font-medium")}>
            <CourseLink round={round} courseList={courseList} />
          </span>
          <RoundMarks picks={picks} marks={marks} />
          {round.periods.length > 1 && <Badge variant="outline">{t.planner.runs(t.periods(round.periods))}</Badge>}
        </span>
        <span className="text-xs text-muted-foreground">{details}</span>
        {warnings.map((warning) => {
          const text = warningText(warning, t);
          return (
            <span key={text} className="text-xs font-medium text-grade-u">
              {text}
            </span>
          );
        })}
        {elsewhere && (
          <span className="text-xs text-muted-foreground">
            {elsewhere.year
              ? t.planner.elsewhereInYear(elsewhere.year, elsewhere.periods)
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
        <span className="col-span-2 text-right text-xs text-muted-foreground">{round.pending ? t.newCourse : t.noResultsYet}</span>
      )}
    </li>
  );
}
