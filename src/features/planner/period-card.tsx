import { LockIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { creditsIn, lectureClash, PERIOD_CREDITS, type PlannerRound } from "@/domain/planner";
import type { StudyPeriod } from "@/domain/programme-plans";
import { useMessages } from "@/hooks/use-messages";

interface PeriodCardProps {
  period: StudyPeriod;
  /** Rounds in this study period that every student takes. */
  fixed: PlannerRound[];
  picked: PlannerRound[];
  active: boolean;
  onFocus: () => void;
  onRemove: (round: PlannerRound) => void;
}

/** A study period of the year with what is in it, how full it is, and whether two of its courses meet. */
export function PeriodCard({ period, fixed, picked, active, onFocus, onRemove }: PeriodCardProps) {
  const t = useMessages();
  const rounds = [...fixed, ...picked];
  const credits = creditsIn(rounds, period);
  const free = PERIOD_CREDITS - credits;
  const pace = credits > PERIOD_CREDITS ? ` (${t.format.percent(credits / PERIOD_CREDITS)})` : "";
  const fill = `${t.of(t.format.number(credits), t.credits(PERIOD_CREDITS))}${pace}`;
  const clashing = rounds.some((round) => lectureClash(round, rounds));
  return (
    <div
      className={cn(
        "relative flex flex-col gap-1.5 rounded-xl border-2 p-2.5 transition-colors",
        active ? "border-primary bg-card shadow-md" : "border-transparent bg-muted/60 hover:bg-muted",
      )}
    >
      <button
        type="button"
        onClick={onFocus}
        aria-pressed={active}
        aria-label={`${t.periods([period])}, ${fill}`}
        className="flex flex-col gap-1 text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-lg leading-none font-semibold">{t.periods([period])}</span>
          <span className={cn("text-right text-xs tabular-nums", free < 0 ? "font-semibold text-grade-u" : "text-muted-foreground")}>
            {fill}
          </span>
        </span>
        <span className="h-1.5 overflow-hidden rounded-full bg-border">
          <span
            className={cn("block h-full rounded-full", free < 0 ? "bg-grade-u" : "bg-primary")}
            style={{ width: `${Math.min(1, credits / PERIOD_CREDITS) * 100}%` }}
          />
        </span>
      </button>
      {fixed.map((round) => (
        <span key={round.key} className="pointer-events-none flex items-center gap-1.5 text-sm text-muted-foreground">
          <LockIcon className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{round.name}</span>
          <Span round={round} />
        </span>
      ))}
      {picked.map((round) => (
        <span
          key={round.key}
          className="pointer-events-none flex items-center gap-1.5 rounded-md bg-primary px-1.5 py-0.5 text-sm text-primary-foreground"
        >
          <span className="truncate">{round.name}</span>
          <Span round={round} />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(round);
            }}
            aria-label={t.planner.remove(round.name)}
            className="pointer-events-auto relative z-10 -mr-0.5 shrink-0 opacity-70 hover:opacity-100"
          >
            <XIcon className="size-3.5" />
          </button>
        </span>
      ))}
      {clashing && <span className="pointer-events-none text-xs font-medium text-grade-u">{t.planner.shareLectures}</span>}
      {free > 0 && (
        <span className="pointer-events-none rounded-md border border-dashed px-1.5 py-0.5 text-left text-sm text-muted-foreground">
          {t.planner.roomFor(free)}
        </span>
      )}
    </div>
  );
}

/** The study periods of a round that runs over several, so its other periods explain themselves. */
function Span({ round }: { round: PlannerRound }) {
  const t = useMessages();
  return <span className="ml-auto shrink-0 text-xs opacity-75">{round.periods.length > 1 && t.periods(round.periods)}</span>;
}
