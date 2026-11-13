import { describe, expect, it } from "vitest";
import {
  courseYearSummary,
  placementsByCourse,
  plannedCourses,
  planYear,
  roundKey,
  roundOf,
  studyYears,
  type PlanChoice,
  type PlanCourse,
  type ProgrammePlan,
} from "./programme-plans.ts";

const RULE_NAMES = { O: "Compulsory courses", V: "Elective courses", X: "Diploma thesis" };

/** A plan entry of 7.5 credits in LP1, split evenly when `overrides` spread it over more study periods. */
const course = (code: string, overrides: Partial<PlanCourse> = {}): PlanCourse => {
  const entry = {
    code,
    name: `${code} name`,
    credits: 7.5,
    periods: ["LP1" as const],
    rule: "V",
    track: null,
    block: null,
    choices: [],
    themes: [],
    examiners: [],
    ...overrides,
  };
  return { periodCredits: entry.periods.map(() => entry.credits / entry.periods.length), ...entry };
};

const pickTwo: PlanChoice = { id: 1, kind: "pick", text: "Choose at least 2", minCourses: 2, minCredits: null };
const onlyOne: PlanChoice = { id: 2, kind: "exclusive", text: null, minCourses: null, minCredits: null };

const tkdat: ProgrammePlan = {
  code: "TKDAT",
  name: "Computer Science and Engineering",
  choices: [pickTwo, onlyOne],
  requirements: [],
  masters: [],
  years: [
    {
      year: 3,
      courses: [
        course("TDA357", { periods: ["LP3"], block: "B+", choices: [1] }),
        course("TDA357", { periods: ["LP2"], block: "D+", choices: [1] }),
        course("DAT400", { periods: ["LP3", "LP4"], rule: "X" }),
        course("EDA322", { periods: ["LP3"], rule: "O" }),
        course("TMA001", { periods: ["LP3"], choices: [2] }),
        course("TIF100", { periods: ["LP1"], track: "Physics" }),
        course("TMV200", { periods: ["LP1"], track: "Maths" }),
      ],
    },
  ],
};

describe("planYear", () => {
  it("gives one round per course and study periods, the earliest first, each with its course's requirement and choices", () => {
    const { rounds, picks } = planYear(tkdat, 3, { ruleNames: RULE_NAMES });

    expect(rounds.map((r) => [r.key, r.requirement.kind, r.choices])).toEqual([
      ["TIF100.LP1", "elective", []],
      ["TMV200.LP1", "elective", []],
      ["TDA357.LP2", "compulsoryElective", [pickTwo]],
      ["EDA322.LP3", "compulsory", []],
      ["TDA357.LP3", "compulsoryElective", [pickTwo]],
      ["TMA001.LP3", "elective", [onlyOne]],
      ["DAT400.LP3-LP4", "thesis", []],
    ]);
    expect(rounds.at(-1)).toMatchObject({ codes: ["DAT400"], credits: 7.5, periods: ["LP3", "LP4"], periodCredits: [3.75, 3.75] });
    expect(picks).toEqual([pickTwo]);
  });

  it("keeps the whole year's rounds and drops other tracks' when a track is picked", () => {
    const { rounds } = planYear(tkdat, 3, { track: "Physics", ruleNames: RULE_NAMES });
    expect(rounds.map((r) => r.key)).not.toContain("TMV200.LP1");
    expect(rounds.map((r) => r.key)).toContain("TIF100.LP1");
  });

  it("gives a course listed under several rules one round with the strongest of them", () => {
    const plan: ProgrammePlan = {
      ...tkdat,
      years: [{ year: 1, courses: [course("TIF100", { track: "Maths" }), course("TIF100", { track: "Physics", rule: "O" })] }],
    };
    const { rounds } = planYear(plan, 1, { ruleNames: RULE_NAMES });
    expect(rounds.map((r) => [r.key, r.requirement.label])).toEqual([["TIF100.LP1", "Compulsory"]]);
  });

  it("gives every round of a course the choices any of its rounds is part of", () => {
    const plan: ProgrammePlan = {
      ...tkdat,
      years: [{ year: 3, courses: [course("TDA357", { periods: ["LP2"], choices: [2] }), course("TDA357", { periods: ["LP3"] })] }],
    };
    const { rounds } = planYear(plan, 3, { ruleNames: RULE_NAMES });
    expect(rounds.map((r) => r.choices)).toEqual([[onlyOne], [onlyOne]]);
  });

  it("is empty for a year the plan does not have", () => {
    expect(planYear(tkdat, 5, { ruleNames: RULE_NAMES })).toEqual({ rounds: [], picks: [] });
  });
});

