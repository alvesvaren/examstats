/**
 * JSON with one list item per line, so a committed data file diffs line by line.
 * `fields` come first on one line, then the items of `list` under `key`.
 */
export function toJsonLines(fields: Record<string, unknown>, key: string, list: readonly unknown[]): string {
  const head = Object.entries(fields).map(([name, value]) => `${JSON.stringify(name)}:${JSON.stringify(value)},`);
  return `{${head.join("")}${JSON.stringify(key)}:[\n${list.map((item) => JSON.stringify(item)).join(",\n")}\n]}\n`;
}
