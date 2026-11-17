import { describe, expect, it } from "vitest";
import { otherPicks, parsePlannerMemory, rememberedPicks, withMaster, withPicks, withStart } from "./planner-memory.ts";
import { studyYears, type ProgrammePlan } from "./programme-plans.ts";

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

/** A plan with empty years. */
const plan = (code: string, years: number[]): ProgrammePlan => ({
  code,
  name: code,
  choices: [],
  requirements: [],
  masters: [],
  prerequisites: [],
  years: years.map((year) => ({ year, courses: [] })),
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
    expect(otherPicks(memory, studyYears(plan("TKITE", [1, 2, 3]), plan("MPALG", [1, 2])), 2)).toEqual([
      { number: 1, programme: "TKITE", year: 1, key: "EDA344.LP1" },
      { number: 4, programme: "MPALG", year: 1, key: "DAT060.LP1" },
    ]);
  });
});
