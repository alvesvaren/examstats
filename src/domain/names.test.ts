import { describe, expect, it } from "vitest";
import { inLanguage, nameOf, otherNameOf } from "./names.ts";

describe("nameOf", () => {
  it("takes Chalmers' English and Swedish names", () => {
    expect(nameOf({ en: "Databases", sv: "Databaser" }, "Databaser")).toEqual({ name: "Databases", swedishName: "Databaser" });
  });

  it("uses the source's name in both languages when Chalmers has none", () => {
    expect(nameOf(undefined, "Linjär algebra")).toEqual({ name: "Linjär algebra", swedishName: "Linjär algebra" });
  });
});

describe("inLanguage", () => {
  const databases = { code: "TDA357", name: "Databases", swedishName: "Databaser" };

  it("names a course in Swedish with its English name as the other one", () => {
    expect(inLanguage(databases, "sv")).toEqual({ ...databases, name: "Databaser", otherName: "Databases" });
  });

  it("names a course in English with its Swedish name as the other one", () => {
    expect(inLanguage(databases, "en")).toEqual({ ...databases, otherName: "Databaser" });
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
