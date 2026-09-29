import { useRef } from "react";

/** Returns a ref and a function that scrolls the page up to the top of that element, if the page has scrolled past it. */
export function useScrollBack<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const scrollBack = () => {
    if (!ref.current) return;
    const top = ref.current.getBoundingClientRect().top + window.scrollY;
    if (window.scrollY > top) window.scrollTo({ top });
  };
  return { ref, scrollBack };
}
