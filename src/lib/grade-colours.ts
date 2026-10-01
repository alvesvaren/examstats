import type { Grade } from "../domain/grades.ts";

/**
 * The light theme's `--grade-*` tokens in `src/index.css`, for the link preview image, which cannot read CSS variables.
 * A test keeps them in sync.
 */
export const GRADE_COLOURS: Record<Grade, string> = {
  U: "#dc2626",
  "3": "#5fc185",
  "4": "#22a355",
  "5": "#166534",
  G: "#94a3b8",
  VG: "#334155",
  TG: "#cbd5e1",
};
