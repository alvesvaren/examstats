import { z } from "zod";
import { OTHER_QUESTIONS } from "./evaluation.ts";
import type { InLanguage } from "./names.ts";
import { otherNameOf } from "./names.ts";
import { accreditedMasters, LANES, PLANNER_SORT_KEYS, type Lane } from "./planner.ts";
import {
  cohortOf,
  MASTER_START_YEAR,
  studyYears,
  tracksOf,
  type ProgrammePlan,
  type PublishedPlanInfo,
  type StudyPick,
  type StudyYear,
} from "./programme-plans.ts";

/** The planner's part of the URL. It is what a shared link holds. */
export const plannerSearchSchema = z.object({
  programme: z.string().optional().catch(undefined),
  /** The year the student started the programme in, as the first calendar year of that academic year, such as 2024. */
  start: z.number().int().optional().catch(undefined),
  /** The year of study, counted on into the master's programme. */
  year: z.number().int().positive().optional().catch(undefined),
  /** The master's programme after the programme, as its code. */
  master: z.string().optional().catch(undefined),
  track: z.string().optional().catch(undefined),
  /** The study period whose courses are listed, or the courses without one. */
  period: z.enum(LANES).optional().catch(undefined),
  sort: z.enum(PLANNER_SORT_KEYS).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  /** The course survey question the survey column shows, when not the overall impression. */
  survey: z.enum(OTHER_QUESTIONS).optional().catch(undefined),
  /** Round keys of the courses added to the year, such as "TDA357.LP2". */
  picked: z.array(z.string()).optional().catch(undefined),
});
export type PlannerSearch = z.infer<typeof plannerSearchSchema>;

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
const rememberedPicks = (memory: PlannerMemory, programme: string, year: number): string[] | undefined =>
  memory.picks[planKey(programme, year)];

/** The picks remembered for every year of study but the `current` one. */
const otherPicks = (memory: PlannerMemory, years: readonly StudyYear[], current: number): StudyPick[] =>
  years
    .filter(({ number }) => number !== current)
    .flatMap(({ number, plan, year }) =>
      (rememberedPicks(memory, plan.code, year) ?? []).map((key) => ({ number, programme: plan.code, year, key })),
    );

/** The memory after a year's picks changed. A year without picks is forgotten. */
function withPicks(memory: PlannerMemory, programme: string, year: number, keys: readonly string[]): PlannerMemory {
  const { [planKey(programme, year)]: _, ...others } = memory.picks;
  return { ...memory, picks: keys.length ? { ...others, [planKey(programme, year)]: [...keys] } : others };
}

/** The memory after the master's programme after `programme` changed. Without one, it is forgotten, but its picks are kept. */
function withMaster(memory: PlannerMemory, programme: string, master: string | undefined): PlannerMemory {
  const { [programme]: _, ...others } = memory.masters;
  return { ...memory, masters: master ? { ...others, [programme]: master } : others };
}

/** The memory after the start year of `programme` changed. */
const withStart = (memory: PlannerMemory, programme: string, start: number): PlannerMemory => ({
  ...memory,
  starts: { ...memory.starts, [programme]: start },
});

/** The memory after a programme was opened from the list of programmes. The header's link goes back to it. */
export const withLastProgramme =
  (programme: string) =>
  (memory: PlannerMemory): PlannerMemory => ({ ...memory, last: { programme } });

/**
 * The start year the planner shows. A start year in the URL is a shared plan and wins. Without one, it is the one
 * this device remembers for the programme.
 */
export const plannerCohort = (info: PublishedPlanInfo, search: Pick<PlannerSearch, "programme" | "start">, memory: PlannerMemory) =>
  cohortOf(info, search.programme, search.start ?? memory.starts[search.programme ?? ""]);

interface PlannerInput {
  search: PlannerSearch;
  memory: PlannerMemory;
  cohort: ReturnType<typeof plannerCohort>;
  /** The programmes of the cohort's start year. */
  plans: readonly ProgrammePlan[];
  /** The programmes of the year the master's programmes start in. */
  masterPlans: readonly ProgrammePlan[];
  /** Programme names by code. */
  names: Readonly<Record<string, InLanguage>>;
}

/**
 * What the planner shows: the search of programmes when the URL names none, else the programme's plan, with the
 * master's programme, year, track and picks that the URL names, or else this device remembers.
 */
