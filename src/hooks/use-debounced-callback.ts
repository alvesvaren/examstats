import { useEffect, useRef } from "react";

/** Returns a function that calls `callback` once calls have stopped for `delay` ms. */
export function useDebouncedCallback<A extends unknown[]>(callback: (...args: A) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (...args: A) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => callback(...args), delay);
  };
}
