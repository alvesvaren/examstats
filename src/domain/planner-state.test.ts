import { describe, expect, it } from "vitest";
import {
  NO_TRACK,
  withLastProgramme,
  parsePlannerMemory,
  plannerCohort,
  plannerStep,
  resolvePlanner,
  type PlannerAction,
  type PlannerMemory,
  type PlannerSearch,
} from "./planner-state.ts";
import {
  planCourseSchema,
  programmePlanSchema,
  publishedPlanInfoSchema,
  upcomingMastersSchema,
  type PlanCourse,
  type ProgrammePlan,
} from "./programme-plans.ts";

/** A 7.5 credit elective in LP1, unless `overrides` say otherwise. */
const course = (code: string, overrides: Partial<PlanCourse> = {}): PlanCourse =>
  planCourseSchema.parse({
    code,
    name: `${code} name`,
    credits: 7.5,
    periods: ["LP1"],
    periodCredits: [7.5],
    rule: "V",
    track: null,
    block: null,
    choices: [],
    themes: [],
    examiners: [],
    modules: [],
    seats: null,
    ...overrides,
  });

/** A plan with the courses of each year, by year. */
const plan = (code: string, years: Record<number, PlanCourse[]>, overrides: Partial<ProgrammePlan> = {}): ProgrammePlan =>
  programmePlanSchema.parse({
    code,
    name: code,
    choices: [],
    requirements: [],
    masters: [],
    prerequisites: [],
    years: Object.entries(years).map(([year, courses]) => ({ year: Number(year), courses })),
    ...overrides,
  });

describe("parsePlannerMemory", () => {
  it("reads back what was stored", () => {
    const memory = {
      last: { programme: "TKITE", start: 2024, year: 3 },
      picks: { "TKITE.3": ["TDA357.LP2"] },
      masters: { TKITE: "MPALG" },
      starts: { TKITE: 2024 },
      tracks: { MPALG: "Security", TKITE: NO_TRACK },
    };
    expect(parsePlannerMemory(JSON.stringify(memory))).toEqual(memory);
  });

  it("keeps the picks of a memory stored before it held master's programmes, start years and tracks", () => {
    const stored = { last: { programme: "TKITE" }, picks: { "TKITE.3": ["TDA357.LP2"] } };
    expect(parsePlannerMemory(JSON.stringify(stored))).toEqual({ ...stored, masters: {}, starts: {}, tracks: {} });
  });

  it("starts empty when nothing is stored, or when what is stored is not a memory", () => {
    const empty = { picks: {}, masters: {}, starts: {}, tracks: {} };
    expect(parsePlannerMemory(null)).toEqual(empty);
    expect(parsePlannerMemory("not json")).toEqual(empty);
    expect(parsePlannerMemory(JSON.stringify({ picks: ["TDA357.LP2"] }))).toEqual(empty);
  });
});

describe("withLastProgramme", () => {
  it("makes the programme the one last worked on, forgetting the start year, year and track of the one before", () => {
    const memory: PlannerMemory = {
      last: { programme: "TKITE", start: 2024, year: 3, track: "AI" },
      picks: { "TKITE.3": ["TDA357.LP2"] },
      masters: { TKITE: "MPALG" },
      starts: { TKITE: 2024 },
      tracks: {},
    };

    expect(withLastProgramme("TKDAT")(memory)).toEqual({ ...memory, last: { programme: "TKDAT" } });
  });
});

const TKITE = plan(
  "TKITE",
  {
    1: [],
    2: [course("DAT026")],
    3: [
      course("TDA357", { periods: ["LP2"] }),
      course("EDA344", { periods: ["LP1"], track: "AI" }),
      course("TDA555", { periods: ["LP3"], track: "Web" }),
    ],
  },
  { masters: ["MPALG", "MPCSC"] },
);
const MPALG = plan("MPALG", {
  1: [course("DAT060"), course("DAT061", { periods: ["LP2"], track: "Security" }), course("DAT062", { track: "Algorithms" })],
  2: [course("TDA352", { track: "Security" })],
});
const MPCSC = plan("MPCSC", { 1: [course("DAT450")] });
/** A master's programme that TKITE does not lead on to. */
const MPSEC = plan("MPSEC", { 1: [course("DAT510")] });
const NAMES = {
  TKITE: { name: "Information technology", otherName: "Informationsteknik" },
  MPALG: { name: "Algorithms", otherName: "Algoritmer" },
};

