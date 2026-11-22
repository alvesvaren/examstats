import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { documentLinks, guideLines, guideYear, parseGuide, requirementOf } from "./eligibility.ts";

/** The guide for 2027/2028 as `pdfPages` reads it, one page per form feed. */
const pages = readFileSync(new URL("fixtures/chalmers-eligibility-guide.txt", import.meta.url), "utf8").split("\f");
const { masters, problems } = parseGuide(pages);

const course = (codes: string[], name: string, registration = false) => ({ kind: "course", codes, name, registration });
const entry = (master: string, programme: string, specialisation: string | null = null) =>
  masters.find((m) => m.code === master && m.specialisation === specialisation)?.entries.filter((e) => e.programme === programme);

describe("guideYear", () => {
  it("reads the academic year off the guide's title page, whose font drops the spaces", () => {
    expect(guideYear(pages)).toBe("2027/2028");
  });

  it("is null for the admission regulations, which the same page links to", () => {
    expect(guideYear(["Beslut av: Typ av styrdokument: Diarienummer\nVicerektor för utbildning Regler C 2026-0643"])).toBeNull();
  });
});

describe("documentLinks", () => {
  it("finds each archived document once, as a link on chalmers.se", () => {
    const html =
      '<a href="/api/media/?url=https://webbpublicering360.portal.chalmers.se/Extern/Home/Download?recordnor=1123042%262026_10%261391991_1_1.PDF%26ex">' +
      '<a href="/api/media/?url=https://webbpublicering360.portal.chalmers.se/Extern/Home/Download?recordnor=1123042%262026_10%261391991_1_1.PDF%26ex">' +
      '<a href="/api/media/?url=https://cms.www.chalmers.se/Media/d0rjpp5z/matris.xlsx">';
    expect(documentLinks(html, "https://www.chalmers.se/utbildning/antagningsordning/")).toEqual([
      "https://www.chalmers.se/api/media/?url=https://webbpublicering360.portal.chalmers.se/Extern/Home/Download?recordnor=1123042%262026_10%261391991_1_1.PDF%26ex",
    ]);
  });
});

describe("guideLines", () => {
  it("drops the page numbers, which one PDF reader gives first on a page and another last", () => {
    expect(guideLines(["7\nMVE655  Flervariabelanalys\nsamt", "DAT566 Introduktion till data science och AI\n8"])).toEqual([
      "MVE655 Flervariabelanalys",
      "samt",
      "DAT566 Introduktion till data science och AI",
    ]);
  });
});

describe("requirementOf", () => {
  it("joins lines of alternatives with samt", () => {
    expect(
      requirementOf(["LMA017 Matematisk analys i flera variabler eller MVE655 Flervariabelanalys", "samt", "DAT566 Introduktion"]),
    ).toEqual({
      kind: "all",
      of: [
        { kind: "any", of: [course(["LMA017"], "Matematisk analys i flera variabler"), course(["MVE655"], "Flervariabelanalys")] },
        course(["DAT566"], "Introduktion"),
      ],
    });
  });

  it("reads the guide's spellings of a course and of samt alike", () => {
    expect(requirementOf(["MTF053 - Strömningsmekanik", "Samt", "LMA224Matematisk överbryggningskurs"])).toEqual({
      kind: "all",
      of: [course(["MTF053"], "Strömningsmekanik"), course(["LMA224"], "Matematisk överbryggningskurs")],
    });
  });

  it("leaves two courses without samt or eller between them unread, since the guide does not say how they combine", () => {
    expect(requirementOf(["TME305/TME187 Strukturmekanik", "MVE500 Serier och derivator i flera variabler"])).toBeNull();
  });

  it("leaves a list unread that has fewer courses than it says", () => {
    expect(requirementOf(["2 av 3 valfritt från nedan kurser", "BOM345 Vattenteknik och miljö", "BOM360 Infrastruktur"])).toBeNull();
  });

  it("leaves a requirement unread that names no courses", () => {
    expect(requirementOf(["22.5 hp i matematik eller matematisk statistik (utöver grundprogrammets obligatoriska kurser)"])).toBeNull();
  });

  it("leaves a block unread that ends in samt", () => {
    expect(requirementOf(["MVE655 Flervariabelanalys", "samt"])).toBeNull();
  });
});

