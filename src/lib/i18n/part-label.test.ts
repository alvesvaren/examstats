import { describe, expect, it } from "vitest";
import { partLabel } from "./part-label.ts";

describe("partLabel", () => {
  it("translates the part type and keeps the part letter", () => {
    expect(["Tentamen", "Laboration, del A", "Muntlig tentamen", "Okänd typ"].map(partLabel)).toEqual([
      "Exam",
      "Lab, part A",
      "Oral exam",
      "Okänd typ",
    ]);
  });
});
