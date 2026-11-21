import { describe, expect, it } from "vitest";
import {
  openProgramme,
  otherPicks,
  parsePlannerMemory,
  plannerCohort,
  plannerStep,
  rememberedPicks,
  resolvePlanner,
  withMaster,
  withPicks,
  withStart,
  type PlannerAction,
  type PlannerMemory,
  type PlannerSearch,
} from "./planner-state.ts";
import {
  planCourseSchema,
  programmePlanSchema,
  publishedPlanInfoSchema,
  studyYears,
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
    };
    expect(parsePlannerMemory(JSON.stringify(memory))).toEqual(memory);
  });

  it("keeps the picks of a memory stored before it held master's programmes and start years", () => {
    const stored = { last: { programme: "TKITE" }, picks: { "TKITE.3": ["TDA357.LP2"] } };
    expect(parsePlannerMemory(JSON.stringify(stored))).toEqual({ ...stored, masters: {}, starts: {} });
  });

  it("starts empty when nothing is stored, or when what is stored is not a memory", () => {
    expect(parsePlannerMemory(null)).toEqual({ picks: {}, masters: {}, starts: {} });
    expect(parsePlannerMemory("not json")).toEqual({ picks: {}, masters: {}, starts: {} });
    expect(parsePlannerMemory(JSON.stringify({ picks: ["TDA357.LP2"] }))).toEqual({ picks: {}, masters: {}, starts: {} });
  });
});

describe("withPicks", () => {
  const memory = { last: { programme: "TKITE" }, picks: { "TKITE.2": ["DAT026.LP1"] }, masters: {}, starts: {} };

  it("remembers the picks of a year beside those of other years", () => {
    const next = withPicks(memory, "TKITE", 3, ["TDA357.LP2"]);

    expect(next.picks).toEqual({ "TKITE.2": ["DAT026.LP1"], "TKITE.3": ["TDA357.LP2"] });
    expect(rememberedPicks(next, "TKITE", 3)).toEqual(["TDA357.LP2"]);
    expect(rememberedPicks(next, "TKDAT", 3)).toBeUndefined();
  });

  it("forgets a year whose picks are cleared", () => {
    expect(withPicks(memory, "TKITE", 2, []).picks).toEqual({});
  });
});

describe("withMaster", () => {
  const memory = { picks: { "MPALG.1": ["DAT060.LP1"] }, masters: { TKDAT: "MPCSC" }, starts: {} };

  it("remembers the master's programme of each programme apart", () => {
    expect(withMaster(memory, "TKITE", "MPALG").masters).toEqual({ TKDAT: "MPCSC", TKITE: "MPALG" });
  });

  it("forgets the master's programme but keeps its picks, for when it is chosen again", () => {
    expect(withMaster({ ...memory, masters: { TKITE: "MPALG" } }, "TKITE", undefined)).toEqual({
      picks: memory.picks,
      masters: {},
      starts: {},
    });
  });
});

describe("withStart", () => {
  it("remembers the start year of each programme apart", () => {
    const memory = { picks: {}, masters: {}, starts: { TKDAT: 2023 } };
    expect(withStart(memory, "TKITE", 2024).starts).toEqual({ TKDAT: 2023, TKITE: 2024 });
    expect(withStart(memory, "TKDAT", 2025).starts).toEqual({ TKDAT: 2025 });
  });
});

describe("otherPicks", () => {
  const memory = {
    picks: {
      "TKITE.1": ["EDA344.LP1"],
      "TKITE.2": ["DAT026.LP1"],
      "MPALG.1": ["DAT060.LP1"],
      "TKDAT.1": ["OTHER.LP1"],
      "MPCSC.1": ["OTHER.LP2"],
    },
    masters: {},
    starts: {},
  };

  it("returns the picks of the other years of the programme and of its master's programme, numbered as years of study", () => {
    const years = studyYears(plan("TKITE", { 1: [], 2: [], 3: [] }), plan("MPALG", { 1: [], 2: [] }));
    expect(otherPicks(memory, years, 2)).toEqual([
      { number: 1, programme: "TKITE", year: 1, key: "EDA344.LP1" },
      { number: 4, programme: "MPALG", year: 1, key: "DAT060.LP1" },
    ]);
  });
});

