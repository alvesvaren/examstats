import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useRef, useState } from "react";

const OVERSCAN = 8;

interface Options {
  count: number;
  /** Exact row height in pixels. Fixed heights keep rows from shifting while the list scrolls. */
  rowHeight: (index: number) => number;
  getItemKey: (index: number) => string;
}

/** Virtualizes a list that scrolls with the page. */
export function useWindowVirtualList({ count, rowHeight, getItemKey }: Options) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // The list's offset only changes when something on the page changes size, so it is not re-read on scroll.
  useLayoutEffect(() => {
    const measure = () => setScrollMargin(listRef.current?.offsetTop ?? 0);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  const virtualizer = useWindowVirtualizer({ count, estimateSize: rowHeight, getItemKey, overscan: OVERSCAN, scrollMargin });
  return { listRef, virtualizer };
}
