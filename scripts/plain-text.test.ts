import { describe, expect, it } from "vitest";
import { toPlainText } from "./plain-text.ts";

describe("toPlainText", () => {
  it("puts each list item and line break on its own line and decodes entities", () => {
    const html =
      '<div style="">The entry requirement is <br><ul><li>BSc degree in Computer Science or equivalent, </li><li>Completed 7.5 hec in computer security&nbsp;&amp; logic&#46;</li></ul></div>';
    expect(toPlainText(html)).toBe(
      "The entry requirement is\nBSc degree in Computer Science or equivalent,\nCompleted 7.5 hec in computer security & logic.",
    );
  });

  it("drops the Word markup that some syllabi carry in HTML comments", () => {
    const html =
      "<p>Only students admitted to the programme.</p><!--[if gte mso 9]><xml><w:WordDocument><w:View>Normal</w:View><w:Zoom>0</w:Zoom></w:WordDocument></xml><![endif]-->";
    expect(toPlainText(html)).toBe("Only students admitted to the programme.");
  });
});
