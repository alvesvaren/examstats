import { Link, useNavigate } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { searchProgrammes } from "@/domain/planner";
import { usePlannerMemory } from "@/hooks/use-planner-memory";
import type { ProgrammePlan } from "@/domain/programme-plans";
import { PLANNER_HEADING } from "@/lib/page-meta";

interface ProgrammeSearchProps {
  programmes: readonly ProgrammePlan[];
  /** Swedish programme names by code, which is how most students know their programme. */
  swedishNames: Readonly<Record<string, string>>;
}

/** The planner before a programme is picked: a search over every programme, by code or by name in either language. */
export function ProgrammeSearch({ programmes, swedishNames }: ProgrammeSearchProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { remember } = usePlannerMemory();
  const rememberProgramme = (code: string) => remember((m) => ({ ...m, last: { programme: code } }));
  const matches = searchProgrammes(programmes, swedishNames, query);
  const [best] = matches;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{PLANNER_HEADING}</h1>
        <p className="text-muted-foreground">Find your programme to plan a year of courses.</p>
      </div>
      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          if (!best) return;
          rememberProgramme(best.code);
          void navigate({ to: "/planner", search: { programme: best.code } });
        }}
      >
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Programme, such as Datateknik or TKDAT"
          aria-label="Search programmes"
          autoComplete="off"
          spellCheck={false}
          className="h-10 pl-9 text-base"
        />
      </form>
      {matches.length === 0 && <p className="py-6 text-center text-muted-foreground">No programme matches.</p>}
      <ul className="grid gap-1 sm:grid-cols-2">
        {matches.map((programme) => (
          <li key={programme.code}>
            <Link
              to="/planner"
              search={{ programme: programme.code }}
              onClick={() => rememberProgramme(programme.code)}
              className="flex h-full flex-col rounded-md border px-3 py-2 hover:bg-muted/50"
            >
              <span className="font-medium">{programme.name}</span>
              <span className="text-sm text-muted-foreground">
                {[programme.code, swedishNames[programme.code]].filter(Boolean).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
