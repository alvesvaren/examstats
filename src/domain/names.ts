import { z } from "zod";

/** Names in English and Swedish. Each is the other when Chalmers names only one, and both are the source's name when Chalmers names neither. */
export const namedSchema = z.object({ name: z.string(), swedishName: z.string() });
export type Named = z.infer<typeof namedSchema>;

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

/** `text` in lower case without diacritics, for comparing names and matching them against a query. */
export const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** A programme's name in the language not shown, or undefined when Chalmers names it the same in both languages. */
export function otherNameOf(names: Readonly<Record<string, InLanguage>>, code: string) {
  const named = names[code];
  return named && normalize(named.otherName) !== normalize(named.name) ? named.otherName : undefined;
}

/** `named` with `name` in `language`. Its `swedishName` stays Swedish. */
export const inLanguage = <T extends Named>(named: T, language: Language): T & InLanguage =>
  language === "sv" ? { ...named, name: named.swedishName, otherName: named.name } : { ...named, otherName: named.swedishName };
