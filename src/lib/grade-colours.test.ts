/// <reference types="node" />
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { GRADES } from "../domain/grades.ts";
import { GRADE_COLOURS } from "./grade-colours.ts";

it("matches the light theme's grade tokens", async () => {
  const css = await readFile(new URL("../index.css", import.meta.url), "utf8");
  const lightTheme = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));
  const tokens = Object.fromEntries(
    GRADES.map((grade) => [grade, lightTheme.match(new RegExp(`--grade-${grade.toLowerCase()}: (#[0-9a-f]+);`))?.[1]]),
  );
  expect(GRADE_COLOURS).toEqual(tokens);
});
