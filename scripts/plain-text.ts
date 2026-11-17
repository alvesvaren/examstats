const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Syllabus HTML as plain text, with a line per paragraph, list item or line break. */
export function toPlainText(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(br|\/p|\/div|\/li|li|p|div|ul|\/ul|ol|\/ol)\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|\w+);/g, (entity, name: string) =>
      name.startsWith("#") ? String.fromCodePoint(Number(name.slice(1))) : (ENTITIES[name] ?? entity),
    )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