export function resolvePlanner({ search, memory, cohort, plans, masterPlans, names }: PlannerInput) {
  const programme = plans.find((p) => p.code === search.programme);
  if (!programme) return { kind: "search" as const, programmes: plans, names };

  const accredited = accreditedMasters(programme, cohort.upcomingMasters);
  const masters = masterPlans.filter((p) => accredited.has(p.code));
  // A master's programme in the URL is a shared plan and wins. Without one, the degree is as this device remembers it.
  const masterCode = search.master ?? memory.masters[programme.code];
  const master = masters.find((p) => p.code === masterCode);
  const years = studyYears(programme, master);
  // Without a master's programme, its first year is where to choose one.
  const choosingMaster = !master && masters.length > 0 && search.year === MASTER_START_YEAR;
  const current = years.find((y) => y.number === search.year) ?? years[0];
  const tracks = choosingMaster ? [] : tracksOf(current?.plan.years.find((y) => y.year === current.year)?.courses ?? []);
  return {
    kind: "plan" as const,
    search,
    memory,
    cohort,
    programme,
    otherName: otherNameOf(names, programme.code),
    accredited,
    masters,
    master,
    masterAccreditation: master && accredited.get(master.code),
    years,
    choosingMaster,
    /** Whether the page says where the master's programmes come from. */
    showsMasters: Boolean(master) || choosingMaster,
    current,
    tracks,
    track: tracks.find((name) => name === search.track),
    /** The round keys picked in the current year. Picks in the URL are a shared plan and win over the remembered ones. */
    pickedKeys: current ? (search.picked ?? rememberedPicks(memory, current.plan.code, current.year) ?? []) : [],
    /** The picks remembered for the other years of study. */
    otherPicks: current ? otherPicks(memory, years, current.number) : [],
    /** The course list of the upcoming master's programme the current year belongs to, which its new courses link to. */
    courseList: master && current?.plan === master ? (accredited.get(master.code)?.courseList ?? null) : null,
  };
}
type PlannerState = ReturnType<typeof resolvePlanner>;
type PlanState = Extract<PlannerState, { kind: "plan" }>;

export type PlannerAction =
  | { type: "showYear"; year: number }
  | { type: "showTrack"; track: string | undefined }
  /** Without a master's programme, the degree is the programme's years alone. */
  | { type: "chooseMaster"; master: string | undefined }
  | { type: "showStart"; start: number }
  /** The picks of the current year. `period` keeps the list on that lane. */
  | { type: "setPicks"; keys: readonly string[]; period?: Lane }
  /** What the year's list shows. It touches the URL only. */
  | { type: "view"; changes: Pick<PlannerSearch, "period" | "sort" | "dir" | "survey"> };

/** What an action does: the changes to the URL's search, and how the memory changes when the action is one to remember. */
interface PlannerStep {
  search: Partial<PlannerSearch>;
  /** An updater, since it applies to the memory as it is stored when the step happens. */
  remember?: (memory: PlannerMemory) => PlannerMemory;
}

/**
 * What an action changes. The header's link to the planner comes back to the start year, year and track last shown, so
 * every action that remembers stores the view as it is after the action.
 */
export function plannerStep(state: PlanState, action: PlannerAction): PlannerStep {
  const { programme, cohort, current, track, memory, years } = state;
  const { start } = cohort;
  const shown = (view: { start?: number; year?: number; track?: string }): PlannerMemory["last"] => ({
    programme: programme.code,
    start,
    year: current?.number,
    track,
    ...view,
  });
  // The picks of a year of study, which the URL takes along when the year is shown.
  const picksIn = (shownYears: readonly StudyYear[], number: number) => {
    const year = shownYears.find((y) => y.number === number);
    return year && rememberedPicks(memory, year.plan.code, year.year);
  };

  switch (action.type) {
    case "showYear":
      return {
        search: {
          start,
          year: action.year,
          master: state.master?.code,
          track: undefined,
          period: undefined,
          picked: picksIn(years, action.year),
        },
        remember: (m) => ({ ...m, last: shown({ year: action.year, track: undefined }) }),
      };
    case "showTrack":
      return {
        search: { track: action.track },
        remember: (m) => ({ ...m, last: shown({ track: action.track }) }),
      };
    case "chooseMaster": {
      const chosen = studyYears(
        programme,
        state.masters.find((p) => p.code === action.master),
      );
      return {
        search: {
          start,
          year: MASTER_START_YEAR,
          master: action.master,
          track: undefined,
          period: undefined,
          picked: picksIn(chosen, MASTER_START_YEAR),
        },
        remember: (m) => ({
          ...withMaster(m, programme.code, action.master),
          last: shown({ year: MASTER_START_YEAR, track: undefined }),
        }),
      };
    }
    case "showStart":
      return {
        search: { start: action.start, track: undefined, period: undefined },
        remember: (m) => ({ ...withStart(m, programme.code, action.start), last: shown({ start: action.start, track: undefined }) }),
      };
    case "setPicks": {
      if (!current) return { search: {} };
      return {
        search: { ...(action.period && { period: action.period }), picked: action.keys.length ? [...action.keys] : undefined },
        remember: (m) => ({ ...withPicks(m, current.plan.code, current.year, action.keys), last: shown({}) }),
      };
    }
    case "view":
      return { search: action.changes };
  }
}
