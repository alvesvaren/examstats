import { describe, expect, it } from "vitest";
import {
  eligibilityOf,
  firstYears,
  guideEntry,
  guideFit,
  heldByDeadline,
  meets,
  type CourseRule,
  type GuideMaster,
  type HeldCourse,
} from "./eligibility.ts";
import { planCourseSchema, programmePlanSchema, roundKey, studyYears, type PlanCourse, type StudyPeriod } from "./programme-plans.ts";

const course = (code: string, registration = false): CourseRule => ({ kind: "course", codes: [code], name: `${code} name`, registration });
const held = (code: string, year: number, ...periods: StudyPeriod[]): HeldCourse => ({ code, year, periods });
const offered = (code: string, year: number, ...periods: StudyPeriod[]) => ({ code, name: `${code} name`, year, periods });

/** TKDAT's requirement for MPAIN in the guide for 2027/2028: a course in multivariable calculus, and DAT566. */
const multivariable: CourseRule = { kind: "any", of: [course("LMA017"), course("MVE655")] };
const ai: CourseRule = { kind: "all", of: [multivariable, course("DAT566")] };

describe("heldByDeadline", () => {
  it("counts a course once it ends before study period 4 of year 3, when the application closes", () => {
    const { completed } = heldByDeadline([
      held("SUMMER", 2, "Summer"),
      held("LP3", 3, "LP3"),
      held("LP4", 3, "LP4"),
      held("LP34", 3, "LP3", "LP4"),
      held("MASTER", 4, "LP1"),
    ]);
    expect([...completed]).toEqual(["SUMMER", "LP3"]);
  });

  it("counts a registration on a course of study period 4 of year 3 for a course that needs only that", () => {
    const inTime = heldByDeadline([held("DAT257", 3, "LP4")]);
    expect(meets(course("DAT257", true), inTime)).toBe(true);
    expect(meets(course("DAT257"), inTime)).toBe(false);
  });
});

describe("meets", () => {
  it("counts a course under any of its codes", () => {
    const rule: CourseRule = { kind: "course", codes: ["DAT038", "TDA417"], name: "Datastrukturer och algoritmer", registration: false };
    expect(meets(rule, heldByDeadline([held("TDA417", 2, "LP2")]))).toBe(true);
  });

  it("counts two courses that are one item of a list once", () => {
    const hydrology: CourseRule = { kind: "any", of: [course("BOM350"), course("ACE185")] };
    const rule: CourseRule = { kind: "atLeast", count: 2, of: [course("BOM345"), hydrology, course("BOM360"), course("BOM370")] };
    expect(meets(rule, heldByDeadline([held("BOM350", 2, "LP1"), held("ACE185", 2, "LP2")]))).toBe(false);
    expect(meets(rule, heldByDeadline([held("BOM350", 2, "LP1"), held("BOM360", 3, "LP1")]))).toBe(true);
  });
});

describe("eligibilityOf", () => {
  it("is met when every requirement joined by samt is", () => {
    const taken = [offered("LMA017", 2, "LP3"), offered("DAT566", 3, "LP2")];
    expect(eligibilityOf({ kind: "courses", rule: ai }, { taken, offered: [] })).toMatchObject({ kind: "courses", met: true });
  });

  it("lists the courses of the first years that would meet what is missing, and a course taken too late to count", () => {
    const taken = [offered("LMA017", 2, "LP3"), offered("DAT566", 3, "LP4")];
    const options = [offered("LMA017", 2, "LP3"), offered("DAT566", 3, "LP2"), offered("DAT566", 3, "LP4"), offered("MVE655", 3, "LP1")];
    expect(eligibilityOf({ kind: "courses", rule: ai }, { taken, offered: options })).toEqual({
      kind: "courses",
      met: false,
      clauses: [
        {
          rule: multivariable,
          met: true,
          have: 1,
          need: 1,
          held: [offered("LMA017", 2, "LP3")],
          late: [],
          offered: [],
          offeredLate: [],
          reach: "plans",
        },
        {
          rule: course("DAT566"),
          met: false,
          have: 0,
          need: 1,
          held: [],
          late: [offered("DAT566", 3, "LP4")],
          offered: [offered("DAT566", 3, "LP2")],
          offeredLate: [offered("DAT566", 3, "LP4")],
          reach: "plans",
        },
      ],
    });
  });

  it("tells whether the first years' plans can meet what is missing in time, only too late, or not at all", () => {
    const fluids: CourseRule = { kind: "atLeast", count: 2, of: [course("MTF053"), course("KBT340"), course("MMS260")] };
    const rule: CourseRule = { kind: "all", of: [course("DAT566"), course("EEM076"), course("PPU061"), fluids] };
    const options = [offered("DAT566", 3, "LP2"), offered("EEM076", 3, "LP4"), offered("KBT340", 2, "LP2")];
    const eligibility = eligibilityOf({ kind: "courses", rule }, { taken: [], offered: options });
    expect(eligibility.kind === "courses" && eligibility.clauses.map((c) => c.reach)).toEqual(["plans", "late", "outside", "outside"]);
  });

  it("passes on what the guide does not check", () => {
    expect(eligibilityOf({ kind: "regulations" }, { taken: [], offered: [] })).toEqual({ kind: "regulations" });
  });
});

