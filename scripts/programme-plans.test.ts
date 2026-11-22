import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  courseListSchema,
  courseSchema,
  programmeSchema,
  syllabusSchema,
  toChoices,
  toCourseNames,
  toCourses,
  toRequirements,
  toRounds,
  trackNames,
} from "./programme-plans.ts";

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`fixtures/${name}`, import.meta.url), "utf8"));

const programmesIn = (name: string) => programmeSchema.parse(fixture(name)).search.results;
const momentsOf = (programme: { yearClasses: { courseMoments: Parameters<typeof toCourses>[0] }[] }) =>
  programme.yearClasses.flatMap((y) => y.courseMoments);
const syllabusIn = (name: string) => syllabusSchema.parse(fixture(name)).search.results[0]!;

describe("toCourses", () => {
  const [tkite] = programmesIn("chalmers-programme-plan.json");

  it("turns the module rows of a plan into one course per plan entry, in period order", () => {
    expect(toCourses(momentsOf(tkite!))).toEqual([
      {
        code: "TDA548",
        name: "Fundamentals of program development",
        credits: 7.5,
        periods: ["LP1"],
        periodCredits: [7.5],
        rule: "O",
        track: null,
        block: null,
        choices: [],
        themes: [],
      },
      {
        code: "LSP530",
        name: "Fiction for engineers",
        credits: 7.5,
        periods: ["LP1", "LP2"],
        periodCredits: [3.5, 4],
        rule: "V",
        track: null,
        block: null,
        choices: [],
        themes: [{ theme: "mts", credits: 7.5 }],
      },
      {
        code: "MVE655",
        name: "Multivariable analysis",
        credits: 7.5,
        periods: ["LP2"],
        periodCredits: [7.5],
        rule: "V",
        track: null,
        block: null,
        choices: [5182],
        themes: [],
      },
      {
        code: "SJO955",
        name: "Introduction to law",
        credits: 7.5,
        periods: ["LP2"],
        periodCredits: [7.5],
        rule: "V",
        track: null,
        block: "A",
        choices: [],
        themes: [],
      },
      {
        code: "TDA567",
        name: "Testing, debugging and verification",
        credits: 7.5,
        periods: ["LP2"],
        periodCredits: [7.5],
        rule: "V",
        track: null,
        block: "C",
        choices: [5156],
        themes: [],
      },
      {
        code: "DATX11",
        name: "Bachelor's thesis in Computer science and engineering",
        credits: 15,
        periods: ["LP3", "LP4"],
        periodCredits: [7.5, 7.5],
        rule: "X",
        track: null,
        block: null,
        choices: [],
        themes: [],
      },
      {
        // The LP2 module row has no credits, so the course does not run in LP2.
        code: "MVE370",
        name: "Mathematics and society",
        credits: 7.5,
        periods: ["LP3", "LP4"],
        periodCredits: [3, 4.5],
        rule: "V",
        track: null,
        block: null,
        choices: [],
        themes: [{ theme: "mts", credits: 7.5 }],
      },
      {
        code: "DAT216",
        name: "Design and implementation of graphical interfaces",
        credits: 7.5,
        periods: ["LP4"],
        periodCredits: [7.5],
        rule: "O",
        track: null,
        block: null,
        choices: [],
        themes: [{ theme: "mts", credits: 3 }],
      },
    ]);
  });

  it("drops a cancelled plan entry", () => {
    const codes = toCourses(momentsOf(tkite!)).map((c) => c.code);
    expect(codes).not.toContain("TDA507");
  });
});

describe("toChoices", () => {
  it("maps exclusive and recommended choices of a bachelor's programme, ordered by id", () => {
    const [tkite] = programmesIn("chalmers-programme-plan.json");
    expect(toChoices(momentsOf(tkite!))).toEqual([
      {
        id: 5156,
        kind: "exclusive",
        text: "Only one of the marked courses can be included in the degree",
        minCourses: null,
        minCredits: null,
      },
      { id: 5182, kind: "recommended", text: "Prerequisite for MPDSC and MPENM", minCourses: null, minCredits: null },
    ]);
  });

  it("maps the compulsory electives of master's programmes, in credits, in courses and without a text", () => {
    const [mpbio, mpcas, mpbdp] = programmesIn("chalmers-master-plans.json");
    expect(toChoices(momentsOf(mpbio!))).toEqual([
      {
        id: 5102,
        kind: "pick",
        text: "The following courses are classified as compulsury elective and can be studied during both year 1 and 2.",
        minCourses: null,
        minCredits: 37.5,
      },
      {
        id: 5215,
        kind: "recommended",
        text: "To acquire a profile from track Food and health, it is recommended to follow one or more of these specified courses",
        minCourses: null,
        minCredits: null,
      },
      {
        id: 5217,
        kind: "recommended",
        text: "To acquire a profile from track Biomolecular science and technology, it is recommended to follow one or more of these specified courses",
        minCourses: null,
        minCredits: null,
      },
      {
        id: 5218,
        kind: "recommended",
        text: "To acquire a profile from track Systems biotechnology and bioeconomy, it is recommended to follow one or more of these specified courses",
        minCourses: null,
        minCredits: null,
      },
      {
        id: 5219,
        kind: "recommended",
        text: "These compulsory elective courses are recommended for year 2.",
        minCourses: null,
        minCredits: null,
      },
    ]);
    expect(toChoices(momentsOf(mpcas!))).toEqual([
      { id: 5103, kind: "pick", text: null, minCourses: null, minCredits: 22.5 },
      {
        id: 5221,
        kind: "recommended",
        text: "The course is normally followed during the second year of the Masters programme",
        minCourses: null,
        minCredits: null,
      },
    ]);
    expect(toChoices(momentsOf(mpbdp!))).toEqual([{ id: 5101, kind: "pick", text: "At least one", minCourses: 1, minCredits: null }]);
  });
});

