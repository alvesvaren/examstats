import { ChevronRightIcon, ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Catalog } from "@/domain/catalog";
import { masterSummary, otherNameOf } from "@/domain/planner";
import { programmeUrl, type ProgrammePlan } from "@/domain/programme-plans";
import { formatCount, formatCredits, formatPercent, formatScore } from "@/lib/format";
import { cn } from "@/lib/utils";

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
    .toSorted((a, b) => a.name.localeCompare(b.name, "sv"))
    .map((master) => ({ master, summary: masterSummary(master, stats), otherName: otherNameOf(catalog.programmes, master.code) }));

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
  otherName: string | undefined;
  onChoose: () => void;
}

function MasterOption({ master, summary, otherName, onChoose }: MasterOptionProps) {
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
    <div className="flex h-full flex-col rounded-xl border transition-colors has-[>button:hover]:border-primary has-[>button:hover]:bg-muted/50">
      <button type="button" onClick={onChoose} className="flex flex-1 flex-col gap-1 px-3 pt-2.5 pb-2 text-left">
        <span className="font-medium">{master.name}</span>
        <span className="text-sm text-muted-foreground">{[master.code, otherName].filter(Boolean).join(" · ")}</span>
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
      <ChalmersLink code={master.code} className="self-start px-3 pb-2 text-xs" />
      {master.prerequisites.length > 0 && (
        <Prerequisites paragraphs={master.prerequisites} className="px-3 pb-2.5 text-xs">
          Prerequisites
        </Prerequisites>
      )}
    </div>
  );
}

interface PrerequisitesProps {
  /** Paragraphs of a master's programme's prerequisites, as its syllabus words them. */
  paragraphs: readonly string[];
  /** The label of the button that shows them. */
  children: ReactNode;
  className?: string;
}

/** A master's programme's prerequisites behind a button, since they run to several lines. */
export function Prerequisites({ paragraphs, children, className }: PrerequisitesProps) {
  return (
    <details className={cn("group", className)}>
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="size-3.5 transition-transform group-open:rotate-90" />
        {children}
      </summary>
      <div className="mt-1 flex max-w-prose flex-col gap-1">
        {paragraphs.map((paragraph, index) => (
          // The paragraphs never change order, and a short one such as "or" can repeat.
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </details>
  );
}

/** The programme's syllabus and plan on chalmers.se. */
export function ChalmersLink({ code, className }: { code: string; className?: string }) {
  return (
    <a
      href={programmeUrl(code)}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline",
        className,
      )}
    >
      chalmers.se
      <ExternalLinkIcon className="size-3.5" />
    </a>
  );
}