const master = (specialisation: string | null, entries: GuideMaster["entries"]): GuideMaster => ({
  code: "MPEIE",
  specialisation,
  entries,
  recommended: [],
});
const guideMasters = [
  master(null, [
    { programme: "TKMSK", path: "threeYear", admission: { kind: "courses", rule: course("SSY061") }, recommended: [], corrections: [] },
    { programme: "TKMSK", path: "fiveYear", admission: { kind: "compulsory" }, recommended: [], corrections: [] },
  ]),
  master("Fluid Mechanics and Water Systems", [
    {
      programme: "TKMSK",
      path: null,
      admission: { kind: "courses", rule: course("MTF053") },
      recommended: [],
      corrections: [{ guide: "MTF035 Strömningsmekanik", corrected: "MTF053 Strömningsmekanik" }],
    },
  ]),
];

describe("guideEntry", () => {
  it("takes the entry for the five-year degree, which the planner plans", () => {
    expect(guideEntry(guideMasters, { master: "MPEIE", programme: "TKMSK" })?.admission).toEqual({ kind: "compulsory" });
  });

  it("takes the requirements of the specialisation the plan follows when it has its own, however the plan spells it", () => {
    expect(guideEntry(guideMasters, { master: "MPEIE", track: "Fluid mechanics and water systems", programme: "TKMSK" })).toMatchObject({
      specialisation: "Fluid Mechanics and Water Systems",
      admission: { kind: "courses", rule: course("MTF053") },
    });
  });

  it("says which lines of the guide it reads corrected", () => {
    expect(
      guideEntry(guideMasters, { master: "MPEIE", track: "Fluid Mechanics and Water Systems", programme: "TKMSK" })?.corrections,
    ).toEqual([{ guide: "MTF035 Strömningsmekanik", corrected: "MTF053 Strömningsmekanik" }]);
    expect(guideEntry(guideMasters, { master: "MPEIE", programme: "TKDAT" })?.corrections).toEqual([]);
  });

  it("leaves a programme the guide does not name to the admission regulations", () => {
    expect(guideEntry(guideMasters, { master: "MPEIE", programme: "TKDAT" })?.admission).toEqual({ kind: "regulations" });
  });

  it("knows nothing of a master's programme the guide does not have", () => {
    expect(guideEntry(guideMasters, { master: "MPALG", programme: "TKDAT" })).toBeUndefined();
  });
});

describe("guideFit", () => {
  it("fits the students whose master's programme starts in its year, and later students until their own is out", () => {
    expect([2026, 2027, 2028].map((masterStart) => guideFit("2027/2028", masterStart))).toEqual([null, "own", "earlier"]);
  });
});

/** A plan entry of 7.5 credits in LP1, elective unless `overrides` says otherwise. */
const entry = (code: string, overrides: Partial<PlanCourse>) =>
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
const plan = (code: string, years: Record<number, PlanCourse[]>) =>
  programmePlanSchema.parse({
    code,
    name: code,
    choices: [],
    requirements: [],
    masters: [],
    prerequisites: [],
    years: Object.entries(years).map(([year, courses]) => ({ year: Number(year), courses })),
  });
describe("firstYears", () => {
  const programme = plan("TKIEK", {
    1: [entry("TMV216", { rule: "O" })],
    3: [
      entry("TME010", { rule: "O", track: "Industrial production" }),
      entry("MVE137", { rule: "O", track: "Financial mathematics" }),
      entry("TEK125", { periods: ["LP2"] }),
    ],
  });
  const years = studyYears(programme, plan("MPPRO", { 1: [entry("PPU190", { rule: "O" })] }));

  it("holds the compulsory courses of the programme's own track and the picks, each in its year of study", () => {
    const picks = [{ number: 3, programme: "TKIEK", year: 3, key: roundKey("TEK125", ["LP2"]) }];
    expect(firstYears(years, picks, "Industrial production").taken).toEqual([
      offered("TMV216", 1, "LP1"),
      offered("TME010", 3, "LP1"),
      offered("TEK125", 3, "LP2"),
    ]);
  });

  it("offers every course of the first three years, and none of the master's programme", () => {
    expect(firstYears(years, [], undefined).offered.map((c) => c.code)).toEqual(["TMV216", "TME010", "MVE137", "TEK125"]);
  });
});