describe("toCourses with tracks and choices of a master's programme", () => {
  it("keeps the choice ids of every module row once", () => {
    const [mpbio] = programmesIn("chalmers-master-plans.json");
    const bbt051 = toCourses(momentsOf(mpbio!)).filter((c) => c.code === "BBT051");
    expect(bbt051.map((c) => [c.choices, c.periodCredits])).toEqual([
      [[5102, 5215, 5218], [7.5]],
      [[5219], [7.5]],
    ]);
  });
});

describe("toRequirements", () => {
  const bachelor = syllabusIn("chalmers-syllabus-bachelor.json");

  it("reads a theme in credits and a list of courses, and ignores the other requirements", () => {
    expect(toRequirements(bachelor)).toEqual([
      { kind: "theme", theme: "environment", minCredits: 7.5 },
      { kind: "theme", theme: "mts", minCredits: 7.5 },
      { kind: "courses", courses: ["EDA322", "EEF031", "FFR105", "TDA507"], minCourses: 1 },
    ]);
  });

  it("has no requirements when the syllabus asks for no theme or list", () => {
    expect(toRequirements(syllabusIn("chalmers-syllabus-master.json"))).toEqual([]);
  });

  it("keeps the largest demand of a theme across degrees and shows a repeated list once", () => {
    const requirements = toRequirements({
      ...bachelor,
      degreeWithDegreeRequirements: [
        ...(bachelor.degreeWithDegreeRequirements ?? []),
        { reqCode: "CRED_MTS", reqCredit: 15 },
        { reqCode: "CRED_MTS", reqCredit: 0 },
      ],
      degreeWithDegreeSpecRequirements: [
        ...(bachelor.degreeWithDegreeSpecRequirements ?? []),
        ...(bachelor.degreeWithDegreeSpecRequirements ?? []).map((r) => ({ ...r, degreeSpecId: 999 })),
      ],
    });
    expect(requirements).toEqual([
      { kind: "theme", theme: "environment", minCredits: 7.5 },
      { kind: "theme", theme: "mts", minCredits: 15 },
      { kind: "courses", courses: ["EDA322", "EEF031", "FFR105", "TDA507"], minCourses: 1 },
    ]);
  });
});

describe("toRounds", () => {
  const [tda357, dat151] = courseSchema.parse(fixture("chalmers-courses.json")).search.results;

  it("reads the seats, block, examiners and modules of each round of a seat-limited course", () => {
    expect(toRounds(tda357)).toEqual([
      {
        periods: ["LP2"],
        block: "D+",
        examiners: ["Examiner1 Number1"],
        modules: [
          { code: "0206", credits: 3 },
          { code: "0106", credits: 4.5 },
        ],
        seats: 185,
      },
      {
        periods: ["LP3"],
        block: "B+",
        examiners: ["Examiner2 Number1"],
        modules: [
          { code: "0206", credits: 3 },
          { code: "0106", credits: 4.5 },
        ],
        seats: 165,
      },
    ]);
  });

  it("has no seats when the round takes everyone who qualifies", () => {
    expect(toRounds(dat151)).toEqual([
      {
        periods: ["LP2"],
        block: "B",
        examiners: ["Examiner1 Number1"],
        modules: [
          { code: "0212", credits: 1.5 },
          { code: "0112", credits: 6 },
        ],
        seats: null,
      },
    ]);
  });

  it("skips a cancelled round and has no rounds for an unknown course", () => {
    const [first, second] = tda357!.courseRounds;
    expect(toRounds({ ...tda357!, courseRounds: [{ ...first!, cancelled: 1 }, second!] }).map((r) => r.seats)).toEqual([165]);
    expect(toRounds(undefined)).toEqual([]);
  });
});

describe("toCourseNames", () => {
  const rows = courseListSchema.parse(fixture("chalmers-course-list.json")).results;

  it("names each course as its newest syllabus does, and gives the newest academic year chalmers.se offers it in", () => {
    expect(toCourseNames(rows)).toEqual([
      // Renamed in 2024/2025.
      {
        code: "ACE550",
        en: "Community architecture and urban design",
        sv: "Arkitektur och stadsbyggnad för gemenskap",
        lastOffered: "2026/2027",
      },
      { code: "DAT405", en: "Introduction to data science and AI", sv: "Introduktion till data science och AI", lastOffered: "2022/2023" },
      // The syllabus of 2026/2027 discontinues the course.
      { code: "MVE660", en: "Multivariable calculus", sv: "Flervariabelanalys", lastOffered: "2025/2026" },
      // Its only syllabus discontinues it.
      {
        code: "TRA340",
        en: "Design of sustainable infrastructure and urban transformation",
        sv: "Design av hållbar infrastruktur och stadsomvandling",
        lastOffered: null,
      },
    ]);
  });
});

describe("trackNames", () => {
  const [tkite] = programmesIn("chalmers-programme-plan.json");
  const moments = momentsOf(tkite!).slice(0, 3);
  const onTrack = (index: number, concName: string | null) => ({ ...moments[index]!, momentSpecialisation: { concName } });

  it("pairs the English and Swedish name of each track by the plan entry, once each", () => {
    const english = [onTrack(0, "Financial mathematics"), onTrack(1, "Financial mathematics"), onTrack(2, null)];
    const swedish = [onTrack(0, "Finansiell matematik"), onTrack(1, "Finansiell matematik"), onTrack(2, null)];

    expect(trackNames(english, swedish)).toEqual([{ en: "Financial mathematics", sv: "Finansiell matematik" }]);
  });
});
