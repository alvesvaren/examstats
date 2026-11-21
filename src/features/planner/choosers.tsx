import type { ReactNode } from "react";
import { NO_TRACK } from "@/domain/planner-state";
import { academicYearOf, type TrackKind } from "@/domain/programme-plans";
import { useMessages } from "@/hooks/use-messages";

/** A choice the planner needs before it can show the right plan: a heading, why it matters, and a button per option. */
function Choice({ heading, hint, children }: { heading: string; hint: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{heading}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function Option({ label, detail, onClick }: { label: string; detail?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-muted/50"
    >
      <span className="font-medium">{label}</span>
      {detail && <span className="text-sm text-muted-foreground">{detail}</span>}
    </button>
  );
}

interface StartChooserProps {
  /** The years the programme admitted students in, oldest first. */
  admitted: readonly number[];
  onChoose: (start: number) => void;
}

/** Asks which year the student started the programme in, since its plan and its master's programmes depend on it. */
export function StartChooser({ admitted, onChoose }: StartChooserProps) {
  const t = useMessages();
  return (
    <Choice heading={t.planner.chooseStart} hint={t.planner.chooseStartHint}>
      {admitted.toReversed().map((year) => (
        <Option key={year} label={t.planner.started(academicYearOf(year))} onClick={() => onChoose(year)} />
      ))}
    </Choice>
  );
}

interface TrackChooserProps {
  kind: TrackKind;
  /** The name of the plan the tracks belong to. */
  planName: string;
  tracks: readonly string[];
  /** Takes a track, or `NO_TRACK`. */
  onChoose: (track: string) => void;
}

/** Asks which track the student follows, or none, since the track decides what is compulsory. */
export function TrackChooser({ kind, planName, tracks, onChoose }: TrackChooserProps) {
  const t = useMessages();
  return (
    <Choice heading={t.planner.chooseTrack(kind)} hint={t.planner.chooseTrackHint(kind, planName)}>
      {tracks.map((track) => (
        <Option key={track} label={track} onClick={() => onChoose(track)} />
      ))}
      <Option label={t.planner.noTrack(kind)} detail={t.planner.everyTrack} onClick={() => onChoose(NO_TRACK)} />
    </Choice>
  );
}
