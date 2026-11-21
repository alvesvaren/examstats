import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { sentenceCase, toCourseHead, toParts, toProgrammes, upstreamCourseSchema, upstreamResultsSchema } from "./fetch-results.ts";

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`fixtures/${name}`, import.meta.url), "utf8"));

const courses = z.object({ courses: z.array(upstreamCourseSchema) }).parse(fixture("stats-courses.json")).courses;

describe("sentenceCase", () => {
  it("lowercases everything but the first letter, including Swedish letters", () => {
    expect(sentenceCase("INFORMATIONSTEKNIK, CIVILINGENJÖR")).toBe("Informationsteknik, civilingenjör");
  });
});

describe("toCourseHead", () => {
  it("has no programme for the course the source gives programme '-'", () => {
    expect(courses.map(toCourseHead)).toEqual([
      { code: "CIUX03", name: "Kandidatarbete vid Tillämpad informationsteknologi", programme: "TKITE" },
      { code: "CIU250", name: "Interkulturell kommunikativ kompetens", programme: "SPRAK" },
      { code: "ACE615", name: "Form, rum och struktur", programme: null },
      { code: "CTE031", name: "Teknikhistoria", programme: "MTS" },
    ]);
  });
});

describe("toProgrammes", () => {
  it("names a programme by its long name in sentence case, or by its code when the long name is '-'", () => {
    expect(toProgrammes(courses)).toEqual({
      MTS: "MTS",
      SPRAK: "SPRAK",
      TKITE: "Informationsteknik, civilingenjör",
    });
  });

  it("trims the long name and treats a missing one like '-'", () => {
    expect(
      toProgrammes([
        { courseCode: "A", courseName: "A", programShort: "XA", programLong: "  ARKITEKTUR " },
        { courseCode: "B", courseName: "B", programShort: "XB" },
      ]),
    ).toEqual({ XA: "Arkitektur", XB: "XB" });
  });
});

describe("toParts", () => {
  it("groups the results of TDA357 into an exam and a lab, with sittings oldest first and a repeated sitting summed", () => {
    const results = upstreamResultsSchema.parse(fixture("stats-results.json"));
    expect(toParts(results)).toEqual([
      {
        type: "Tentamen",
        code: "0106",
        sittings: [
          { date: "2025-01-15", grades: { U: 62, "3": 40, "4": 32, "5": 18, G: 0, VG: 0, TG: 0 } },
          { date: "2025-03-21", grades: { U: 60, "3": 51, "4": 26, "5": 18, G: 0, VG: 0, TG: 0 } },
          { date: "2025-08-28", grades: { U: 36, "3": 12, "4": 1, "5": 2, G: 0, VG: 0, TG: 0 } },
        ],
      },
      {
        type: "Laboration",
        code: "0206",
        sittings: [
          { date: "2021-09-06", grades: { U: 0, "3": 0, "4": 0, "5": 0, G: 2, VG: 0, TG: 0 } },
          { date: "2025-03-16", grades: { U: 6, "3": 0, "4": 0, "5": 0, G: 107, VG: 0, TG: 0 } },
          { date: "2025-03-17", grades: { U: 1, "3": 0, "4": 0, "5": 0, G: 0, VG: 0, TG: 0 } },
        ],
      },
    ]);
  });
});
