import { z } from "zod";

const namesSchema = z.object({ en: z.string(), sv: z.string() });

/** The committed file that `pnpm programme-plans` writes and `pnpm snapshot` reads: Chalmers' names since 2021/2022, the newest per code. */
export const namesFileSchema = z.object({
  programmes: z.record(z.string(), namesSchema),
  courses: z.array(namesSchema.extend({ code: z.string() })),
});
export type NamesFile = z.infer<typeof namesFileSchema>;
export type Names = z.infer<typeof namesSchema>;

/** A name the UI shows in English, and its Swedish name for search. Both are `fallback` when Chalmers has no names for it. */
export const nameOf = (names: Names | undefined, fallback: string) => ({
  name: names?.en || fallback,
  swedishName: names?.sv || fallback,
});
