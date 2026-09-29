import { ExternalLinkIcon } from "lucide-react";
import { cn } from "cn";
import { SpreadCell } from "@/components/course-cells";
import { ScaleDot, SpreadMark } from "@/components/marks";
import { MetricLabel } from "@/components/metric-label";
import {
  ANSWER_SCALE,
  BALANCED_WORKLOAD,
  EVALUATION_YEARS,
  overallSpread,
  questionMean,
  type EvaluationRound,
  type EvaluationSummary,
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

interface CourseSurveyProps {
  evaluation: EvaluationSummary | null;
  /** Newest first. */
  rounds: readonly EvaluationRound[];
  fetchedAt: string;
}

/** What students answered in Chalmers course surveys: the rating, the standard questions, and each round. */
export function CourseSurvey({ evaluation, rounds, fetchedAt }: CourseSurveyProps) {
  const oldest = rounds.at(-1);
  const newest = rounds[0];
  const workload = questionMean(rounds, "workload");
  const breakdown = BREAKDOWN.flatMap(({ question, label }) => {
    const mean = questionMean(rounds, question);
    return mean === null ? [] : [{ question, label, mean }];
  });

  return (
    <section>
      <SectionTitle>
        <MetricLabel metric="rating">Course survey</MetricLabel>
      </SectionTitle>
      {newest && oldest ? (
        <div className="grid gap-8 md:grid-cols-2 md:gap-10">
          <div className="flex flex-col gap-5 self-start rounded-lg border p-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold tabular-nums">{formatScore(evaluation?.mean ?? null)}</span>
                <span className="text-lg text-muted-foreground">/ {ANSWER_SCALE.max}</span>
                <span className="ml-auto text-right text-xs text-muted-foreground tabular-nums">
                  Overall impression
                  <br />
                  {evaluation ? `${formatCount(evaluation.answers)} answers` : "Too few answers"} ·{" "}
                  {formatAcademicYear(oldest.academicYear)}
                  {oldest.academicYear !== newest.academicYear && `–${formatAcademicYear(newest.academicYear)}`}
                </span>
              </div>
              {evaluation && (
                <>
                  <SpreadMark spread={evaluation} {...ANSWER_SCALE} className="w-full" />
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
              {breakdown.map(({ question, label, mean }) => (
                <li key={question} className={QUESTION_GRID}>
                  <span className="truncate">{label}</span>
                  <span className="text-right tabular-nums">{formatScore(mean)}</span>
                  <ScaleDot value={mean} {...ANSWER_SCALE} className="w-full" />
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
                  <ScaleDot value={workload} {...ANSWER_SCALE} mark={BALANCED_WORKLOAD} className="w-full" />
                </li>
              )}
            </ul>
          </div>
          <SurveyRounds rounds={rounds} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No course surveys in the last {EVALUATION_YEARS} academic years.</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        From{" "}
        <a href={SURVEYS_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">
          Chalmers course surveys
        </a>
        , fetched {formatDay(fetchedAt)}.
      </p>
    </section>
  );
}

const ROUND_GRID = "grid grid-cols-[minmax(0,1fr)_4rem_3.5rem] items-center gap-x-4 sm:grid-cols-[minmax(0,1fr)_4rem_5rem_3.5rem]";

function SurveyRounds({ rounds }: { rounds: readonly EvaluationRound[] }) {
  const rows = rounds.map((round) => ({ round, spread: overallSpread([round]) }));
  return (
    <div>
      <div className={cn(ROUND_GRID, "border-b pb-2 text-xs text-muted-foreground")}>
        <span>Round</span>
        <span className="text-right">Overall</span>
        <span className="hidden text-right sm:block">Answers</span>
        <span className="text-right">Minutes</span>
      </div>
      <ul className="flex flex-col text-sm tabular-nums">
        {rows.map(({ round, spread }) => (
          <li key={`${round.academicYear} ${round.periods}`} className={cn(ROUND_GRID, "border-b py-2")}>
            <span>
              {formatAcademicYear(round.academicYear)} <span className="text-muted-foreground">{periodsLabel(round.periods)}</span>
            </span>
            {spread ? (
              <SpreadCell value={formatScore(spread.mean)} spread={spread} scale={ANSWER_SCALE} label="Overall impression" />
            ) : (
              <span className="text-right">{formatScore(round.means.overall ?? null)}</span>
            )}
            <span className="hidden text-right text-muted-foreground sm:block">
              {formatCount(round.answers)} of {formatCount(round.respondents)}
            </span>
            <span className="text-right">
              {round.minutes ? (
                <a
                  href={round.minutes}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  PDF
                  <ExternalLinkIcon className="size-3" aria-hidden />
                </a>
              ) : (
                <span className="text-muted-foreground">–</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
