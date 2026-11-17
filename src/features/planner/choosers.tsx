import type { ReactNode } from "react";
import { NO_TRACK } from "@/domain/planner";
import { academicYearOf } from "@/domain/programme-plans";

/** A choice the planner needs before it can show the right plan, as a heading and one button per option. */
function Choice({ heading, hint, children }: { heading: string; hint: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{heading}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function Option({ label, detail, onClick }: { label: string; detail?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col rounded-md border px-3 py-2 text-left hover:bg-muted/50">
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

/** Asks which year the student started the programme, since its plan, and its master's programmes, depend on it. */
export function StartChooser({ admitted, onChoose }: StartChooserProps) {
  return (
    <Choice
      heading="When did you start the programme?"
      hint="Each year's students follow the plan of the year they started, so the courses and when they run depend on it."
    >
      {admitted.toReversed().map((year) => (
        <Option key={year} label={`Started ${academicYearOf(year)}`} onClick={() => onChoose(year)} />
      ))}
    </Choice>
  );
}

interface TrackChooserProps {
  /** "specialisation" or "concentration", as Chalmers calls the plan's tracks. */
  noun: string;
  planName: string;
  tracks: readonly string[];
  onChoose: (track: string) => void;
}

/** Asks which specialisation or concentration the student follows, since it decides what is compulsory. */
export function TrackChooser({ noun, planName, tracks, onChoose }: TrackChooserProps) {
  return (
    <Choice heading={`Which ${noun} do you follow?`} hint={`${planName} has ${noun}s with courses of their own. You can change it later.`}>
      {tracks.map((track) => (
        <Option key={track} label={track} onClick={() => onChoose(track)} />
      ))}
      <Option label={`No ${noun}`} detail="Shows the courses of all of them" onClick={() => onChoose(NO_TRACK)} />
    </Choice>
  );
}