describe("openProgramme", () => {
  it("makes the programme the one last worked on, forgetting the start year, year and track of the one before", () => {
    const memory: PlannerMemory = {
      last: { programme: "TKITE", start: 2024, year: 3, track: "AI" },
      picks: { "TKITE.3": ["TDA357.LP2"] },
      masters: { TKITE: "MPALG" },
      starts: { TKITE: 2024 },
    };

    expect(openProgramme("TKDAT")(memory)).toEqual({ ...memory, last: { programme: "TKDAT" } });
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
const MPALG = plan("MPALG", { 1: [course("DAT060")], 2: [course("TDA352", { track: "Security" })] });
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
  accreditations: { TKITE: [{ code: "MPALG", specialisations: ["Algorithms"] }] },
  masters: {
    MPALG: {
      courseList: "https://example.com/mpalg.pdf",
      unplanned: [
        { year: 1, names: ["New course"] },
        { year: 2, names: ["Newer course"] },
      ],
    },
  },
});

/** What this device remembers: picks in years of both the programme and a master's programme, and no choices of degree. */
const MEMORY: PlannerMemory = {
  last: { programme: "TKITE", start: 2024, year: 3 },
  picks: { "TKITE.2": ["DAT026.LP1"], "TKITE.3": ["TDA357.LP2"], "MPALG.1": ["DAT060.LP1"] },
  masters: {},
  starts: {},
};
const WITH_MPALG: PlannerMemory = { ...MEMORY, masters: { TKITE: "MPALG" } };

function resolve(search: PlannerSearch, memory = MEMORY, info = INFO) {
  const cohort = plannerCohort(info, search, memory);
  return resolvePlanner({ search, memory, cohort, plans: [TKITE], masterPlans: [MPALG, MPCSC, MPSEC], programmes: NAMES });
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

    expect(state.start).toBe(2024);
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

  it("offers the tracks of the year shown, and shows the one in the link when the year has it", () => {
    expect(planned({ programme: "TKITE", year: 3, track: "AI" })).toMatchObject({ tracks: ["AI", "Web"], track: "AI" });
    expect(planned({ programme: "TKITE", year: 3, track: "Nope" })).toMatchObject({ tracks: ["AI", "Web"], track: undefined });
    expect(planned({ programme: "TKITE", year: 2 }).tracks).toEqual([]);
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

  it("remembers the picks of the other years of study, the master's programme's too", () => {
    const state = planned({ programme: "TKITE", year: 3 }, WITH_MPALG);

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
      expect(state.masterAccreditation).toEqual({ specialisations: ["Algorithms"], courseList: "https://example.com/mpalg.pdf" });
    });

    it("lists the courses of the master's programme's year that no plan gives", () => {
      const first = planned({ programme: "TKITE", start: 2024, master: "MPALG", year: 4 }, MEMORY, info);
      const second = planned({ programme: "TKITE", start: 2024, master: "MPALG", year: 5 }, MEMORY, info);

      expect(first.unplanned).toEqual(["New course"]);
      expect(second.unplanned).toEqual(["Newer course"]);
    });

    it("lists none in a year of the programme itself", () => {
      expect(planned({ programme: "TKITE", start: 2024, master: "MPALG", year: 3 }, MEMORY, info).unplanned).toBeUndefined();
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

  it("shows another track, and remembers it", () => {
    const step = plannerStep(viewing, { type: "showTrack", track: "Web" });

    expect(step.search).toStrictEqual({ track: "Web" });
    expect(rememberedAfter(step, MEMORY)).toEqual({ ...MEMORY, last: { programme: "TKITE", start: 2024, year: 3, track: "Web" } });
  });

  it("shows all tracks by forgetting the track", () => {
    const step = plannerStep(viewing, { type: "showTrack", track: undefined });

    expect(step.search).toStrictEqual({ track: undefined });
    expect(rememberedAfter(step, MEMORY)?.last).toEqual({ programme: "TKITE", start: 2024, year: 3 });
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
    expect(plannerStep(viewing, action).remember?.(MEMORY).last).toEqual(last);
  });

  it("changes the memory as it is stored when the step happens, not as it was when the page rendered", () => {
    const stored: PlannerMemory = { ...MEMORY, picks: { ...MEMORY.picks, "TKDAT.3": ["EDA061.LP1"] }, starts: { TKDAT: 2023 } };

    const next = plannerStep(viewing, { type: "setPicks", keys: ["TDA555.LP3"] }).remember?.(stored);

    expect(next?.picks).toEqual({ ...stored.picks, "TKITE.3": ["TDA555.LP3"] });
    expect(next?.starts).toEqual({ TKDAT: 2023 });
  });
});
