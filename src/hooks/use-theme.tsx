import { createContext, use, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";

/** Also read by the inline script in index.html, which applies the theme before first paint. */
const STORAGE_KEY = "u345-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/** Keeps the `dark` class on <html> in sync with the chosen theme and, for "system", with the OS. */
function useApplyTheme(theme: Theme) {
  useEffect(() => {
    const media = matchMedia(DARK_QUERY);
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches));
    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}

const ThemeContext = createContext<{ toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(readStoredTheme);
  useApplyTheme(theme);

  const toggle = () => {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private windows can refuse storage. The theme still applies for this visit.
    }
    setTheme(next);
  };

  return <ThemeContext value={{ toggle }}>{children}</ThemeContext>;
}

// oxlint-disable-next-line react/only-export-components -- The provider and its hook share a private context.
export function useTheme() {
  const context = use(ThemeContext);
  if (!context) throw new Error("useTheme needs a ThemeProvider");
  return context;
}
