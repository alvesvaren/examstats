import { Link } from "@tanstack/react-router";
import { ArrowUpRightIcon, CheckIcon, PlusIcon } from "lucide-react";
import { cn } from "cn";
import { PassRateCell, SurveyCell } from "@/components/course-cells";
import { MetricInfo } from "@/components/metric-label";
import { SortHeader } from "@/components/sort-header";
import { SurveyColumnPicker } from "@/components/survey-column";
import { Badge } from "@/components/ui/badge";
import { surveySortKey, type SortDir } from "@/domain/catalog";
import type { Question } from "@/domain/evaluation";
import { requirementKey, type DegreeRuleMark } from "@/domain/degree";
import { type ListedRound, type PlanElsewhere, type PlannerRound, type PlannerSortKey, type RoundWarning } from "@/domain/planner";
import type { StudyPeriod } from "@/domain/programme-plans";
import { useMessages } from "@/hooks/use-messages";
import type { Messages } from "@/lib/i18n/en";
import { DegreeMark, PickMarker } from "./degree-marks";

/** Sort headers sit right-aligned over their numbers. */
const HEADER = "justify-end text-xs text-muted-foreground";
/** The add button, the course, its pass rate and a course survey question. Phones get narrower numbers, so the name keeps its room. */
const ROW = "grid grid-cols-[2rem_minmax(0,1fr)_4rem_6rem] items-center gap-x-2 sm:grid-cols-[2rem_minmax(0,1fr)_5.5rem_6.5rem] sm:gap-x-3";

interface CandidateTableProps {
  /** The study period the list shows. */
  period: StudyPeriod;
  listed: ListedRound[];
  /** Whether the plan already has a course in the study period. */
  planInPeriod: boolean;
  sort: PlannerSortKey;
  dir: SortDir;
  /** The course survey question the list shows. */
  survey: Question;
  onSort: (key: PlannerSortKey) => void;
  onPickSurvey: (question: Question) => void;
  onToggle: (round: PlannerRound) => void;
}

/** The courses to choose between in one study period, sortable by pass rate and by a course survey question. */
export function CandidateTable({ period, listed, planInPeriod, sort, dir, survey, onSort, onPickSurvey, onToggle }: CandidateTableProps) {
  const t = useMessages();
  return (
    <section>
      <div className={cn(ROW, "items-end border-b pb-2")}>
        <h2 className="col-span-2 text-xl font-semibold">
          {t.periods([period])} <span className="text-base font-normal text-muted-foreground">{t.planner.toChooseFrom(listed.length)}</span>
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
        {listed.map(({ round, picked, elsewhere, warnings, marks }) => (
          <Candidate
            key={round.key}
            round={round}
            survey={survey}
            period={period}
            picked={picked}
            elsewhere={elsewhere}
            warnings={warnings}
            marks={marks}
            onToggle={() => onToggle(round)}
          />
        ))}
      </ul>
      {listed.length === 0 && (
        <p className="py-6 text-muted-foreground">{planInPeriod ? t.planner.allInYear : t.planner.noCoursesInPeriod}</p>
      )}
    </section>
  );
}

/** The warning in words. */
const warningText = (warning: RoundWarning, t: Messages) =>
  warning.kind === "sameLectures" ? t.planner.sameLectures(warning.name, warning.fixed) : t.planner.exclusive(warning.name);

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
  warnings: RoundWarning[];
  /** What the course gives towards the degree requirements the student has to choose courses for. */
  marks: DegreeRuleMark[];
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
