import { ChevronRightIcon, ExternalLinkIcon } from "lucide-react";
import { cn } from "cn";
import { DistributionCell } from "@/components/course-cells";
import { DistributionMark } from "@/components/marks";
import { MetricLabel } from "@/components/metric-label";
import {
  ANSWER_SCALE,
  BALANCED_WORKLOAD,
  EVALUATION_YEARS,
  answerFrequencies,
  pooledAnswerCounts,
  questionMean,
  summarizeEvaluations,
  type EvaluationRound,
  type Question,
} from "@/domain/evaluation";
import { formatAcademicYear, formatCount, formatDay, formatNumber, formatScore } from "@/lib/format";
import { SectionTitle } from "./course-sections";

const SURVEYS_URL = "https://www.chalmers.se/en/education/your-studies/plan-and-conduct-your-studies/course-evaluation/";

/** The rest of the standard questions, in the order the breakdown lists them. The rating is the overall question. */
const BREAKDOWN: readonly { question: Exclude<Question, "overall">; label: string }[] = [
  { question: "teaching", label: "Teaching" },
  { question: "structure", label: "Course structure" },
  { question: "literature", label: "Course material" },
  { question: "assessment", label: "Assessment" },
  { question: "administration", label: "Administration" },
  { question: "learningOutcomes", label: "Clear learning outcomes" },
  { question: "prerequisites", label: "Enough prior knowledge" },
];

const QUESTION_GRID = "grid grid-cols-[minmax(0,1fr)_2rem_5rem] items-center gap-x-3";

const periodsLabel = (periods: string | null) => periods?.replace("-", "–") ?? "";
const sumOf = (rounds: readonly EvaluationRound[], key: "answers" | "respondents") => rounds.reduce((sum, r) => sum + r[key], 0);

/** Names a round within a course, such as "2025-LP3". Picked rounds go by it in the URL. */
const roundKey = ({ academicYear, periods }: EvaluationRound) => (periods ? `${academicYear}-${periods}` : String(academicYear));
const ALL_ROUNDS = "all";

interface CourseSurveyProps {
  /** Newest first. */
  rounds: readonly EvaluationRound[];
  /** The key of the picked round, or all of them. The newest round when missing or unknown. */
  selected: string | undefined;
  onSelect: (key: string) => void;
  fetchedAt: string;
}

/** What students answered in Chalmers course surveys: each round, and the rating and standard questions for the picked one. */
export function CourseSurvey({ rounds, selected, onSelect, fetchedAt }: CourseSurveyProps) {
  const picked = selected === ALL_ROUNDS ? rounds : rounds.filter((r) => roundKey(r) === selected);
  const shown = picked.length ? picked : rounds.slice(0, 1);

  return (
    <section>
      <SectionTitle>
        <MetricLabel metric="rating">Course survey</MetricLabel>
      </SectionTitle>
      {!shown.length ? (
        <>
          <p className="text-sm text-muted-foreground">No course surveys in the last {EVALUATION_YEARS} academic years.</p>
          <SurveySource fetchedAt={fetchedAt} />
        </>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 md:gap-10">
          <SurveyRounds rounds={rounds} shown={shown} onSelect={onSelect} fetchedAt={fetchedAt} />
          <SurveySummary rounds={shown} />
        </div>
      )}
    </section>
  );
}

function SurveySource({ fetchedAt }: { fetchedAt: string }) {
  return (
    <p className="mt-3 text-xs text-muted-foreground">
      From{" "}
      <a href={SURVEYS_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">
        Chalmers course surveys
      </a>
      , fetched {formatDay(fetchedAt)}.
    </p>
  );
}

/** The rating and the standard questions, pooled over `rounds`. */
function SurveySummary({ rounds }: { rounds: readonly EvaluationRound[] }) {
  const evaluation = summarizeEvaluations(rounds);
  const years = rounds.map((r) => r.academicYear);
  const oldest = Math.min(...years);
  const newest = Math.max(...years);
  const isOneYear = oldest === newest;
  const title = isOneYear ? formatAcademicYear(newest) : `${formatAcademicYear(oldest)}–${formatAcademicYear(newest)}`;
  const detail = isOneYear
    ? rounds
        .map((r) => periodsLabel(r.periods))
        .filter(Boolean)
        .join(", ")
    : `all ${formatCount(rounds.length)} rounds`;
  const workload = questionMean(rounds, "workload");
  const workloadCounts = pooledAnswerCounts(rounds, "workload");
  const breakdown = BREAKDOWN.flatMap(({ question, label }) => {
    const mean = questionMean(rounds, question);
    return mean === null ? [] : [{ question, label, mean, counts: pooledAnswerCounts(rounds, question) }];
  });

  return (
    <div className="flex flex-col gap-4 self-start rounded-lg border p-4">
      <div className="flex items-baseline justify-between gap-3 border-b pb-3">
        <h3 className="font-medium tabular-nums">
          {title} <span className="font-normal text-muted-foreground">{detail}</span>
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatCount(sumOf(rounds, "answers"))} of {formatCount(sumOf(rounds, "respondents"))} answered
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tabular-nums">{formatScore(evaluation?.mean ?? null)}</span>
          <span className="text-lg text-muted-foreground">/ {ANSWER_SCALE.max}</span>
          <span className="ml-auto text-right text-xs text-muted-foreground tabular-nums">
            Overall impression
            <br />
            {evaluation ? `${formatCount(evaluation.answers)} answers` : "Too few answers"}
          </span>
        </div>
        {evaluation && (
          <>
            <DistributionMark frequencies={answerFrequencies(evaluation.overallAnswers)} {...ANSWER_SCALE} className="w-full" />
            <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>{ANSWER_SCALE.min} Very poor</span>
              <span>
                Median {formatNumber(evaluation.median)} · SD {formatNumber(evaluation.sd)}
              </span>
              <span>{ANSWER_SCALE.max} Excellent</span>
            </div>
          </>
        )}
      </div>
      <ul className="flex flex-col gap-1.5 border-t pt-4 text-sm">
        {breakdown.map(({ question, label, mean, counts }) => (
          <li key={question} className={QUESTION_GRID}>
            <span className="truncate">{label}</span>
            <span className="text-right tabular-nums">{formatScore(mean)}</span>
            {counts && <DistributionMark frequencies={answerFrequencies(counts)} {...ANSWER_SCALE} className="w-full" />}
          </li>
        ))}
        {workload !== null && (
          <li className={cn(QUESTION_GRID, "mt-1 border-t pt-2")}>
            <span className="flex flex-col">
              Workload
              <span className="text-xs text-muted-foreground">
                {ANSWER_SCALE.min} too low, {BALANCED_WORKLOAD} balanced, {ANSWER_SCALE.max} too high
              </span>
            </span>
            <span className="text-right tabular-nums">{formatScore(workload)}</span>
            {workloadCounts && <DistributionMark frequencies={answerFrequencies(workloadCounts)} {...ANSWER_SCALE} className="w-full" />}
          </li>
        )}
      </ul>
    </div>
  );
}

