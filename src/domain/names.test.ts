import { describe, expect, it } from "vitest";
import { nameOf } from "./names.ts";

describe("nameOf", () => {
  it("takes Chalmers' English name to show and its Swedish name to search", () => {
    expect(nameOf({ en: "Databases", sv: "Databaser" }, "Databaser")).toEqual({ name: "Databases", swedishName: "Databaser" });
  });

  it("uses the source's name in both languages when Chalmers has none", () => {
    expect(nameOf(undefined, "Linjär algebra")).toEqual({ name: "Linjär algebra", swedishName: "Linjär algebra" });
  });
});
