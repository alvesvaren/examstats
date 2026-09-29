import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
};

/** Whether the page has scrolled further down than `offset` pixels. Re-renders only when that flips. */
export function useScrolledPast(offset: number) {
  return useSyncExternalStore(subscribe, () => window.scrollY > offset);
}