const INFO = publishedPlanInfoSchema.parse({
  academicYear: "2026/2027",
  ruleNames: {},
  starts: { TKITE: [2023, 2024, 2025] },
  upcomingMasters: null,
});
const UPCOMING = upcomingMastersSchema.parse({
  academicYear: "2027/2028",
  matrix: "https://example.com/matrix.pdf",
  accreditations: { TKITE: [{ code: "MPALG", specialisations: ["Security"] }] },
  masters: { MPALG: { courseList: "https://example.com/mpalg.pdf" } },
});

/** What this device remembers: picks in years of both the programme and a master's programme, and no choices of degree. */
const MEMORY: PlannerMemory = {
  last: { programme: "TKITE", start: 2024, year: 3 },
  picks: { "TKITE.2": ["DAT026.LP1"], "TKITE.3": ["TDA357.LP2"], "MPALG.1": ["DAT060.LP1"] },
  masters: {},
  starts: {},
  tracks: {},
};
const WITH_MPALG: PlannerMemory = { ...MEMORY, masters: { TKITE: "MPALG" } };

function resolve(search: PlannerSearch, memory = MEMORY, info = INFO) {
  const cohort = plannerCohort(info, search, memory);
  return resolvePlanner({ search, memory, cohort, plans: [TKITE], masterPlans: [MPALG, MPCSC, MPSEC], names: NAMES });
}

function planned(search: PlannerSearch, memory = MEMORY, info = INFO) {
  const state = resolve(search, memory, info);
  if (state.kind !== "plan") throw new Error("Expected a programme's plan");
  return state;
}

describe("plannerCohort", () => {
  const memory = { ...MEMORY, starts: { TKITE: 2023 } };

  it("uses a start year in the link over the remembered one", () => {
    expect(plannerCohort(INFO, { programme: "TKITE", start: 2024 }, memory).start).toBe(2024);
  });

  it("uses without a link the start year this device remembers", () => {
    expect(plannerCohort(INFO, { programme: "TKITE" }, memory).start).toBe(2023);
  });

  it("uses the newest start year when none named is one the programme admitted students in", () => {
    expect(plannerCohort(INFO, { programme: "TKITE" }, MEMORY).start).toBe(2025);
    expect(plannerCohort(INFO, { programme: "TKITE" }, { ...MEMORY, starts: { TKITE: 2019 } }).start).toBe(2025);
  });
});

