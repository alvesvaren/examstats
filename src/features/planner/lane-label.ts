import { UNSCHEDULED, type Lane } from "@/domain/planner";
import type { Messages } from "@/lib/i18n/en";

/** A lane's name: its study period, or the name of the courses without one. */
export const laneLabel = (lane: Lane, t: Messages) => (lane === UNSCHEDULED ? t.planner.notScheduled : t.periods([lane]));