describe("placementsByCourse", () => {
  it("lists each course's placements the most required first, with their choices resolved", () => {
    const tidal: ProgrammePlan = {
      code: "TIDAL",
      name: "Computer Engineering",
      choices: [],
      requirements: [],
      masters: [],
      years: [{ year: 2, courses: [course("TDA357", { periods: ["LP2"], rule: "O", block: "D+" })] }],
    };
    const placements = placementsByCourse([tkdat, tidal], RULE_NAMES).get("TDA357");

    expect(placements?.map((p) => [p.programme, p.year, p.periods, p.choices])).toEqual([
      ["TIDAL", 2, ["LP2"], []],
      ["TKDAT", 3, ["LP2"], [pickTwo]],
      ["TKDAT", 3, ["LP3"], [pickTwo]],
    ]);
  });
});

describe("roundOf", () => {
  const lp2 = { periods: ["LP2"] as const, block: "D+", examiners: ["Jonas Almström Duregård"] };
  const lp3 = { periods: ["LP3"] as const, block: "B+", examiners: ["Ana Bove"] };

  it("matches a plan entry to the round in the same study periods", () => {
    expect(roundOf({ periods: ["LP3"], block: null }, [lp2, lp3])).toBe(lp3);
  });

  it("tells rounds in the same study periods apart by block", () => {
    const lp3Morning = { ...lp3, block: "A", examiners: ["Someone Else"] };
    expect(roundOf({ periods: ["LP3"], block: "A" }, [lp3, lp3Morning])).toBe(lp3Morning);
  });

  it("gives no round rather than a guess when none or several match", () => {
    expect(roundOf({ periods: ["LP1"], block: null }, [lp2, lp3])).toBeNull();
    expect(roundOf({ periods: ["LP3"], block: null }, [lp3, { ...lp3, block: "A" }])).toBeNull();
  });
});

describe("courseYearSummary", () => {
  it("sums up rounds with examiners and programmes by requirement, each programme once", () => {
    const tidal: ProgrammePlan = {
      code: "TIDAL",
      name: "Computer Engineering",
      choices: [],
      requirements: [],
      masters: [],
      years: [{ year: 2, courses: [course("TDA357", { periods: ["LP2"], rule: "O", examiners: ["Jonas"] })] }],
    };
    const withExaminers: ProgrammePlan = {
      ...tkdat,
      years: [
        {
          year: 2,
          courses: [course("TDA357", { periods: ["LP3"], examiners: ["Ana"] })],
        },
        {
          year: 3,
          courses: [
            course("TDA357", { periods: ["LP2"], examiners: ["Jonas"], choices: [1] }),
            course("TDA357", { periods: ["LP3"], examiners: ["Ana"], choices: [1] }),
          ],
        },
      ],
    };
    const placements = placementsByCourse([withExaminers, tidal], RULE_NAMES).get("TDA357")!;

    expect(courseYearSummary(placements, RULE_NAMES)).toEqual({
      rounds: [
        { periods: ["LP2"], examiners: ["Jonas"] },
        { periods: ["LP3"], examiners: ["Ana"] },
      ],
      requirements: [
        { requirement: { kind: "compulsory", rank: 0, label: "Compulsory" }, programmes: [{ code: "TIDAL", years: [2] }] },
        { requirement: { kind: "compulsoryElective", rank: 1, label: "Compulsory elective" }, programmes: [{ code: "TKDAT", years: [3] }] },
        { requirement: { kind: "elective", rank: 2, label: "Elective" }, programmes: [{ code: "TKDAT", years: [2] }] },
      ],
    });
  });
});

