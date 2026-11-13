import { describe, expect, it } from "vitest";
import { paragraphsOf } from "./plain-text.ts";

describe("paragraphsOf", () => {
  it("splits plain text on its line breaks and drops empty lines", () => {
    expect(paragraphsOf("Mathematics (at least 30 cr.), Programming\r\nPreferable course experience: Matlab\r\n\r\n")).toEqual([
      "Mathematics (at least 30 cr.), Programming",
      "Preferable course experience: Matlab",
    ]);
  });

  it("reads HTML blocks as paragraphs and decodes entities", () => {
    const html =
      '<div style=""><font face="Arial"><span>Mathematics,&nbsp; Programming&nbsp;</span></font></div><div>Fields &amp; Waves<br>Matlab</div><div><br></div>';
    expect(paragraphsOf(html)).toEqual(["Mathematics, Programming", "Fields & Waves", "Matlab"]);
  });

  it("turns Windows-1252 punctuation into the characters it stands for", () => {
    expect(paragraphsOf("Bachelor\u0092s degree, Stress \u0096 Strain")).toEqual(["Bachelor’s degree, Stress – Strain"]);
  });

  it("has no paragraphs for an empty text", () => {
    expect(paragraphsOf("")).toEqual([]);
  });
});
