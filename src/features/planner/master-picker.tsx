import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Catalog } from "@/domain/catalog";
import { otherNameOf } from "@/domain/names";
import { masterSummary, type Accreditation } from "@/domain/planner";
import { academicYearOf, trackKind, type ProgrammePlan, type UpcomingMasters } from "@/domain/programme-plans";
import { useMessages } from "@/hooks/use-messages";
import { ChalmersLink, Prerequisites, Specialisations } from "./master-details";

interface MasterPickerProps {
  programme: ProgrammePlan;
  /** The master's programmes that complete `programme`'s degree. */
  masters: readonly ProgrammePlan[];
  /** What each master's programme needs to complete the degree, by code. */
  accredited: ReadonlyMap<string, Accreditation>;
  catalog: Catalog;
  onChoose: (code: string) => void;
}

/** The master's programmes a programme leads on to, each in short, to choose the fourth and fifth year from. */
export function MasterPicker({ programme, masters, accredited, catalog, onChoose }: MasterPickerProps) {
  const t = useMessages();
  const options = masters
    .toSorted((a, b) => a.name.localeCompare(b.name, "sv"))
    .map((master) => ({
      master,
      summary: masterSummary(master),
      otherName: otherNameOf(catalog.programmes, master.code),
      accreditation: accredited.get(master.code) ?? { specialisations: [], courseList: null },
    }));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{t.planner.chooseMaster}</h2>
        <p className="text-sm text-muted-foreground">{t.planner.mastersIntro(masters.length, programme.name)}</p>
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
  accreditation: Accreditation;
  onChoose: () => void;
}

function MasterOption({ master, summary, otherName, accreditation, onChoose }: MasterOptionProps) {
  const t = useMessages();
  const { tracks, compulsory, compulsoryCredits, electives } = summary;
  const facts = [
    tracks.length > 0 && t.planner.trackCount(trackKind(master.code), tracks.length),
    compulsoryCredits > 0 ? t.planner.compulsoryCredits(compulsoryCredits) : t.planner.nothingCompulsory,
    t.planner.electives(electives),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex h-full flex-col rounded-xl border transition-colors has-[>button:hover]:border-primary has-[>button:hover]:bg-muted/50">
      <button type="button" onClick={onChoose} className="flex flex-1 flex-col gap-1 px-3 pt-2.5 pb-2 text-left">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{master.name}</span>
          <span className="text-sm text-muted-foreground">{[master.code, otherName].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="text-sm">{facts}</span>
        {compulsory.length > 0 && (
          <span className="line-clamp-2 text-xs text-muted-foreground">{t.planner.compulsory(compulsory.map((c) => c.name))}</span>
        )}
        <Specialisations names={accreditation.specialisations} className="text-xs" />
      </button>
      <ChalmersLink code={master.code} courseList={accreditation.courseList} className="self-start px-3 pb-2 text-xs" />
      {master.prerequisites.length > 0 && (
        <Prerequisites paragraphs={master.prerequisites} className="px-3 pb-2.5 text-xs">
          {t.planner.prerequisites}
        </Prerequisites>
      )}
    </div>
  );
}

const linkClass = "text-foreground underline underline-offset-4";

function Note({ children }: { children: ReactNode }) {
  return (
    <p role="note" className="flex gap-2 rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground">
      <InfoIcon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

interface MastersNotPublishedProps {
  /** The year the student's master's programme starts, as its first calendar year. */
  year: number;
  /** The academic year of the current plans. */
  shown: string;
  /** The master's programmes Chalmers has announced, shown instead of the current ones when it has. */
  upcoming: UpcomingMasters | null;
}

/**
 * Says where the master's programmes shown come from, since Chalmers has not published those of the student's fourth
 * year yet: its accreditation matrix and course lists of an upcoming year, or else this year's plans.
 */
export function MastersNotPublished({ year, shown, upcoming }: MastersNotPublishedProps) {
  const t = useMessages();
  const mastersLink = (
    <a href={t.chalmers.masters} target="_blank" rel="noreferrer" className={linkClass}>
      {t.planner.mastersOnChalmers}
    </a>
  );
  if (!upcoming) {
    return (
      <Note>
        {t.planner.mastersNotPublished(academicYearOf(year), shown)} {mastersLink}
      </Note>
    );
  }
  return (
    <Note>
      {t.planner.upcomingMasters(academicYearOf(year), upcoming.academicYear, shown)}{" "}
      <a href={upcoming.matrix} className={linkClass}>
        {t.planner.accreditationMatrix}
      </a>{" "}
      · {mastersLink}
    </Note>
  );
}
