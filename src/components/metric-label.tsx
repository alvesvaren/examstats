import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RECENT_YEARS } from "@/domain/course-stats";
import { ANSWER_SCALE, EVALUATION_YEARS, isOtherQuestion, type OtherQuestion } from "@/domain/evaluation";
import { QUESTION_LABELS, WORKLOAD_SCALE } from "@/lib/survey-questions";

const WINDOW = `the main exam over the last ${RECENT_YEARS} academic years with results`;
const SPREAD = "In the mark, the darker a value, the larger its share of answers. The tick is the median.";

const METRIC_HELP = {
  passRate: `Share of attempts that passed ${WINDOW}. A retake counts as a new attempt.`,
  averageGrade: `Mean of grades 3, 4 and 5 on ${WINDOW}. Fails are left out.`,
  attemptsPerYear: `Attempts per year on ${WINDOW}.`,
  trend: "Pass rate per academic year on the main exam.",
  rating: `Students' overall impression of the course in Chalmers course surveys, from ${ANSWER_SCALE.min} to ${ANSWER_SCALE.max}, over the last ${EVALUATION_YEARS} academic years, counting every answer. ${SPREAD}`,
} as const;

const SURVEYS = `in Chalmers course surveys, from ${ANSWER_SCALE.min} to ${ANSWER_SCALE.max}, over the last ${EVALUATION_YEARS} academic years`;

function questionHelp(question: OtherQuestion) {
  if (question === "workload") return `How students found the workload ${SURVEYS}: ${WORKLOAD_SCALE}. ${SPREAD}`;
  return `Students' answers on ${QUESTION_LABELS[question].label.toLowerCase()} ${SURVEYS}. ${SPREAD}`;
}

export type Metric = keyof typeof METRIC_HELP | OtherQuestion;

const helpOf = (metric: Metric) => (isOtherQuestion(metric) ? questionHelp(metric) : METRIC_HELP[metric]);

/** An info icon that explains a metric on hover and focus. */
export function MetricInfo({ metric, name }: { metric: Metric; name: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="rounded-full text-muted-foreground hover:text-foreground" aria-label={`About ${name}`}>
        <InfoIcon className="size-3.5" aria-hidden />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{helpOf(metric)}</TooltipContent>
    </Tooltip>
  );
}

export function MetricLabel({ metric, children }: { metric: Metric; children: ReactNode & string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <MetricInfo metric={metric} name={children.toLowerCase()} />
    </span>
  );
}