describe("parseGuide", () => {
  it("reads every block but those the guide words in a way that names no courses or leaves open", () => {
    expect(problems).toEqual([
      "MPDEM TKARK: its line says what the parser does not know: Arkitektur, arkitekt (300hp) (TKARK) – förtur TKARK placeras i urvalsgrupp GP. Förtur ska tillämpas från och med HT27 och tillsvidare. Programmet ackrediterar inte MPDEM.",
      "MPEIE (Fluid Mechanics and Water Systems) TISAM: its course requirements do not follow the guide's grammar",
      ...["TIDAL", "TIDSL", "TIELL", "TIKEL", "TIMAL", "TIMEL", "TISAM"].map(
        (code) => `MPLOL ${code}: its course requirements do not follow the guide's grammar`,
      ),
      "MPMSD TKIEK: its heading is not one the parser knows",
      "MPSGE TKATK: it has no course requirements, nor a heading that says why",
      "MPSGE TISAM: its course requirements do not follow the guide's grammar",
    ]);
  });

  it("has a section for each master's programme and for each specialisation with requirements of its own", () => {
    expect(masters.filter((m) => m.specialisation).map((m) => `${m.code} ${m.specialisation}`)).toEqual([
      "MPEIE Fluid Mechanics and Water Systems",
      "MPHCD Game Design and Development",
      "MPHCD Integrated Product Design",
      "MPMBE Naval Architecture and Ocean Engineering",
      "MPSLC Communication and Sensing",
    ]);
    expect(masters).toHaveLength(40);
  });

  it("reads a programme's own requirement, which ends where the next programme starts across a page break", () => {
    expect(entry("MPAIN", "TKDAT")).toEqual([
      {
        programme: "TKDAT",
        path: null,
        admission: {
          kind: "courses",
          rule: {
            kind: "all",
            of: [
              { kind: "any", of: [course(["LMA017"], "Matematisk analys i flera variabler"), course(["MVE655"], "Flervariabelanalys")] },
              course(["DAT566"], "Introduktion till data science och AI"),
            ],
          },
        },
        recommended: [],
        corrections: [],
      },
    ]);
  });

  it("gives every programme a heading lists the requirement after the list", () => {
    const rule = {
      kind: "all",
      of: [course(["DAT566"], "Introduktion till data science och AI"), course(["DAT038", "TDA417"], "Datastrukturer och algoritmer")],
    };
    expect([...entry("MPAIN", "TKELT")!, ...entry("MPAIN", "TKIEK")!].map((e) => e.admission)).toEqual([
      { kind: "courses", rule },
      { kind: "courses", rule },
    ]);
  });

  it("tells the paths of a programme that the guide names once per degree apart", () => {
    expect(entry("MPCME", "TKMSK")!.map(({ path, admission }) => ({ path, kind: admission.kind }))).toEqual([
      { path: "fiveYear", kind: "courses" },
      { path: "threeYear", kind: "courses" },
    ]);
    expect(entry("MPHCD", "TKMSK")!.map((e) => e.path)).toEqual([null]);
  });

  it("reads alternatives, each of which is a whole requirement of its own", () => {
    const [kemi] = entry("MPCME", "TKKEF")!;
    expect(kemi!.admission).toMatchObject({
      kind: "courses",
      rule: {
        kind: "any",
        of: [
          { kind: "all", of: { length: 2 } },
          { kind: "all", of: { length: 3 } },
        ],
      },
    });
  });

  it("reads a list to choose some courses of, where one item can be one of two courses", () => {
    const [samhallsbyggnad] = entry("MPEIE", "TKSAM")!;
    expect(samhallsbyggnad!.admission).toEqual({
      kind: "courses",
      rule: {
        kind: "atLeast",
        count: 2,
        of: [
          course(["BOM345"], "Vattenteknik och miljö"),
          { kind: "any", of: [course(["BOM350"], "Hydrologi och dagvatten"), course(["ACE185"], "Hydrologi och dagvatten")] },
          course(["BOM360"], "Infrastruktur"),
          course(["BOM370"], "Hydrogeologi och geoteknik"),
        ],
      },
    });
  });

  it("marks a course that only needs a registration, and skips the footnote that says so", () => {
    const [datateknik] = entry("MPHCD", "TKDAT")!;
    expect(datateknik!.admission).toEqual({
      kind: "courses",
      rule: {
        kind: "all",
        of: [course(["PPU061"], "Människa-maskinsystem"), course(["DAT257"], "Agile software project management", true)],
      },
    });
  });

  it("reads the lists of programmes that need nothing more, and those the admission regulations decide for", () => {
    expect(entry("MPCOS", "TKDAT")!.map((e) => e.admission)).toEqual([{ kind: "compulsory" }]);
    expect(entry("MPMSD", "TKMAS")!.map((e) => e.admission)).toEqual([{ kind: "regulations" }]);
    expect(masters.find((m) => m.code === "MPBDP")!.entries.every((e) => e.admission.kind === "regulations")).toBe(true);
  });

  it("keeps the guide's words for a requirement it does not check, such as a track of the programme", () => {
    expect(entry("MPMSD", "TKIEK")!.map((e) => e.admission)).toEqual([
      {
        kind: "words",
        text:
          "Sökande från följande program uppfyller alla särskilda förkunskapskrav utifrån de obligatoriska kurserna i programmets kandidatdel samt kurserna inom teknikinriktningen Finansiell matematik (observera kravet på teknikinriktning)\n" +
          "Industriell ekonomi, civilingenjör (300hp) (TKIEK) - med villkorad ackreditering för specialiseringen: Financial mathematics",
      },
    ]);
  });

  it("gives a specialisation that defers to its programme the programme's requirements", () => {
    const programme = masters.find((m) => m.code === "MPSLC" && m.specialisation === null)!;
    const specialisation = masters.find((m) => m.code === "MPSLC" && m.specialisation === "Communication and Sensing")!;
    expect(specialisation.entries).toEqual(programme.entries);
  });

  it("keeps the courses recommended to every applicant apart from those recommended to a programme's students", () => {
    expect(masters.find((m) => m.code === "MPCOS" && m.specialisation === null)!.recommended.map((c) => c.codes)).toEqual([
      ["DAT026"],
      ["DAT710"],
    ]);
    expect(entry("MPBEN", "TKSAM")![0]!.recommended.map((c) => c.codes)).toEqual([["BOM365"], ["BOM375"]]);
  });
});

