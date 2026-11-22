import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useMessages } from "@/hooks/use-messages";
import { cn } from "cn";

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

interface CourseListLinkProps {
  code: string;
  /** Programmes the course list has courses of. */
  listed: Readonly<Record<string, unknown>>;
  children: ReactNode;
  className?: string;
}

/** Links `children` to the course list of a programme, or shows them as text when the list has no courses of it. */
export function CourseListLink({ code, listed, children, className }: CourseListLinkProps) {
  if (!Object.hasOwn(listed, code)) return <span className={className}>{children}</span>;
  return (
    <Link to="/" search={{ programme: code }} className={cn("underline-offset-4 hover:text-foreground hover:underline", className)}>
      {children}
    </Link>
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

/** Says that a master's programme leads to the degree only with one of certain specialisations. Renders nothing when any will do. */
export function Specialisations({ names, className }: { names: readonly string[]; className?: string }) {
  const t = useMessages();
  if (names.length === 0) return null;
  return <span className={cn("block text-muted-foreground", className)}>{t.planner.specialisations(names)}</span>;
}
