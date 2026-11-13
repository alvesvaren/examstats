import { describe, expect, it } from "vitest";
import { toCatalogCourse } from "./catalog.ts";
import { emptyCounts } from "./grades.ts";
import {
  candidatesIn,
  creditsIn,
  exclusiveWith,
  findElsewhere,
  firstOpenPeriod,
  lectureClash,
  masterSummary,
  openRequirements,
  periodsOf,
  pickProgress,
  plannerYear,
  requirementProgress,
  searchProgrammes,
  otherNameOf,
  togglePick,
} from "./planner.ts";
import {
  roundKey,
  type PlanChoice,
  type PlanCourse,
  type PlanRequirement,
  type PlanRound,
  type ProgrammePlan,
  type StudyPeriod,
} from "./programme-plans.ts";

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
    themes: [],
    requirement: REQUIREMENTS.elective,
    choices: [],
    ...overrides,
  };
};

const stats = (code: string, passed: number, failed: number, overallAnswers: number[] | null = null) =>
  toCatalogCourse({
    code,
    name: `${code} name`,
    swedishName: `${code} namn`,
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

describe("findElsewhere", () => {
  const lp2 = round("TDA357", ["LP2"]);
  const lp3 = round("TDA357", ["LP3"]);

  it("finds another round of the same course in the current year", () => {
    expect(findElsewhere(lp3, [lp2], [])).toEqual({ periods: ["LP2"] });
  });

  it("does not report elsewhere for the round that is picked itself", () => {
    expect(findElsewhere(lp2, [lp2], [])).toBeUndefined();
  });

  it("finds the course when picked in another year", () => {
    expect(findElsewhere(lp2, [], [{ number: 2, key: "TDA357.LP3" }])).toEqual({ year: 2, periods: ["LP3"] });
  });

  it("returns undefined when the course is not picked anywhere", () => {
    expect(findElsewhere(lp2, [], [{ number: 2, key: "DAT026.LP1" }])).toBeUndefined();
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

/** A plan entry of 7.5 credits in LP1 under a rule, with the credits it gives in themes. */
const planCourse = (code: string, rule: string, themes: PlanCourse["themes"] = []): PlanCourse => ({
  code,
  name: `${code} name`,
  credits: 7.5,
  periods: ["LP1"],
  periodCredits: [7.5],
  rule,
  track: null,
  block: null,
  choices: [],
  themes,
  examiners: [],
});

describe("degree requirements", () => {
  const mts: PlanRequirement = { kind: "theme", theme: "mts", minCredits: 7.5 };
  const environment: PlanRequirement = { kind: "theme", theme: "environment", minCredits: 7.5 };
  const science: PlanRequirement = { kind: "courses", courses: ["FFY621", "TIF223", "FFR105"], minCourses: 1 };
  const interfaces = planCourse("DAT216", "O", [{ theme: "mts", credits: 3 }]);
  const agile = planCourse("DAT257", "O", [{ theme: "mts", credits: 1.5 }]);
  const sustainability = planCourse("TEK830", "O", [{ theme: "environment", credits: 7.5 }]);
  const games = planCourse("DAT510", "V", [{ theme: "mts", credits: 3 }]);
  const physics = planCourse("TIF223", "V", [{ theme: "environment", credits: 1.5 }]);

  it("counts the credits a course gives in the theme, not the credits of the course", () => {
    expect(requirementProgress(mts, [interfaces, agile, physics])).toEqual({ have: 4.5, need: 7.5, unit: "credits", done: false });
    expect(requirementProgress(mts, [interfaces, agile, games])).toEqual({ have: 7.5, need: 7.5, unit: "credits", done: true });
  });

  it("counts the courses of a list the degree needs some of", () => {
    expect(requirementProgress(science, [interfaces])).toEqual({ have: 0, need: 1, unit: "courses", done: false });
    expect(requirementProgress(science, [interfaces, physics])).toEqual({ have: 1, need: 1, unit: "courses", done: true });
  });

  const tkite: ProgrammePlan = {
    code: "TKITE",
    name: "Software Engineering",
    choices: [],
    requirements: [environment, mts, science],
    masters: ["MPSOF"],
    prerequisites: [],
    years: [
      { year: 1, courses: [interfaces] },
      { year: 2, courses: [agile, games] },
      { year: 3, courses: [sustainability, physics] },
    ],
  };

  it("keeps the requirements that the compulsory courses do not meet on their own", () => {
    expect(openRequirements([tkite])).toEqual([mts, science]);
  });

  it("keeps a requirement the programme's compulsory courses do not meet, also when the master's programme's meet it, so it shows as met", () => {
    const ethics = planCourse("TDA602", "O", [{ theme: "mts", credits: 3 }]);
    const mpsof: ProgrammePlan = { ...tkite, code: "MPSOF", requirements: [], masters: [], years: [{ year: 1, courses: [ethics] }] };
    expect(openRequirements([tkite, mpsof])).toEqual([mts, science]);
    expect(requirementProgress(mts, [interfaces, agile, ethics])).toMatchObject({ have: 7.5, done: true });
  });
});

/** An elective in the given choices of its programme. */
const withChoices = (code: string, choices: number[]) => ({ ...planCourse(code, "V"), choices });

describe("pickProgress", () => {
  const tkdat: ProgrammePlan = {
    code: "TKDAT",
    name: "Computer Science and Engineering",
    choices: [pickTwo, pickCredits],
    requirements: [],
    masters: [],
    prerequisites: [],
    years: [
      { year: 2, courses: [withChoices("TDA357", [])] },
      {
        year: 3,
        courses: [withChoices("TDA357", [pickTwo.id]), withChoices("A", [pickTwo.id, pickCredits.id]), withChoices("B", [pickCredits.id])],
      },
    ],
  };

  it("counts the planned courses of a choice that asks for a number of courses", () => {
    expect(pickProgress(pickTwo, tkdat, [withChoices("A", [1]), withChoices("C", [])])).toEqual({
      have: 1,
      need: 2,
      unit: "courses",
      done: false,
    });
  });

  it("counts credits for a choice that asks for credits", () => {
    expect(pickProgress(pickCredits, tkdat, [withChoices("A", []), withChoices("B", [])])).toEqual({
      have: 15,
      need: 15,
      unit: "credits",
      done: true,
    });
  });

  it("counts a course of the choice planned in a year where the plan lists it outside the choice", () => {
    const databasesInYear2 = withChoices("TDA357", []);
    expect(pickProgress(pickTwo, tkdat, [databasesInYear2, withChoices("A", [])])).toMatchObject({ have: 2, done: true });
  });
});

describe("masterSummary", () => {
  const mpalg: ProgrammePlan = {
    code: "MPALG",
    name: "Computer Science - Algorithms, Languages and Logic",
    choices: [],
    requirements: [],
    masters: [],
    prerequisites: [],
    years: [
      {
        year: 1,
        courses: [
          planCourse("TDA251", "O"),
          planCourse("DAT060", "V"),
          { ...planCourse("DAT151", "V"), track: "Languages" },
          { ...planCourse("TDA507", "O"), track: "Algorithms" },
        ],
      },
      { year: 2, courses: [planCourse("DAT060", "V"), { ...planCourse("DATX05", "X"), credits: 30 }] },
    ],
  };

  it("sums up the tracks, the courses every student takes, and the courses to choose, each once", () => {
    const { tracks, compulsory, compulsoryCredits, electives } = masterSummary(mpalg, new Map());
    expect({ tracks, compulsory: compulsory.map((c) => c.code), compulsoryCredits, electives }).toEqual({
      tracks: ["Algorithms", "Languages"],
      compulsory: ["TDA251"],
      compulsoryCredits: 7.5,
      electives: 2,
    });
  });

  it("gives the mean pass rate and rating of its courses with results, each course alike", () => {
    const results = new Map([
      ["TDA251", stats("TDA251", 9, 1, [0, 0, 0, 0, 4])],
      ["DAT060", stats("DAT060", 1, 1, [0, 0, 4, 0, 0])],
      ["DAT151", stats("DAT151", 3, 1)],
    ]);
    const { passRate, rating } = masterSummary(mpalg, results);
    expect(passRate).toBeCloseTo((0.9 + 0.5 + 0.75) / 3);
    expect(rating).toBeCloseTo((5 + 3) / 2);
  });

  it("has no pass rate or rating when none of its courses has results", () => {
    expect(masterSummary(mpalg, new Map())).toMatchObject({ passRate: null, rating: null });
  });
});

describe("searchProgrammes", () => {
  const programmes = [
    { code: "TKITE", name: "Software Engineering" },
    { code: "TKDAT", name: "Computer Science and Engineering" },
    { code: "MPALG", name: "Computer Science - Algorithms, Languages and Logic" },
  ];
  const names = {
    TKITE: { name: "Software Engineering", otherName: "Informationsteknik, civilingenjör" },
    TKDAT: { name: "Computer Science and Engineering", otherName: "Datateknik, civilingenjör" },
  };
  const found = (query: string) => searchProgrammes(programmes, names, query).map((p) => p.code);

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

describe("otherNameOf", () => {
  const names = {
    TKDAT: { name: "Computer Science and Engineering", otherName: "Datateknik" },
    MPSOF: { name: "Software Engineering and Technology", otherName: "Software engineering and technology" },
  };

  it("gives the name in the other language only when it differs", () => {
    expect(["TKDAT", "MPSOF", "MBATT"].map((code) => otherNameOf(names, code))).toEqual(["Datateknik", undefined, undefined]);
  });
});
