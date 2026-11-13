import { describe, expect, it } from "vitest";
import { toCatalogCourse } from "./catalog.ts";
import { emptyCounts } from "./grades.ts";
import {
  candidatesIn,
  creditsIn,
  exclusiveWith,
  firstOpenPeriod,
  lectureClash,
  periodsOf,
  pickProgress,
  plannerYear,
  searchProgrammes,
  togglePick,
} from "./planner.ts";
import { roundKey, type PlanChoice, type PlanRound, type StudyPeriod } from "./programme-plans.ts";

const REQUIREMENTS = {
  compulsory: { kind: "compulsory", rank: 0, label: "Compulsory" },
  elective: { kind: "elective", rank: 2, label: "Elective" },
  thesis: { kind: "thesis", rank: 3, label: "Diploma thesis" },
} as const;

const pickTwo: PlanChoice = { id: 1, kind: "pick", text: null, minCourses: 2, minCredits: null };
const pickCredits: PlanChoice = { id: 2, kind: "pick", text: null, minCourses: null, minCredits: 15 };
const onlyOne: PlanChoice = { id: 3, kind: "exclusive", text: null, minCourses: null, minCredits: null };

/** A 7.5 credit elective in the given study periods, split evenly over them. */
const round = (code: string, periods: StudyPeriod[], overrides: Partial<PlanRound> = {}): PlanRound => {
  const credits = overrides.credits ?? 7.5;
  return {
    key: roundKey(code, periods),
    codes: [code],
    name: `${code} name`,
    credits,
    periods,
    periodCredits: periods.map(() => credits / periods.length),
    block: null,
    requirement: REQUIREMENTS.elective,
    choices: [],
    ...overrides,
  };
};

const stats = (code: string, passed: number, failed: number, overallAnswers: number[] | null = null) =>
  toCatalogCourse({
    code,
    name: `${code} name`,
    programme: null,
    recentGrades: { ...emptyCounts(), "3": passed, U: failed },
    attemptsPerYear: passed + failed,
    lastResult: null,
    ended: false,
    trend: [],
    overallAnswers,
  });

const keys = (rounds: readonly PlanRound[]) => rounds.map((r) => r.key);

describe("plannerYear", () => {
  const compulsory = round("EDA322", ["LP1"], { requirement: REQUIREMENTS.compulsory });
  const elective = round("TDA357", ["LP2"]);
  const thesis = (code: string, periods: StudyPeriod[], credits: number) =>
    round(code, periods, { credits, requirement: REQUIREMENTS.thesis });

  it("fixes the compulsory rounds and leaves the rest to choose between, each with its course's results", () => {
    const results = new Map([["TDA357", stats("TDA357", 9, 1)]]);
    const { fixed, candidates } = plannerYear([compulsory, elective], results);

    expect(keys(fixed)).toEqual(["EDA322.LP1"]);
    expect(candidates.map((r) => [r.key, r.stats?.passRate])).toEqual([["TDA357.LP2", 0.9]]);
  });

  it("fixes the thesis when every thesis course fills the year alike, as one round under the rule's name", () => {
    const { fixed, candidates } = plannerYear(
      [compulsory, elective, thesis("DATX11", ["LP3", "LP4"], 15), thesis("EENX16", ["LP3", "LP4"], 15)],
      new Map([["DATX11", stats("DATX11", 9, 1)]]),
    );

    expect(keys(candidates)).toEqual(["TDA357.LP2"]);
    expect(fixed.map((r) => [r.key, r.name, r.codes, r.stats])).toEqual([
      ["EDA322.LP1", "EDA322 name", ["EDA322"], undefined],
      ["DATX11.LP3-LP4", "Diploma thesis", ["DATX11", "EENX16"], undefined],
    ]);
  });

  it("keeps a single thesis course under its own name", () => {
    const { fixed } = plannerYear([thesis("DATX11", ["LP3", "LP4"], 15)], new Map());
    expect(fixed.map((r) => r.name)).toEqual(["DATX11 name"]);
  });

  it("leaves the thesis to choose when it can be done in several ways", () => {
    const { fixed, candidates } = plannerYear(
      [thesis("DATX05", ["LP3", "LP4"], 30), thesis("EENX30", ["LP3", "LP4"], 30), thesis("DATX60", ["LP1", "LP2", "LP3", "LP4"], 60)],
      new Map(),
    );

    expect(fixed).toEqual([]);
    expect(candidates.map((r) => [r.key, r.codes])).toEqual([
      ["DATX05.LP3-LP4", ["DATX05", "EENX30"]],
      ["DATX60.LP1-LP2-LP3-LP4", ["DATX60"]],
    ]);
  });
});

describe("creditsIn", () => {
  it("counts what each round gives in the study period, not the whole of a round that runs over several", () => {
    const plan = [round("DAT026", ["LP1"]), round("LSP530", ["LP1", "LP2"], { periodCredits: [3.5, 4] }), round("TDA357", ["LP3"])];

    expect(creditsIn(plan, "LP1")).toBe(11);
    expect(creditsIn(plan, "LP2")).toBe(4);
    expect(creditsIn(plan, "LP4")).toBe(0);
  });
});

describe("periodsOf and firstOpenPeriod", () => {
  const plan = [round("A", ["LP1"]), round("B", ["LP1"]), round("C", ["LP3", "LP4"])];

  it("lists the study periods some round runs in, in calendar order", () => {
    expect(periodsOf(plan.toReversed())).toEqual(["LP1", "LP3", "LP4"]);
  });

  it("starts in the first study period with room, or the first of all in a full year", () => {
    expect(firstOpenPeriod(["LP1", "LP2", "LP3"], plan)).toBe("LP2");
    expect(firstOpenPeriod(["LP1"], plan)).toBe("LP1");
  });
});