describe("resolvePlanner", () => {
  it("searches the programmes when the link names none, or one that has no plan", () => {
    expect(resolve({})).toEqual({ kind: "search", programmes: [TKITE], names: NAMES });
    expect(resolve({ programme: "NOPE" }).kind).toBe("search");
  });

  it("shows the programme with its name in the other language", () => {
    const state = planned({ programme: "TKITE" });

    expect(state.programme).toBe(TKITE);
    expect(state.otherName).toBe("Informationsteknik");
  });

  it("shows a start year in the link over the remembered one", () => {
    const state = planned({ programme: "TKITE", start: 2024 }, { ...MEMORY, starts: { TKITE: 2023 } });

    expect(state.cohort.start).toBe(2024);
  });

  it("shows without a link the master's programme this device remembers", () => {
    const state = planned({ programme: "TKITE" }, WITH_MPALG);

    expect(state.master).toBe(MPALG);
    expect(state.years.map((y) => y.number)).toEqual([1, 2, 3, 4, 5]);
    expect(state.masterAccreditation).toEqual({ specialisations: [], courseList: null });
  });

  it("shows a master's programme in the link over the remembered one", () => {
    const state = planned({ programme: "TKITE", master: "MPCSC" }, WITH_MPALG);

    expect(state.master).toBe(MPCSC);
    expect(state.years.map((y) => y.number)).toEqual([1, 2, 3, 4]);
  });

  it("offers only the master's programmes the programme leads on to", () => {
    const state = planned({ programme: "TKITE", master: "MPSEC" }, { ...MEMORY, masters: { TKITE: "MPSEC" } });

    expect(state.masters).toEqual([MPALG, MPCSC]);
    expect(state.master).toBeUndefined();
    expect(state.years.map((y) => y.number)).toEqual([1, 2, 3]);
  });

  it("chooses the master's programme when year 4 is asked for without one", () => {
    const state = planned({ programme: "TKITE", year: 4 });

    expect(state.choosingMaster).toBe(true);
    expect(state.showsMasters).toBe(true);
    expect(state.current?.number).toBe(1);
    expect(state.tracks).toEqual([]);
  });

  it("shows year 4 of a chosen master's programme as a year, not as the choice of one", () => {
    const state = planned({ programme: "TKITE", year: 4, master: "MPALG" });

    expect(state.choosingMaster).toBe(false);
    expect(state.current).toEqual({ number: 4, plan: MPALG, year: 1 });
  });

  it("shows the first year when the link names a year the degree does not have", () => {
    expect(planned({ programme: "TKITE" }).current?.number).toBe(1);
    expect(planned({ programme: "TKITE", year: 7 }).current?.number).toBe(1);
  });

  it("asks for the start year when the programme admitted students in several years and neither the link nor the device names one", () => {
    expect(planned({ programme: "TKITE" }).choosingStart).toBe(true);
    expect(planned({ programme: "TKITE", start: 2024 }).choosingStart).toBe(false);
    expect(planned({ programme: "TKITE" }, { ...MEMORY, starts: { TKITE: 2023 } }).choosingStart).toBe(false);
    expect(planned({ programme: "TKITE" }, MEMORY, { ...INFO, starts: { TKITE: [2025] } }).choosingStart).toBe(false);
  });

  describe("tracks", () => {
    it("offers the tracks of the year shown, and shows the one in the link when the year has it", () => {
      expect(planned({ programme: "TKITE", year: 3, track: "AI" })).toMatchObject({
        tracks: ["AI", "Web"],
        track: "AI",
        choosingTrack: false,
      });
      expect(planned({ programme: "TKITE", year: 2 })).toMatchObject({ tracks: [], track: undefined, choosingTrack: false });
    });

    it("shows without a track in the link the one this device chose in the plan, which a master's programme keeps in both its years", () => {
      const memory = { ...WITH_MPALG, tracks: { MPALG: "Security" } };

      expect(planned({ programme: "TKITE", year: 4 }, memory).track).toBe("Security");
      expect(planned({ programme: "TKITE", year: 5 }, memory).track).toBe("Security");
    });

    it("skips a track the year does not have, for the remembered one", () => {
      const state = planned({ programme: "TKITE", year: 3, track: "Nope" }, { ...MEMORY, tracks: { TKITE: "Web" } });

      expect(state).toMatchObject({ track: "Web", choosingTrack: false });
    });

    it("shows the courses of every track when the student chose none", () => {
      expect(planned({ programme: "TKITE", year: 3, track: NO_TRACK })).toMatchObject({ track: undefined, choosingTrack: false });
      expect(planned({ programme: "TKITE", year: 3 }, { ...MEMORY, tracks: { TKITE: NO_TRACK } }).choosingTrack).toBe(false);
    });

    it("asks for a track, or none, when the year has tracks and nothing chose one", () => {
      expect(planned({ programme: "TKITE", year: 3, track: "Nope" })).toMatchObject({ track: undefined, choosingTrack: true });
    });

    it("calls the tracks of a master's programme specialisations, and those of the programme before it concentrations", () => {
      expect(planned({ programme: "TKITE", year: 3 }).trackKind).toBe("concentration");
      expect(planned({ programme: "TKITE", year: 4 }, WITH_MPALG).trackKind).toBe("specialisation");
    });

    it("keeps the track of the programme and that of the master's programme apart, whichever year shows", () => {
      const memory = { ...WITH_MPALG, tracks: { TKITE: "Web", MPALG: "Security" } };

      expect(planned({ programme: "TKITE", year: 3, track: "AI" }, memory)).toMatchObject({
        programmeTrack: "AI",
        masterTrack: "Security",
      });
      expect(planned({ programme: "TKITE", year: 4 }, memory)).toMatchObject({ programmeTrack: "Web", masterTrack: "Security" });
      expect(planned({ programme: "TKITE", year: 4 }, { ...memory, tracks: { TKITE: NO_TRACK } }).programmeTrack).toBeUndefined();
    });
  });

  it("shows the picks in the link over the remembered ones", () => {
    const state = planned({ programme: "TKITE", year: 3, picked: ["EDA344.LP1"] });

    expect(state.pickedKeys).toEqual(["EDA344.LP1"]);
  });

  it("shows without a link the picks this device remembers for the year shown, if any", () => {
    expect(planned({ programme: "TKITE", year: 3 }).pickedKeys).toEqual(["TDA357.LP2"]);
    expect(planned({ programme: "TKITE", year: 2 }).pickedKeys).toEqual(["DAT026.LP1"]);
    expect(planned({ programme: "TKITE", year: 1 }).pickedKeys).toEqual([]);
  });

  it("holds the picks of every year, those of the year shown from the link", () => {
    const state = planned({ programme: "TKITE", year: 3, picked: ["EDA344.LP1"] }, WITH_MPALG);

    expect(state.picks).toEqual([
      { number: 2, programme: "TKITE", year: 2, key: "DAT026.LP1" },
      { number: 4, programme: "MPALG", year: 1, key: "DAT060.LP1" },
      { number: 3, programme: "TKITE", year: 3, key: "EDA344.LP1" },
    ]);
  });

  it("remembers the picks of the other years of study, the master's programme's too, and none of other programmes", () => {
    const others = { "TKDAT.1": ["OTHER.LP1"], "MPCSC.1": ["OTHER.LP2"] };
    const state = planned({ programme: "TKITE", year: 3 }, { ...WITH_MPALG, picks: { ...WITH_MPALG.picks, ...others } });

    expect(state.otherPicks).toEqual([
      { number: 2, programme: "TKITE", year: 2, key: "DAT026.LP1" },
      { number: 4, programme: "MPALG", year: 1, key: "DAT060.LP1" },
    ]);
  });

  describe("with upcoming master's programmes", () => {
    const info = publishedPlanInfoSchema.parse({ ...INFO, upcomingMasters: UPCOMING });

    it("offers the master's programmes of the upcoming accreditations, with what each asks for", () => {
      const state = planned({ programme: "TKITE", start: 2024, master: "MPALG", year: 4 }, MEMORY, info);

      expect(state.masters).toEqual([MPALG]);
      expect(state.masterAccreditation).toEqual({ specialisations: ["Security"], courseList: "https://example.com/mpalg.pdf" });
    });

    it("sets apart the specialisations of the master's programme that the degree cannot have", () => {
      const inMaster = planned({ programme: "TKITE", start: 2024, master: "MPALG", year: 4 }, MEMORY, info);
      const inProgramme = planned({ programme: "TKITE", start: 2024, master: "MPALG", year: 3 }, MEMORY, info);

      expect(inMaster).toMatchObject({ tracks: ["Algorithms", "Security"], tracksWithoutDegree: ["Algorithms"] });
      expect(inProgramme).toMatchObject({ tracks: ["AI", "Web"], tracksWithoutDegree: [] });
    });

    it("sets apart no specialisation of a master's programme that gives the degree with any", () => {
      const state = planned({ programme: "TKITE", master: "MPALG", year: 4 });

      expect(state).toMatchObject({ tracks: ["Algorithms", "Security"], tracksWithoutDegree: [] });
    });

    it("links the new courses of the master's programme's years to its course list, and those of the programme's own years nowhere", () => {
      const inMaster = planned({ programme: "TKITE", start: 2024, master: "MPALG", year: 5 }, MEMORY, info);
      const inProgramme = planned({ programme: "TKITE", start: 2024, master: "MPALG", year: 3 }, MEMORY, info);

      expect([inMaster.courseList, inProgramme.courseList]).toEqual(["https://example.com/mpalg.pdf", null]);
    });
  });
});

