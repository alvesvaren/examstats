import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { cn } from "cn";
import type { SortDir } from "@/domain/catalog";

interface SortHeaderProps<K extends string> {
  sortKey: K;
  label: string;
  /** The key the list is sorted by. */
  sort: K;
  dir: SortDir;
  onSort: (key: K) => void;
  /** Lays the header out in its table, such as its alignment. */
  className?: string;
  /** Controls after the label, such as an explanation or the survey question picker. */
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** A column header that sorts by its column, and shows the order when the list is sorted by it. */
export function SortHeader<K extends string>({ sortKey, label, sort, dir, onSort, className, children, ref }: SortHeaderProps<K>) {
  const active = sortKey === sort;
  const Arrow = dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <div
      ref={ref}
      className={cn("flex items-center gap-1", className)}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn("inline-flex items-center gap-0.5 font-medium whitespace-nowrap hover:text-foreground", active && "text-foreground")}
      >
        {label}
        {active && <Arrow className="size-3" aria-hidden />}
      </button>
      {children}
    </div>
  );
}
