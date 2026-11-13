import type { Catalog } from "@/domain/catalog";
import { masterSummary } from "@/domain/planner";
import type { ProgrammePlan } from "@/domain/programme-plans";
import { formatCount, formatCredits, formatPercent, formatScore } from "@/lib/format";

interface MasterPickerProps {
  programme: ProgrammePlan;
  /** The master's programmes that complete `programme`'s degree. */
  masters: readonly ProgrammePlan[];
  catalog: Catalog;
  onChoose: (code: string) => void;
}

const plural = (count: number, word: string) => `${formatCount(count)} ${word}${count === 1 ? "" : "s"}`;

/** The master's programmes a programme leads on to, each in short, to choose the fourth and fifth year from. */
export function MasterPicker({ programme, masters, catalog, onChoose }: MasterPickerProps) {
  const stats = new Map(catalog.courses.map((c) => [c.code, c]));
  const options = masters
    .toSorted((a, b) => a.name.localeCompare(b.name, "en"))
    .map((master) => ({ master, summary: masterSummary(master, stats), swedishName: catalog.programmes[master.code] }));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Choose your master's programme</h2>
        <p className="text-sm text-muted-foreground">
          {plural(masters.length, "master's programme")} complete {programme.name} as years 4 and 5. Pass rate and rating are the mean over
          each one's courses with results.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <li key={option.master.code}>
            <MasterOption {...option} onChoose={() => onChoose(option.master.code)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface MasterOptionProps {
  master: ProgrammePlan;
  summary: ReturnType<typeof masterSummary>;
  swedishName: string | undefined;
  onChoose: () => void;
}

function MasterOption({ master, summary, swedishName, onChoose }: MasterOptionProps) {
  const { tracks, compulsory, compulsoryCredits, electives, passRate, rating } = summary;
  const facts = [
    tracks.length > 0 && plural(tracks.length, "track"),
    compulsoryCredits > 0 ? `${formatCredits(compulsoryCredits)} compulsory` : "Nothing compulsory for all",
    plural(electives, "elective"),
  ]
    .filter(Boolean)
    .join(" · ");
  const hasResults = passRate !== null || rating !== null;

  return (
    <button
      type="button"
      onClick={onChoose}
      className="flex h-full w-full flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-muted/50"
    >
      <span className="font-medium">{master.name}</span>
      <span className="text-sm text-muted-foreground">{[master.code, swedishName].filter(Boolean).join(" · ")}</span>
      <span className="text-sm">{facts}</span>
      <span className="text-sm text-muted-foreground">
        {hasResults ? (
          <>
            Pass rate <span className="font-medium text-foreground tabular-nums">{formatPercent(passRate)}</span> · Rating{" "}
            <span className="font-medium text-foreground tabular-nums">{formatScore(rating)}</span>
          </>
        ) : (
          "No results yet"
        )}
      </span>
      {compulsory.length > 0 && (
        <span className="line-clamp-2 text-xs text-muted-foreground">Compulsory: {compulsory.map((c) => c.name).join(", ")}</span>
      )}
    </button>
  );
}
