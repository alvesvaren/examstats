import { z } from "zod";
import type { Named } from "./snapshot.ts";

const namesSchema = z.object({ en: z.string(), sv: z.string() });

/** The committed file that `pnpm programme-plans` writes and `pnpm snapshot` reads: Chalmers' names since 2021/2022, the newest per code. */
export const namesFileSchema = z.object({
  programmes: z.record(z.string(), namesSchema),
  courses: z.array(namesSchema.extend({ code: z.string() })),
});
export type NamesFile = z.infer<typeof namesFileSchema>;
export type Names = z.infer<typeof namesSchema>;

/** A name in English and in Swedish. Both are `fallback` when Chalmers has no names for it. */
export const nameOf = (names: Names | undefined, fallback: string) => ({
  name: names?.en || fallback,
  swedishName: names?.sv || fallback,
});

export const languageSchema = z.enum(["en", "sv"]);
export const LANGUAGES = languageSchema.options;
export type Language = z.infer<typeof languageSchema>;

/** Named in a language: `name` in it, and `otherName` in the other one, which search also matches. */
export interface InLanguage {
  name: string;
  otherName: string;
}

/** `named` with `name` in `language`. Its `swedishName` stays Swedish. */
export const inLanguage = <T extends Named>(named: T, language: Language): T & InLanguage =>
  language === "sv" ? { ...named, name: named.swedishName, otherName: named.name } : { ...named, otherName: named.swedishName };
