import type { Grade } from "@/domain/grades";

/** Literal class names per grade, so Tailwind can see them. */
export const GRADE_STYLE: Record<Grade, { bg: string; fill: string; text: string }> = {
  U: { bg: "bg-grade-u", fill: "fill-grade-u", text: "text-white dark:text-black" },
  "3": { bg: "bg-grade-3", fill: "fill-grade-3", text: "text-black" },
  "4": { bg: "bg-grade-4", fill: "fill-grade-4", text: "text-black" },
  "5": { bg: "bg-grade-5", fill: "fill-grade-5", text: "text-white" },
  G: { bg: "bg-grade-g", fill: "fill-grade-g", text: "text-black dark:text-white" },
  VG: { bg: "bg-grade-vg", fill: "fill-grade-vg", text: "text-white dark:text-black" },
  TG: { bg: "bg-grade-tg", fill: "fill-grade-tg", text: "text-black dark:text-white" },
};