const ROUND_GRID = "grid grid-cols-[minmax(0,1fr)_4rem_3.5rem] items-center gap-x-4 sm:grid-cols-[minmax(0,1fr)_4rem_6rem_3.5rem]";

interface SurveyRoundsProps {
  /** Newest first. */
  rounds: readonly EvaluationRound[];
  /** The rounds the summary shows. */
  shown: readonly EvaluationRound[];
  onSelect: (key: string) => void;
  fetchedAt: string;
}

/** Every round, newest first, then all of them together. Picking one shows it in the summary. */
function SurveyRounds({ rounds, shown, onSelect, fetchedAt }: SurveyRoundsProps) {
  const isAll = rounds.length > 1 && shown.length === rounds.length;
  return (
    <div className="self-start">
      <div className={cn(ROUND_GRID, "border-b px-2 pb-2 text-xs text-muted-foreground")}>
        <span>Round</span>
        <span className="text-right">Overall</span>
        <span className="hidden text-right sm:block">Answers</span>
        <span className="text-right">Minutes</span>
      </div>
      <ul className="flex flex-col text-sm tabular-nums">
        {rounds.map((round) => (
          <RoundRow
            key={roundKey(round)}
            label={formatAcademicYear(round.academicYear)}
            detail={periodsLabel(round.periods)}
            mean={round.means.overall ?? null}
            counts={round.answerCounts.overall ?? null}
            answers={round.answers}
            respondents={round.respondents}
            minutes={round.minutes}
            selected={!isAll && shown.includes(round)}
            onSelect={() => onSelect(roundKey(round))}
          />
        ))}
        {rounds.length > 1 && (
          <RoundRow
            label="All rounds"
            mean={questionMean(rounds, "overall")}
            counts={pooledAnswerCounts(rounds, "overall")}
            answers={sumOf(rounds, "answers")}
            respondents={sumOf(rounds, "respondents")}
            minutes={null}
            selected={isAll}
            onSelect={() => onSelect(ALL_ROUNDS)}
          />
        )}
      </ul>
      <SurveySource fetchedAt={fetchedAt} />
    </div>
  );
}

interface RoundRowProps {
  label: string;
  detail?: string;
  mean: number | null;
  counts: readonly number[] | null;
  answers: number;
  respondents: number;
  minutes: string | null;
  selected: boolean;
  onSelect: () => void;
}

/**
 * The whole row picks the round. The overall cell and the minutes link sit above it with `relative z-10`.
 * A picked row gets a bar on its left edge and, beside the summary, an arrow pointing at it.
 */
function RoundRow({ label, detail, mean, counts, answers, respondents, minutes, selected, onSelect }: RoundRowProps) {
  return (
    <li
      className={cn(
        ROUND_GRID,
        "relative border-b px-2 py-2",
        selected ? "bg-muted shadow-[inset_2px_0_0_var(--color-foreground)]" : "hover:bg-muted/50",
      )}
    >
      {selected && (
        <ChevronRightIcon className="absolute top-1/2 -right-7 hidden size-4 -translate-y-1/2 text-muted-foreground md:block" aria-hidden />
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "text-left outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring",
          selected && "font-medium",
        )}
      >
        {label} {detail && <span className="font-normal text-muted-foreground">{detail}</span>}
      </button>
      {counts ? (
        <DistributionCell
          value={formatScore(mean)}
          frequencies={answerFrequencies(counts)}
          scale={ANSWER_SCALE}
          label="Overall impression"
        />
      ) : (
        <span className="text-right">{formatScore(mean)}</span>
      )}
      <span className="hidden text-right text-muted-foreground sm:block">
        {formatCount(answers)} of {formatCount(respondents)}
      </span>
      <span className="text-right">
        {minutes ? (
          <a
            href={minutes}
            target="_blank"
            rel="noreferrer"
            className="relative z-10 inline-flex items-center gap-1 underline-offset-4 hover:underline"
          >
            PDF
            <ExternalLinkIcon className="size-3" aria-hidden />
          </a>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </span>
    </li>
  );
}