const mpalg: ProgrammePlan = {
  code: "MPALG",
  name: "Computer Science - Algorithms, Languages and Logic",
  choices: [],
  requirements: [],
  masters: [],
  years: [
    { year: 1, courses: [course("TDA251", { periods: ["LP2"], rule: "O" }), course("DAT060"), course("DAT151")] },
    { year: 2, courses: [course("DATX05", { periods: ["LP1", "LP2", "LP3", "LP4"], rule: "X" })] },
  ],
};

const numbered = (years: ReturnType<typeof studyYears>) => years.map(({ number, plan, year }) => [number, plan.code, year]);

describe("studyYears", () => {
  it("numbers the years of a programme from its first", () => {
    expect(numbered(studyYears(tkdat))).toEqual([[3, "TKDAT", 3]]);
  });

  it("puts the master's programme in the fourth and fifth year, also after a programme with no plan for its third year yet", () => {
    const firstYearOnly = { ...tkdat, years: [{ year: 1, courses: [course("DAT017")] }] };
    expect(numbered(studyYears(firstYearOnly, mpalg))).toEqual([
      [1, "TKDAT", 1],
      [4, "MPALG", 1],
      [5, "MPALG", 2],
    ]);
  });
});

const codes = (courses: readonly PlanCourse[]) => courses.map((c) => c.code);

describe("plannedCourses", () => {
  const plan: ProgrammePlan = {
    ...tkdat,
    years: [{ year: 2, courses: [course("DAT017", { rule: "O" }), course("TDA357", { periods: ["LP2"] })] }, ...tkdat.years],
  };

  it("holds the compulsory courses of every year without any picks, and not those of a track", () => {
    expect(codes(plannedCourses([plan], []))).toEqual(["DAT017", "EDA322"]);
  });

  it("adds the compulsory courses of the track", () => {
    const withTrack = { ...plan, years: [{ year: 1, courses: [course("TIF100", { rule: "O", track: "Physics" })] }] };
    expect(codes(plannedCourses([withTrack], []))).toEqual([]);
    expect(codes(plannedCourses([withTrack], [], "Physics"))).toEqual(["TIF100"]);
  });

  it("adds the round picked in a year, and counts a course picked in two years once", () => {
    const picks = [
      { programme: "TKDAT", year: 2, key: roundKey("TDA357", ["LP2"]) },
      { programme: "TKDAT", year: 3, key: roundKey("TDA357", ["LP3"]) },
      { programme: "TKDAT", year: 3, key: roundKey("TMA001", ["LP3"]) },
    ];
    expect(codes(plannedCourses([plan], picks))).toEqual(["DAT017", "TDA357", "EDA322", "TMA001"]);
  });

  it("leaves out a round picked in a year the plan has it in no such study period", () => {
    const picks = [{ programme: "TKDAT", year: 2, key: roundKey("TDA357", ["LP3"]) }];
    expect(codes(plannedCourses([plan], picks))).toEqual(["DAT017", "EDA322"]);
  });

  it("holds the courses of a master's programme after the programme, with the picks made in each plan's own years", () => {
    const picks = [
      { programme: "MPALG", year: 1, key: roundKey("DAT060", ["LP1"]) },
      { programme: "TKDAT", year: 1, key: roundKey("DAT151", ["LP1"]) },
    ];
    expect(codes(plannedCourses([plan, mpalg], picks))).toEqual(["DAT017", "EDA322", "TDA251", "DAT060"]);
  });
});
