import { ChevronRightIcon, ExternalLinkIcon, InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Catalog } from "@/domain/catalog";
import { otherNameOf } from "@/domain/names";
import { masterSummary, type Accreditation } from "@/domain/planner";
import { academicYearOf, type ProgrammePlan, type UpcomingMasters } from "@/domain/programme-plans";
import { useMessages } from "@/hooks/use-messages";
import { cn } from "cn";

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
  const stats = new Map(catalog.courses.map((c) => [c.code, c]));
  const options = masters
    .toSorted((a, b) => a.name.localeCompare(b.name, "sv"))
    .map((master) => ({
      master,
      summary: masterSummary(master, stats),
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
  const { tracks, compulsory, compulsoryCredits, electives, passRate, rating } = summary;
  const facts = [
    tracks.length > 0 && t.planner.tracks(tracks.length),
    compulsoryCredits > 0 ? t.planner.compulsoryCredits(compulsoryCredits) : t.planner.nothingCompulsory,
    t.planner.electives(electives),
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
              {t.list.columns.passRate} <span className="font-medium text-foreground tabular-nums">{t.format.percent(passRate)}</span> ·{" "}
              {t.survey.questions.overall.short} <span className="font-medium text-foreground tabular-nums">{t.format.score(rating)}</span>
            </>
          ) : (
            t.noResultsYet
          )}
        </span>
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

interface ChalmersLinkProps {
  code: string;
  /** The course list of a master's programme that has no syllabus yet, linked instead. */
  courseList?: string | null;
  className?: string;
}

/** The programme's syllabus and plan on chalmers.se, or the course list of an upcoming master's programme. */
export function ChalmersLink({ code, courseList, className }: ChalmersLinkProps) {
  const t = useMessages();
  return (
    <a
      href={courseList ?? t.chalmers.programme(code)}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline",
        className,
      )}
    >
      {courseList ? t.planner.courseList : "chalmers.se"}
      <ExternalLinkIcon className="size-3.5" />
    </a>
  );
}

/** Says that a master's programme leads to the degree only with one of some of its specialisations. Nothing when any will do. */
export function Specialisations({ names, className }: { names: readonly string[]; className?: string }) {
  const t = useMessages();
  if (names.length === 0) return null;
  return <span className={cn("block text-muted-foreground", className)}>{t.planner.specialisations(names)}</span>;
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

interface UnplannedCoursesProps {
  master: string;
  /** Courses on the master's programme's course list for the year shown that no current plan gives. */
  names: readonly string[];
  /** The academic year of the current plans. */
  shown: string;
  courseList: string | null;
}

/** The courses of an upcoming master's programme's year that the planner cannot place, since none of this year's plans gives them. */
export function UnplannedCourses({ master, names, shown, courseList }: UnplannedCoursesProps) {
  const t = useMessages();
  return (
    <Note>
      {t.planner.unplanned(master, names, shown)}{" "}
      {courseList && (
        <a href={courseList} target="_blank" rel="noreferrer" className={linkClass}>
          {t.planner.courseList}
        </a>
      )}
    </Note>
  );
}
