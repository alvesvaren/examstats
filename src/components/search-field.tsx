import { SearchIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

/** The text field of a search: a search icon in front of the input, with 16px text because iOS zooms into smaller fields. */
export function SearchField({ className, ...props }: Omit<ComponentProps<typeof Input>, "type">) {
  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" autoComplete="off" spellCheck={false} className="h-10 pl-9 text-base" {...props} />
    </div>
  );
}
