const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };
/** Windows-1252 punctuation that chalmers.se passes on as the C1 control characters of the same codes. */
const WINDOWS_1252: Record<string, string> = {
  "\u0091": "‘",
  "\u0092": "’",
  "\u0093": "“",
  "\u0094": "”",
  "\u0096": "–",
  "\u0097": "—",
};
const WINDOWS_1252_CHARS = new RegExp(`[${Object.keys(WINDOWS_1252).join("")}]`, "g");

/**
 * The paragraphs of a text that may hold HTML, one per line or block, with tags and comments dropped and spaces
 * collapsed. Some texts pasted from Word carry its settings in a comment.
 */
export function paragraphsOf(text: string): string[] {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>|<\/(?:div|p|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(\w+|#\d+);/g,
      (entity, name: string) => ENTITIES[name] ?? (name.startsWith("#") ? String.fromCodePoint(Number(name.slice(1))) : entity),
    )
    .replace(WINDOWS_1252_CHARS, (char) => WINDOWS_1252[char] ?? char)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