describe("parseGuide with corrections", () => {
  const typo = {
    master: "MPEEE",
    specialisation: null,
    programme: "TKDAT",
    guide: "EEM031/EEF015 Elektromagnetisk fältteori",
    corrected: "EEF031/EEM015 Elektromagnetisk fältteori",
    reason: "The guide swapped the prefixes of the codes.",
  };
  const corrected = parseGuide(pages, [typo]);
  const mpeee = (programme: string) =>
    corrected.masters.find((m) => m.code === "MPEEE" && m.specialisation === null)!.entries.find((e) => e.programme === programme)!;

  it("reads the line of the programme's requirements as corrected, and keeps what the guide says", () => {
    const { admission, corrections } = mpeee("TKDAT");
    expect(admission.kind === "courses" && admission.rule.kind === "all" && admission.rule.of[0]).toEqual(
      course(["EEF031", "EEM015"], "Elektromagnetisk fältteori"),
    );
    expect(corrections).toEqual([{ guide: typo.guide, corrected: typo.corrected }]);
    expect(corrected.unused).toEqual([]);
  });

  it("leaves the requirements of the other programmes as the guide words them", () => {
    expect(mpeee("TKAUT").corrections).toEqual([]);
    expect(corrected.problems).toEqual(problems);
  });

  it("lists a correction of a line the guide no longer words so", () => {
    const fixed = { ...typo, guide: "EEM031 Elektromagnetisk fältteori" };
    expect(parseGuide(pages, [fixed]).unused).toEqual([fixed]);
  });
});
