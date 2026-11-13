import { describe, expect, it } from "vitest";
import { otherPicks, parsePlannerMemory, rememberedPicks, withPicks } from "./planner-memory.ts";

describe("parsePlannerMemory", () => {
  it("reads back what was stored", () => {
    const memory = { last: { programme: "TKITE", year: 3 }, picks: { "TKITE.3": ["TDA357.LP2"] } };
    expect(parsePlannerMemory(JSON.stringify(memory))).toEqual(memory);
  });

  it("starts empty when nothing is stored, or when what is stored is not a memory", () => {
    expect(parsePlannerMemory(null)).toEqual({ picks: {} });
    expect(parsePlannerMemory("not json")).toEqual({ picks: {} });
    expect(parsePlannerMemory(JSON.stringify({ picks: ["TDA357.LP2"] }))).toEqual({ picks: {} });
  });
});

describe("withPicks", () => {
  const memory = { last: { programme: "TKITE" }, picks: { "TKITE.2": ["DAT026.LP1"] } };

  it("remembers the picks of a year beside those of other years", () => {
    const next = withPicks(memory, "TKITE", 3, ["TDA357.LP2"]);

    expect(next).toEqual({ last: { programme: "TKITE" }, picks: { "TKITE.2": ["DAT026.LP1"], "TKITE.3": ["TDA357.LP2"] } });
    expect(rememberedPicks(next, "TKITE", 3)).toEqual(["TDA357.LP2"]);
    expect(rememberedPicks(next, "TKDAT", 3)).toBeUndefined();
  });

  it("forgets a year whose picks are cleared", () => {
    expect(withPicks(memory, "TKITE", 2, []).picks).toEqual({});
  });
});

describe("otherPicks", () => {
  const memory = {
    picks: {
      "TKITE.1": ["EDA344.LP1"],
      "TKITE.2": ["DAT026.LP1"],
      "TKITE.3": ["TDA357.LP2"],
      "TKDAT.2": ["OTHER.LP1"],
    },
  };

  it("returns picks remembered for other years of the same programme", () => {
    expect(otherPicks(memory, "TKITE", 2)).toEqual([
      { year: 1, key: "EDA344.LP1" },
      { year: 3, key: "TDA357.LP2" },
    ]);
  });
});
