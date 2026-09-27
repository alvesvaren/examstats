import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useRef, useState } from "react";

const OVERSCAN = 10;

/** Virtualizes a list that scrolls with the page. Rows are measured, so their height may vary. */
export function useWindowVirtualList({ count, estimateSize }: { count: number; estimateSize: number }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // Content above the list changes with search and scope, so its offset is re-read after every render.
  useLayoutEffect(() => {
    setScrollMargin(listRef.current?.offsetTop ?? 0);
  });

  const virtualizer = useWindowVirtualizer({ count, estimateSize: () => estimateSize, overscan: OVERSCAN, scrollMargin });
  return { listRef, virtualizer };
}
