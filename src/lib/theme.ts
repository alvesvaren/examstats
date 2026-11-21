export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: string): value is Theme {
  return THEMES.some((theme) => theme === value);
}