describe("candidatesIn", () => {
  const candidates = [round("NEW", ["LP3", "LP4"]), round("EASY", ["LP3"]), round("LIKED", ["LP3"]), round("EARLY", ["LP1"])].map((r) => ({
    ...r,
    stats: { EASY: stats("EASY", 9, 1, [0, 0, 1, 0, 0]), LIKED: stats("LIKED", 5, 5, [0, 0, 0, 0, 1]) }[r.codes[0]!],
  }));

  it("lists the rounds that run in the study period, the best first, with rounds without results last", () => {
    expect(keys(candidatesIn(candidates, "LP3", "rating"))).toEqual(["LIKED.LP3", "EASY.LP3", "NEW.LP3-LP4"]);
    expect(keys(candidatesIn(candidates, "LP3", "passRate"))).toEqual(["EASY.LP3", "LIKED.LP3", "NEW.LP3-LP4"]);
    expect(keys(candidatesIn(candidates, "LP4", "rating"))).toEqual(["NEW.LP3-LP4"]);
  });
});

describe("togglePick", () => {
  const lp2 = round("TDA357", ["LP2"]);
  const lp3 = round("TDA357", ["LP3"]);
  const other = round("DAT026", ["LP1"]);
  const candidates = [lp2, lp3, other];

  it("adds a round and removes it again", () => {
    expect(togglePick(["DAT026.LP1"], lp2, candidates)).toEqual(["DAT026.LP1", "TDA357.LP2"]);
    expect(togglePick(["DAT026.LP1", "TDA357.LP2"], lp2, candidates)).toEqual(["DAT026.LP1"]);
  });

  it("moves a course when another of its rounds is added", () => {
    expect(togglePick(["TDA357.LP2", "DAT026.LP1"], lp3, candidates)).toEqual(["DAT026.LP1", "TDA357.LP3"]);
  });
});

describe("lectureClash", () => {
  const algorithms = round("TIN093", ["LP3"], { block: "A+" });

  it("finds a course in the same block and study period, a block with extra hours included", () => {
    const concurrency = round("TDA384", ["LP3"], { block: "A" });
    expect(lectureClash(concurrency, [round("DAT341", ["LP3"], { block: "B" }), algorithms])).toBe(algorithms);
  });

  it("finds none in another study period, without a block, or against the course's own other round", () => {
    expect(lectureClash(round("TDA384", ["LP1"], { block: "A" }), [algorithms])).toBeUndefined();
    expect(lectureClash(round("TDA553", ["LP3"]), [algorithms, round("DAT600", ["LP3"])])).toBeUndefined();
    expect(lectureClash(round("TIN093", ["LP3"], { block: "A" }), [algorithms])).toBeUndefined();
  });

  it("sees a clash in any study period two longer courses share", () => {
    const thesis = round("DATX11", ["LP3", "LP4"], { block: "C" });
    expect(lectureClash(round("TEK571", ["LP4"], { block: "C" }), [thesis])).toBe(thesis);
  });
});

describe("exclusiveWith", () => {
  it("finds the other course of a choice where only one counts", () => {
    const databases = round("TDA357", ["LP2"], { choices: [onlyOne] });
    const dataManagement = round("DAT335", ["LP3"], { choices: [onlyOne, pickTwo] });

    expect(exclusiveWith(dataManagement, [round("DAT026", ["LP1"], { choices: [pickTwo] }), databases])).toBe(databases);
    expect(exclusiveWith(round("DAT026", ["LP1"], { choices: [pickTwo] }), [dataManagement])).toBeUndefined();
  });
});

describe("pickProgress", () => {
  const picked = [
    round("A", ["LP1"], { choices: [pickTwo, pickCredits] }),
    round("B", ["LP2"], { choices: [pickCredits] }),
    round("C", ["LP3"]),
  ];

  it("counts the picked courses of a choice that asks for a number of courses", () => {
    expect(pickProgress(pickTwo, picked)).toEqual({ have: 1, need: 2, unit: "courses", done: false });
  });

  it("counts credits for a choice that asks for credits", () => {
    expect(pickProgress(pickCredits, picked)).toEqual({ have: 15, need: 15, unit: "credits", done: true });
  });
});

describe("searchProgrammes", () => {
  const programmes = [
    { code: "TKITE", name: "Software Engineering" },
    { code: "TKDAT", name: "Computer Science and Engineering" },
    { code: "MPALG", name: "Computer Science - Algorithms, Languages and Logic" },
  ];
  const swedish = { TKITE: "Informationsteknik, civilingenjör", TKDAT: "Datateknik, civilingenjör" };
  const found = (query: string) => searchProgrammes(programmes, swedish, query).map((p) => p.code);

  it("finds a programme by code, by name and by Swedish name, whatever the case and accents", () => {
    expect(found("tkite")).toEqual(["TKITE"]);
    expect(found("computer science")).toEqual(["MPALG", "TKDAT"]);
    expect(found("Informationsteknik")).toEqual(["TKITE"]);
    expect(found("civilingenjor data")).toEqual(["TKDAT"]);
  });

  it("lists every programme by name without a query", () => {
    expect(found(" ")).toEqual(["MPALG", "TKDAT", "TKITE"]);
  });
});
