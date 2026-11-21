import { describe, expect, it } from "vitest";
import { toCatalogCourse } from "./catalog.ts";
import type { SurveyAnswers } from "./evaluation.ts";
import { emptyCounts } from "./grades.ts";
import {
  candidatesIn,
  creditsIn,
  exclusiveWith,
  findElsewhere,
  firstOpenPeriod,
  lectureClash,
  masterSummary,
  periodsOf,
  plannerYear,
  searchProgrammes,
  togglePick,
  yearView,
} from "./planner.ts";
import {
  planCourseSchema,
  programmePlanSchema,
  roundKey,
  studyYears,
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
    seats: null,
    themes: [],
    requirement: REQUIREMENTS.elective,
    choices: [],
    ...overrides,
  };
};

const stats = (code: string, passed: number, failed: number, surveyAnswers: SurveyAnswers = {}) =>
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
    surveyAnswers,
    periods: [],
    examiners: [],
  });

const keys = (rounds: readonly PlanRound[]) => rounds.map((r) => r.key);

describe("plannerYear", () => {
  const compulsory = round("EDA322", ["LP1"], { requirement: REQUIREMENTS.compulsory });
  const elective = round("TDA357", ["LP2"]);
  const thesis = (code: string, periods: StudyPeriod[], credits: number, seats: number | null = null) =>
    round(code, periods, { credits, seats, requirement: REQUIREMENTS.thesis });

  it("fixes the compulsory rounds and leaves the rest to choose between, each with its course's results", () => {
    const results = new Map([["TDA357", stats("TDA357", 9, 1)]]);
    const { fixed, candidates } = plannerYear([compulsory, elective], results);

    expect(keys(fixed)).toEqual(["EDA322.LP1"]);
    expect(candidates.map((r) => [r.key, r.stats?.passRate])).toEqual([["TDA357.LP2", 0.9]]);
  });

  it("fixes the thesis when every thesis course fills the year alike, as one round under the rule's name with no seats", () => {
    const { fixed, candidates } = plannerYear(
      [compulsory, elective, thesis("DATX11", ["LP3", "LP4"], 15, 60), thesis("EENX16", ["LP3", "LP4"], 15)],
      new Map([["DATX11", stats("DATX11", 9, 1)]]),
    );

    expect(keys(candidates)).toEqual(["TDA357.LP2"]);
    expect(fixed.map((r) => [r.key, r.name, r.codes, r.stats, r.seats])).toEqual([
      ["EDA322.LP1", "EDA322 name", ["EDA322"], undefined, null],
      ["DATX11.LP3-LP4", "Diploma thesis", ["DATX11", "EENX16"], undefined, null],
    ]);
  });

  it("keeps a single thesis course under its own name, with its seats", () => {
    const { fixed } = plannerYear([thesis("DATX11", ["LP3", "LP4"], 15, 60)], new Map());
    expect(fixed.map((r) => [r.name, r.seats])).toEqual([["DATX11 name", 60]]);
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
    stats: {
      EASY: stats("EASY", 9, 1, { overall: [0, 0, 1, 0, 0], workload: [0, 0, 0, 1, 0] }),
      LIKED: stats("LIKED", 5, 5, { overall: [0, 0, 0, 0, 1], workload: [0, 0, 1, 0, 0] }),
    }[r.codes[0]!],
  }));

  it("lists the rounds that run in the study period, the best first, with rounds without results last", () => {
    expect(keys(candidatesIn(candidates, "LP3", "rating"))).toEqual(["LIKED.LP3", "EASY.LP3", "NEW.LP3-LP4"]);
    expect(keys(candidatesIn(candidates, "LP3", "passRate"))).toEqual(["EASY.LP3", "LIKED.LP3", "NEW.LP3-LP4"]);
    expect(keys(candidatesIn(candidates, "LP4", "rating"))).toEqual(["NEW.LP3-LP4"]);
  });

  it("lists the lightest workload first", () => {
    expect(keys(candidatesIn(candidates, "LP3", "workload"))).toEqual(["LIKED.LP3", "EASY.LP3", "NEW.LP3-LP4"]);
  });

  it("flips the order and keeps rounds without results last", () => {
    expect(keys(candidatesIn(candidates, "LP3", "rating", "asc"))).toEqual(["EASY.LP3", "LIKED.LP3", "NEW.LP3-LP4"]);
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
  modules: [],
  seats: null,
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
      ["TDA251", stats("TDA251", 9, 1, { overall: [0, 0, 0, 0, 4] })],
      ["DAT060", stats("DAT060", 1, 1, { overall: [0, 0, 4, 0, 0] })],
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

const entry = (code: string, rule: string, overrides: Partial<PlanCourse> = {}) =>
  planCourseSchema.parse({ ...planCourse(code, rule), ...overrides });
const planOf = (code: string, years: Record<number, PlanCourse[]>, overrides: Partial<ProgrammePlan> = {}) =>
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

/** The progress towards each rule of the degree, in the order the plans list them. */
const progressOf = (view: ReturnType<typeof yearView>) => {
  const [mtsProgress, scienceProgress, masterProgress] = view.degreeRules;
  return { mts: mtsProgress, science: scienceProgress, master: masterProgress };
};
const listedKeys = (view: ReturnType<typeof yearView>) => keys(view.listed.map((l) => l.round));

describe("yearView", () => {
  const mtsRule: PlanRequirement = { kind: "theme", theme: "mts", minCredits: 7.5 };
  const scienceRule: PlanRequirement = { kind: "courses", courses: ["MVE055"], minCourses: 1 };
  const masterRule: PlanRequirement = { kind: "courses", courses: ["DAT600"], minCourses: 1 };
  const mts = [{ theme: "mts", credits: 7.5 }] as const;

  const programme = planOf(
    "TKITE",
    {
      2: [
        entry("DAT100", "O", { block: "A" }),
        entry("DAT200", "V", { block: "A+" }),
        entry("DAT300", "V", { periods: ["LP2"], choices: [1], themes: [...mts] }),
        entry("DAT310", "V", { periods: ["LP2"], choices: [1, 3] }),
        entry("DAT320", "V", { periods: ["LP2"], choices: [3] }),
        entry("MVE055", "V", { periods: ["LP3"] }),
      ],
      3: [
        entry("DAT400", "O"),
        entry("DAT300", "V", { choices: [1] }),
        entry("DAT500", "V", { periods: ["LP2"], block: "B" }),
        entry("DAT510", "V", { periods: ["LP2"], block: "B+" }),
      ],
    },
    { choices: [pickTwo, onlyOne], requirements: [mtsRule, scienceRule] },
  );
  const master = planOf("MPALG", { 1: [entry("DAT550", "O"), entry("DAT600", "V")] }, { requirements: [masterRule] });

  const degree = studyYears(programme, master);
  const viewOf = (number: number, input: Partial<Parameters<typeof yearView>[0]> = {}) =>
    yearView({
      years: degree,
      current: degree.find((y) => y.number === number)!,
      track: undefined,
      pickedKeys: [],
      otherPicks: [],
      stats: new Map(),
      ruleNames: {},
      ...input,
    });
  it("splits the year into what every student takes and what to choose between, with the periods they run in", () => {
    const view = viewOf(2);

    expect(keys(view.fixed)).toEqual(["DAT100.LP1"]);
    expect(keys(view.candidates)).toEqual(["DAT200.LP1", "DAT300.LP2", "DAT310.LP2", "DAT320.LP2", "MVE055.LP3"]);
    expect(view.periods).toEqual(["LP1", "LP2", "LP3"]);
    expect(view.planned).toBe(7.5);
  });

  it("lists the first study period the plan has room in, the best rated course first", () => {
    const view = viewOf(2);

    expect(view.period).toBe("LP1");
    expect(view.sort).toBe("rating");
    expect(view.dir).toBe("desc");
    expect(view.survey).toBe("overall");
    expect(listedKeys(view)).toEqual(["DAT200.LP1"]);
  });

  it("lists the study period asked for, ordered by the sort and its direction, with the courses without results last", () => {
    const byCode = new Map([
      ["DAT300", stats("DAT300", 3, 1)],
      ["DAT310", stats("DAT310", 1, 1)],
    ]);

    expect(listedKeys(viewOf(2, { period: "LP2", sort: "passRate", stats: byCode }))).toEqual(["DAT300.LP2", "DAT310.LP2", "DAT320.LP2"]);
    expect(listedKeys(viewOf(2, { period: "LP2", sort: "passRate", dir: "asc", stats: byCode }))).toEqual([
      "DAT310.LP2",
      "DAT300.LP2",
      "DAT320.LP2",
    ]);
  });

  it("shows the survey question sorted by, else the one picked, else the overall impression", () => {
    const workload = viewOf(2, { sort: "workload" });

    expect([workload.dir, workload.survey]).toEqual(["asc", "workload"]);
    expect(viewOf(2, { sort: "passRate", survey: "teaching" }).survey).toBe("teaching");
    expect(viewOf(2, { sort: "passRate" }).survey).toBe("overall");
  });

  it("falls back to the first open period when the one asked for has no courses", () => {
    expect(viewOf(2, { period: "LP4" }).period).toBe("LP1");
  });

  it("has no period, and lists nothing, for a year without courses", () => {
    const years = studyYears(planOf("EMPTY", { 1: [] }));
    const view = yearView({ years, current: years[0]!, track: undefined, pickedKeys: [], otherPicks: [], stats: new Map(), ruleNames: {} });

    expect(view.period).toBeUndefined();
    expect(view.listed).toEqual([]);
    expect(view.planned).toBe(0);
  });

  it("counts the picked rounds in the plan and in the credits, and ignores keys the year does not have", () => {
    const view = viewOf(2, { pickedKeys: ["DAT310.LP2", "GONE.LP4"] });

    expect(keys(view.picked)).toEqual(["DAT310.LP2"]);
    expect(keys(view.plan)).toEqual(["DAT100.LP1", "DAT310.LP2"]);
    expect(view.planned).toBe(15);
  });

  describe("warnings", () => {
    it("warns about lectures at the same times as a course every student takes", () => {
      const [dat200] = viewOf(2).listed;

      expect(dat200?.warnings).toEqual([{ kind: "sameLectures", name: "DAT100 name", fixed: true }]);
    });

    it("warns about lectures at the same times as a picked course, which the student can drop", () => {
      const view = viewOf(3, { period: "LP2", pickedKeys: ["DAT500.LP2"] });

      expect(view.listed.map((l) => [l.round.key, l.warnings])).toEqual([
        ["DAT500.LP2", []],
        ["DAT510.LP2", [{ kind: "sameLectures", name: "DAT500 name", fixed: false }]],
      ]);
    });

    it("warns that only one of two courses in a choice counts, once the other is picked", () => {
      const view = viewOf(2, { period: "LP2", pickedKeys: ["DAT310.LP2"] });

      expect(view.listed.map((l) => [l.round.key, l.warnings])).toEqual([
        ["DAT300.LP2", []],
        ["DAT310.LP2", []],
        ["DAT320.LP2", [{ kind: "exclusive", name: "DAT310 name" }]],
      ]);
    });

    it("has none without picks that conflict", () => {
      expect(viewOf(2, { period: "LP2" }).listed.flatMap((l) => l.warnings)).toEqual([]);
    });
  });

  describe("degree rules", () => {
    it("asks for what the compulsory courses of the degree do not give, across every plan of the degree", () => {
      const view = viewOf(2);

      expect(view.degreeRules).toEqual([
        { requirement: mtsRule, have: 0, need: 7.5, unit: "credits", done: false },
        { requirement: scienceRule, have: 0, need: 1, unit: "courses", done: false },
        { requirement: masterRule, have: 0, need: 1, unit: "courses", done: false },
      ]);
      expect([...view.offered].toSorted()).toEqual(
        ["DAT100", "DAT200", "DAT300", "DAT310", "DAT320", "MVE055", "DAT400", "DAT500", "DAT510", "DAT550", "DAT600"].toSorted(),
      );
    });

    it("counts a pick of the year shown towards the rules", () => {
      const view = viewOf(2, { pickedKeys: ["DAT300.LP2"] });

      expect(progressOf(view).mts).toEqual({ requirement: mtsRule, have: 7.5, need: 7.5, unit: "credits", done: true });
    });

    it("counts the picks of the other years of study, in the programme and in its master's programme", () => {
      const view = viewOf(3, {
        otherPicks: [
          { number: 2, programme: "TKITE", year: 2, key: "DAT300.LP2" },
          { number: 4, programme: "MPALG", year: 1, key: "DAT600.LP1" },
        ],
      });

      expect(progressOf(view).mts?.done).toBe(true);
      expect(progressOf(view).master?.done).toBe(true);
      expect(progressOf(view).science?.done).toBe(false);
    });

    it("counts how far the picks of every year go towards a choice that asks for some of the year's courses", () => {
      const none = viewOf(2);
      const one = viewOf(2, { pickedKeys: ["DAT300.LP2"] });
      const both = viewOf(2, { pickedKeys: ["DAT300.LP2", "DAT310.LP2"] });
      const inOtherYear = viewOf(3, { otherPicks: [{ number: 2, programme: "TKITE", year: 2, key: "DAT310.LP2" }] });

      expect(none.pickRules).toEqual([{ pick: pickTwo, progress: { have: 0, need: 2, unit: "courses", done: false } }]);
      expect(one.pickRules[0]?.progress).toEqual({ have: 1, need: 2, unit: "courses", done: false });
      expect(both.pickRules[0]?.progress).toEqual({ have: 2, need: 2, unit: "courses", done: true });
      expect(inOtherYear.pickRules[0]?.progress).toEqual({ have: 1, need: 2, unit: "courses", done: false });
    });
  });

  describe("marks", () => {
    it("marks what each course gives towards the rules, in the unit of each rule", () => {
      const lp2 = viewOf(2, { period: "LP2" }).listed.map((l) => [l.round.key, l.marks]);
      const lp3 = viewOf(2, { period: "LP3" }).listed.map((l) => [l.round.key, l.marks]);

      expect(lp2).toEqual([
        ["DAT300.LP2", [{ requirement: mtsRule, have: 0, need: 7.5, unit: "credits", done: false, amount: 7.5 }]],
        ["DAT310.LP2", []],
        ["DAT320.LP2", []],
      ]);
      expect(lp3).toEqual([["MVE055.LP3", [{ requirement: scienceRule, have: 0, need: 1, unit: "courses", done: false, amount: 1 }]]]);
    });

    it("marks a course towards a rule the plan has met as done", () => {
      const view = viewOf(2, { period: "LP2", pickedKeys: ["DAT300.LP2"] });

      expect(view.listed[0]?.marks.map(({ requirement, done, amount }) => ({ requirement, done, amount }))).toEqual([
        { requirement: mtsRule, done: true, amount: 7.5 },
      ]);
    });

    it("marks the courses of a master's programme's year towards the master's rule", () => {
      const view = viewOf(4);

      expect(view.listed.map((l) => [l.round.key, l.marks.map((m) => m.requirement)])).toEqual([["DAT600.LP1", [masterRule]]]);
    });
  });

  it("shows where another round of a course is: in another study period, or in another year of study", () => {
    const inThisYear = viewOf(3, { period: "LP1", pickedKeys: ["DAT300.LP1"] });
    const inOtherYear = viewOf(3, { period: "LP1", otherPicks: [{ number: 2, programme: "TKITE", year: 2, key: "DAT300.LP2" }] });

    expect(inThisYear.listed.map((l) => [l.picked, l.elsewhere])).toEqual([[true, undefined]]);
    expect(inOtherYear.listed.map((l) => [l.picked, l.elsewhere])).toEqual([[false, { year: 2, periods: ["LP2"] }]]);
  });
});