const rememberedAfter = (step: ReturnType<typeof plannerStep>, memory: PlannerMemory) => step.remember?.(memory);

describe("plannerStep", () => {
  /** The view of a link to year 3 with a track and a period, and the master's programme this device remembers. */
  const viewing = planned({ programme: "TKITE", start: 2024, year: 3, track: "AI", period: "LP2", picked: ["TDA357.LP2"] }, WITH_MPALG);
  /** The same degree before a master's programme is chosen. */
  const choosing = planned({ programme: "TKITE", start: 2024, year: 4, track: "AI", period: "LP2" });

  it("shows another year by restoring that year's remembered picks and clearing the track and period", () => {
    const step = plannerStep(viewing, { type: "showYear", year: 2 });

    expect(step.search).toStrictEqual({
      start: 2024,
      year: 2,
      master: "MPALG",
      track: undefined,
      period: undefined,
      picked: ["DAT026.LP1"],
    });
    expect(rememberedAfter(step, WITH_MPALG)).toEqual({ ...WITH_MPALG, last: { programme: "TKITE", start: 2024, year: 2 } });
  });

  it("shows a year of the master's programme with the picks remembered for it, and keeps the master's programme in the link", () => {
    const step = plannerStep(viewing, { type: "showYear", year: 4 });

    expect(step.search).toStrictEqual({
      start: 2024,
      year: 4,
      master: "MPALG",
      track: undefined,
      period: undefined,
      picked: ["DAT060.LP1"],
    });
  });

  it("shows a year without remembered picks with none in the link", () => {
    expect(plannerStep(viewing, { type: "showYear", year: 1 }).search.picked).toBeUndefined();
  });

  it("shows the master's programmes to choose from as year 4, without a master's programme in the link", () => {
    const step = plannerStep(planned({ programme: "TKITE", start: 2024, year: 2 }), { type: "showYear", year: 4 });

    expect(step.search).toStrictEqual({
      start: 2024,
      year: 4,
      master: undefined,
      track: undefined,
      period: undefined,
      picked: undefined,
    });
  });

  it("shows another track, and remembers it for the plan", () => {
    const step = plannerStep(viewing, { type: "showTrack", track: "Web" });

    expect(step.search).toStrictEqual({ track: "Web" });
    expect(rememberedAfter(step, MEMORY)).toEqual({
      ...MEMORY,
      tracks: { TKITE: "Web" },
      last: { programme: "TKITE", start: 2024, year: 3, track: "Web" },
    });
  });

  it("shows every track's courses when the student chooses none, and remembers that choice", () => {
    const step = plannerStep(viewing, { type: "showTrack", track: NO_TRACK });

    expect(step.search).toStrictEqual({ track: NO_TRACK });
    expect(rememberedAfter(step, MEMORY)?.tracks).toEqual({ TKITE: NO_TRACK });
    expect(rememberedAfter(step, MEMORY)?.last).toEqual({ programme: "TKITE", start: 2024, year: 3 });
  });

  it("remembers the track of each plan apart", () => {
    const stored: PlannerMemory = { ...MEMORY, tracks: { MPALG: "Security" } };

    expect(rememberedAfter(plannerStep(viewing, { type: "showTrack", track: "Web" }), stored)?.tracks).toEqual({
      MPALG: "Security",
      TKITE: "Web",
    });
  });

  it("shows another year with the track this device chose in its plan, so a master's programme keeps it between its years", () => {
    const memory = { ...WITH_MPALG, tracks: { MPALG: "Security" } };
    const inYear4 = planned({ programme: "TKITE", start: 2024, year: 4 }, memory);
    const step = plannerStep(inYear4, { type: "showYear", year: 5 });

    expect(step.search.track).toBe("Security");
    expect(rememberedAfter(step, memory)?.last).toEqual({ programme: "TKITE", start: 2024, year: 5, track: "Security" });
  });

  it("opens year 4 with the track this device chose in the master's programme", () => {
    const memory = { ...MEMORY, tracks: { MPALG: "Security" } };
    const step = plannerStep(planned({ programme: "TKITE", start: 2024, year: 4 }, memory), { type: "chooseMaster", master: "MPALG" });

    expect(step.search.track).toBe("Security");
  });

  it("opens year 4 with that year's remembered picks when choosing a master's programme, and remembers the choice", () => {
    const step = plannerStep(choosing, { type: "chooseMaster", master: "MPALG" });

    expect(step.search).toStrictEqual({
      start: 2024,
      year: 4,
      master: "MPALG",
      track: undefined,
      period: undefined,
      picked: ["DAT060.LP1"],
    });
    expect(rememberedAfter(step, MEMORY)).toEqual({
      ...MEMORY,
      masters: { TKITE: "MPALG" },
      last: { programme: "TKITE", start: 2024, year: 4 },
    });
  });

  it("remembers the master's programme of each programme apart", () => {
    const stored: PlannerMemory = { ...MEMORY, masters: { TKDAT: "MPCSC" } };

    expect(rememberedAfter(plannerStep(choosing, { type: "chooseMaster", master: "MPALG" }), stored)?.masters).toEqual({
      TKDAT: "MPCSC",
      TKITE: "MPALG",
    });
  });

  it("opens year 4 without picks in the link when the chosen master's programme has none remembered", () => {
    expect(plannerStep(choosing, { type: "chooseMaster", master: "MPCSC" }).search.picked).toBeUndefined();
  });

  it("forgets the master's programme when leaving it, and keeps its picks", () => {
    const step = plannerStep(viewing, { type: "chooseMaster", master: undefined });

    expect(step.search).toStrictEqual({
      start: 2024,
      year: 4,
      master: undefined,
      track: undefined,
      period: undefined,
      picked: undefined,
    });
    expect(rememberedAfter(step, WITH_MPALG)).toEqual({
      ...MEMORY,
      masters: {},
      last: { programme: "TKITE", start: 2024, year: 4 },
    });
  });

  it("remembers the start year and clears the track and period when the start year changes", () => {
    const step = plannerStep(viewing, { type: "showStart", start: 2025 });

    expect(step.search).toStrictEqual({ start: 2025, track: undefined, period: undefined });
    expect(rememberedAfter(step, MEMORY)).toEqual({
      ...MEMORY,
      starts: { TKITE: 2025 },
      last: { programme: "TKITE", start: 2025, year: 3 },
    });
  });

  it("remembers the start year of each programme apart", () => {
    const stored: PlannerMemory = { ...MEMORY, starts: { TKDAT: 2023 } };

    expect(rememberedAfter(plannerStep(viewing, { type: "showStart", start: 2025 }), stored)?.starts).toEqual({ TKDAT: 2023, TKITE: 2025 });
  });

  it("remembers the picks and keeps the list on its period when a course is picked", () => {
    const step = plannerStep(viewing, { type: "setPicks", keys: ["TDA357.LP2", "TDA555.LP3"], period: "LP3" });

    expect(step.search).toStrictEqual({ period: "LP3", picked: ["TDA357.LP2", "TDA555.LP3"] });
    expect(rememberedAfter(step, MEMORY)).toEqual({
      ...MEMORY,
      picks: { ...MEMORY.picks, "TKITE.3": ["TDA357.LP2", "TDA555.LP3"] },
      last: { programme: "TKITE", start: 2024, year: 3, track: "AI" },
    });
  });

  it("remembers the picks of a year of the master's programme under the master's programme", () => {
    const inMaster = planned({ programme: "TKITE", start: 2024, year: 4, master: "MPALG" });
    const step = plannerStep(inMaster, { type: "setPicks", keys: ["DAT060.LP1", "DAT061.LP2"], period: "LP2" });

    expect(rememberedAfter(step, MEMORY)?.picks).toEqual({ ...MEMORY.picks, "MPALG.1": ["DAT060.LP1", "DAT061.LP2"] });
    expect(rememberedAfter(step, MEMORY)?.last).toEqual({ programme: "TKITE", start: 2024, year: 4 });
  });

  it("clears the picks without moving the list, and forgets the year's picks", () => {
    const step = plannerStep(viewing, { type: "setPicks", keys: [] });

    expect(step.search).toStrictEqual({ picked: undefined });
    expect(rememberedAfter(step, MEMORY)?.picks).toEqual({ "TKITE.2": ["DAT026.LP1"], "MPALG.1": ["DAT060.LP1"] });
  });

  it("changes what the list shows in the link alone", () => {
    const step = plannerStep(viewing, { type: "view", changes: { sort: "passRate", dir: undefined } });

    expect(step.search).toStrictEqual({ sort: "passRate", dir: undefined });
    expect(step.remember).toBeUndefined();
  });

  it.each<[string, PlannerAction, PlannerMemory["last"]]>([
    ["showing a year", { type: "showYear", year: 2 }, { programme: "TKITE", start: 2024, year: 2 }],
    ["showing a track", { type: "showTrack", track: "Web" }, { programme: "TKITE", start: 2024, year: 3, track: "Web" }],
    ["choosing a master's programme", { type: "chooseMaster", master: "MPCSC" }, { programme: "TKITE", start: 2024, year: 4 }],
    ["showing a start year", { type: "showStart", start: 2025 }, { programme: "TKITE", start: 2025, year: 3 }],
    ["picking courses", { type: "setPicks", keys: ["TDA357.LP2"] }, { programme: "TKITE", start: 2024, year: 3, track: "AI" }],
  ])("stores the view shown after %s as the one last worked on", (_, action, last) => {
    expect(rememberedAfter(plannerStep(viewing, action), MEMORY)?.last).toEqual(last);
  });

  it("changes the memory as it is stored when the step happens, not as it was when the page rendered", () => {
    const stored: PlannerMemory = { ...MEMORY, picks: { ...MEMORY.picks, "TKDAT.3": ["EDA061.LP1"] }, starts: { TKDAT: 2023 } };

    const next = rememberedAfter(plannerStep(viewing, { type: "setPicks", keys: ["TDA555.LP3"] }), stored);

    expect(next?.picks).toEqual({ ...stored.picks, "TKITE.3": ["TDA555.LP3"] });
    expect(next?.starts).toEqual({ TKDAT: 2023 });
  });
});
