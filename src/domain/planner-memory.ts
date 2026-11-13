import { z } from "zod";

/** What the planner remembers on a device: the plan last worked on, and the picks of every year planned. */
const plannerMemorySchema = z.object({
  last: z.object({ programme: z.string(), year: z.number().int().positive().optional(), track: z.string().optional() }).optional(),
  /** Round keys by programme and year of study, such as "TKITE.3". */
  picks: z.record(z.string(), z.array(z.string())),
});
export type PlannerMemory = z.infer<typeof plannerMemorySchema>;

const planKey = (programme: string, year: number) => `${programme}.${year}`;

/** The memory in a stored string. Empty when nothing is stored, or when what is stored is not a memory. */
export function parsePlannerMemory(stored: string | null): PlannerMemory {
  try {
    return plannerMemorySchema.parse(JSON.parse(stored ?? ""));
  } catch {
    return { picks: {} };
  }
}

/** The picks remembered for a year of a programme, if any. */
export const rememberedPicks = (memory: PlannerMemory, programme: string, year: number): string[] | undefined =>
  memory.picks[planKey(programme, year)];

export interface ProgrammePick {
  year: number;
  key: string;
}

/** The picks remembered for all other years of a programme. */
export function otherPicks(memory: PlannerMemory, programme: string, currentYear: number): ProgrammePick[] {
  const prefix = `${programme}.`;
  const thisKey = planKey(programme, currentYear);
  return Object.entries(memory.picks).flatMap(([key, keys]) => {
    if (!key.startsWith(prefix) || key === thisKey) return [];
    const year = Number(key.slice(prefix.length));
    if (Number.isNaN(year)) return [];
    return keys.map((roundKey) => ({ year, key: roundKey }));
  });
}

/** The memory after a year's picks changed. A year without picks is forgotten. */
export function withPicks(memory: PlannerMemory, programme: string, year: number, keys: readonly string[]): PlannerMemory {
  const { [planKey(programme, year)]: _, ...others } = memory.picks;
  return { ...memory, picks: keys.length ? { ...others, [planKey(programme, year)]: [...keys] } : others };
}
