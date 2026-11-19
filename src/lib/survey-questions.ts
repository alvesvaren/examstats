import { ANSWER_SCALE, BALANCED_WORKLOAD, EVALUATION_YEARS, type Question } from "@/domain/evaluation";

/** Each survey question by its full name and a short one for column headers. */
export const QUESTION_LABELS = {
  overall: { label: "Overall impression", short: "Rating" },
  teaching: { label: "Teaching", short: "Teaching" },
  structure: { label: "Course structure", short: "Structure" },
  literature: { label: "Course material", short: "Material" },
  assessment: { label: "Assessment", short: "Assessment" },
  administration: { label: "Administration", short: "Admin" },
  learningOutcomes: { label: "Clear learning outcomes", short: "Outcomes" },
  prerequisites: { label: "Enough prior knowledge", short: "Prior knowledge" },
  workload: { label: "Workload", short: "Workload" },
} as const satisfies Record<Question, { label: string; short: string }>;

export const WORKLOAD_SCALE = `${ANSWER_SCALE.min} too low, ${BALANCED_WORKLOAD} balanced, ${ANSWER_SCALE.max} too high`;

/** The question and the years its answers are pooled over, shown above them on hover. */
export const questionWindow = (question: Question) => `${QUESTION_LABELS[question].label}, last ${EVALUATION_YEARS} years`;
