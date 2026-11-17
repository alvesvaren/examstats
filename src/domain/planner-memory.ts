import { z } from "zod";
import type { StudyPick, StudyYear } from "./programme-plans.ts";

/**
 * What the planner remembers on a device: the plan last worked on, the picks of every year planned, and the start
 * year of and master's programme after each programme.
 */
const plannerMemorySchema = z.object({
  last: z
    .object({
      programme: z.string(),
      start: z.number().int().optional(),
      year: z.number().int().positive().optional(),
      track: z.string().optional(),
    })
    .optional(),
  /** Round keys by programme and year of its plan, such as "TKITE.3" or "MPALG.1". */
  picks: z.record(z.string(), z.array(z.string())),
  /** Master's programme codes by programme code. */
  masters: z.record(z.string(), z.string()).default({}),
  /** Start years by programme code. */
  starts: z.record(z.string(), z.number().int()).default({}),
});
export type PlannerMemory = z.infer<typeof plannerMemorySchema>;

const planKey = (programme: string, year: number) => `${programme}.${year}`;

/** The memory in a stored string. Empty when nothing is stored, or when what is stored is not a memory. */
export function parsePlannerMemory(stored: string | null): PlannerMemory {
  try {
    return plannerMemorySchema.parse(JSON.parse(stored ?? ""));
  } catch {
    return { picks: {}, masters: {}, starts: {} };
  }
}

/** The picks remembered for a year of a programme, if any. */
export const rememberedPicks = (memory: PlannerMemory, programme: string, year: number): string[] | undefined =>
  memory.picks[planKey(programme, year)];

/** The picks remembered for every year of study but the `current` one. */
export const otherPicks = (memory: PlannerMemory, years: readonly StudyYear[], current: number): StudyPick[] =>
  years
    .filter(({ number }) => number !== current)
    .flatMap(({ number, plan, year }) =>
      (rememberedPicks(memory, plan.code, year) ?? []).map((key) => ({ number, programme: plan.code, year, key })),
    );

/** The memory after a year's picks changed. A year without picks is forgotten. */
export function withPicks(memory: PlannerMemory, programme: string, year: number, keys: readonly string[]): PlannerMemory {
  const { [planKey(programme, year)]: _, ...others } = memory.picks;
  return { ...memory, picks: keys.length ? { ...others, [planKey(programme, year)]: [...keys] } : others };
}

/** The memory after the master's programme after `programme` changed. Without one, it is forgotten, but its picks are kept. */
export function withMaster(memory: PlannerMemory, programme: string, master: string | undefined): PlannerMemory {
  const { [programme]: _, ...others } = memory.masters;
  return { ...memory, masters: master ? { ...others, [programme]: master } : others };
}

/** The memory after the start year of `programme` changed. */
export const withStart = (memory: PlannerMemory, programme: string, start: number): PlannerMemory => ({
  ...memory,
  starts: { ...memory.starts, [programme]: start },
});
