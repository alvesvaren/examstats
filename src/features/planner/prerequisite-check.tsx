import { CheckIcon, ChevronRightIcon, CircleIcon, XIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { missingOf, type DegreeCourse, type PrerequisiteGroup, type PrerequisiteItem } from "@/domain/prerequisite-check";
import { TOPICS } from "@/domain/prerequisite-topics";
import type { Naming } from "./naming";
import { formatAlternatives, formatCount, formatCredits, formatList, formatNumber, formatPeriods } from "@/lib/format";

/** Fix courses a missing prerequisite lists before it says how many more there are. */
const SHOWN_FIXES = 3;

function itemLabel({ node, credits }: PrerequisiteItem, naming: Naming) {
  const amount = credits === null ? "" : ` (${formatCredits(credits)})`;
  switch (node.kind) {
    case "topic":
      return `${TOPICS[node.id].label}${amount}`;
    case "course":
      return `${naming.course(node.code)} ${node.code}`;
    case "programme":
      return `the programme ${naming.programme(node.code)}`;
    case "unknown":
      return node.node;
  }
}

const groupLabel = (group: PrerequisiteGroup, naming: Naming) => formatAlternatives(group.items.map((item) => itemLabel(item, naming)));

const placeOf = ({ year, periods }: DegreeCourse) => `year ${year}, ${formatPeriods(periods)}`;

/** Why a group is met: the courses that meet it, or the programme. */
function reasonOf(group: PrerequisiteGroup, naming: Naming) {
  const item = group.items.find((i) => i.met);
  if (!item) return null;
  if (item.node.kind === "programme") return `You study ${naming.programme(item.node.code)}`;
  const courses = formatList(item.by.map((c) => `${c.name} (${placeOf(c)})`));
  const credits = item.by.reduce((sum, c) => sum + c.credits, 0);
  return item.credits === null ? courses : `${formatCredits(credits)}: ${courses}`;
}

/** What a group has towards it although not enough, as "7.5 of 15 credits". */
function partOf(group: PrerequisiteGroup) {
  const item = group.items.find((i) => i.credits !== null && i.by.length > 0);
  if (!item?.credits) return null;
  const have = item.by.reduce((sum, c) => sum + c.credits, 0);
  return `${formatNumber(have)} of ${formatCredits(item.credits)} so far`;
}

/** The courses that would meet a group, as many as fit, or that none in the plan does. */
function Fixes({ fixes }: { fixes: readonly DegreeCourse[] }) {
  if (fixes.length === 0) return <span className="text-muted-foreground">No course before it in your plans covers it.</span>;
  const shown = fixes.slice(0, SHOWN_FIXES);
  const more = fixes.length - shown.length;
  // "A, B or C", or "A, B, C or 2 more".
  const separatorAfter = (i: number) => (i === shown.length - 1 ? "" : i === shown.length - 2 && more === 0 ? " or " : ", ");
  return (
    <span className="text-muted-foreground">
      Take{" "}
      {shown.map((course, i) => (
        <span key={course.code}>
          <span className="font-medium text-foreground">{course.name}</span> ({placeOf(course)}){separatorAfter(i)}
        </span>
      ))}
      {more > 0 && ` or ${formatCount(more)} more`}
    </span>
  );
}

/** The required prerequisites not met, each with the courses that would meet it. */
function MissingList({ groups, naming }: { groups: readonly PrerequisiteGroup[]; naming: Naming }) {
  return (
    <ul className="flex flex-col gap-1">
      {groups.map((group) => (
        <li key={groupKey(group)} className="flex gap-1.5">
          <XIcon className="mt-0.5 size-3.5 shrink-0 text-grade-u" aria-hidden />
          <span className="flex flex-col">
            <span className="font-medium text-grade-u">
              {groupLabel(group, naming)}
              {partOf(group) && <span className="font-normal text-muted-foreground"> · {partOf(group)}</span>}
            </span>
            <Fixes fixes={group.fixes} />
          </span>
        </li>
      ))}
    </ul>
  );
}

const groupKey = (group: PrerequisiteGroup) => `${group.strength}:${group.source}:${group.items.map((i) => JSON.stringify(i.node)).join()}`;

/** Every prerequisite group: met ones with the courses that meet them, and the rest with what would. */
function AllGroups({ groups, naming }: { groups: readonly PrerequisiteGroup[]; naming: Naming }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {groups.map((group) => {
        const required = group.strength === "required";
        const Icon = group.met ? CheckIcon : required ? XIcon : CircleIcon;
        return (
          <li key={groupKey(group)} className="flex gap-1.5" title={group.source}>
            <Icon
              className={cn("mt-0.5 size-3.5 shrink-0", group.met ? "text-grade-4" : required ? "text-grade-u" : "text-muted-foreground")}
              aria-label={group.met ? "Met" : required ? "Missing" : "Recommended, not met"}
            />
            <span className="flex flex-col">
              <span className={cn(required ? "font-medium" : "text-muted-foreground")}>
                {!required && "Recommended: "}
                {groupLabel(group, naming)}
              </span>
              {group.met ? (
                <span className="text-muted-foreground">{reasonOf(group, naming)}</span>
              ) : (
                <>
                  {partOf(group) && <span className="text-muted-foreground">{partOf(group)}</span>}
                  <Fixes fixes={group.fixes} />
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

interface PrerequisiteCheckProps {
  groups: readonly PrerequisiteGroup[];
  naming: Naming;
  /** The button's label, before the status. */
  children: ReactNode;
  /** Shown under the groups when open, such as the prerequisites in Chalmers' words. */
  footer?: ReactNode;
  /** Shown on the button's line before it, such as a course's code and credits. */
  lead?: ReactNode;
  className?: string;
}

/**
 * Prerequisites checked against a student's courses. Closed, it shows only what is missing, with the courses that
 * would meet it. Open, it shows every prerequisite and what meets it.
 */
export function PrerequisiteCheck({ groups, naming, children, footer, lead, className }: PrerequisiteCheckProps) {
  const [open, setOpen] = useState(false);
  const missing = missingOf(groups);
  const status =
    missing.length > 0 ? (
      <span className="font-medium text-grade-u">{formatCount(missing.length)} missing</span>
    ) : (
      <span className="inline-flex items-center gap-0.5 font-medium text-grade-4">
        <CheckIcon className="size-3.5" aria-hidden />
        met
      </span>
    );
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
        {lead && <span>{lead} ·</span>}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="group inline-flex items-center gap-1 text-left hover:text-foreground"
        >
          {children} · {status}
          <ChevronRightIcon className="size-3.5 shrink-0 transition-transform group-aria-expanded:rotate-90" aria-hidden />
        </button>
      </span>
      {open ? (
        <div className="flex max-w-prose flex-col gap-2">
          <AllGroups groups={groups} naming={naming} />
          {footer}
        </div>
      ) : (
        missing.length > 0 && <MissingList groups={missing} naming={naming} />
      )}
    </div>
  );
}

/** A master's programme's prerequisites as its syllabus words them, one paragraph each. */
export function ChalmersWords({ paragraphs }: { paragraphs: readonly string[] }) {
  if (paragraphs.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 border-l-2 pl-2 text-muted-foreground">
      <span className="text-xs font-medium tracking-wide uppercase">In Chalmers' words</span>
      {paragraphs.map((paragraph, index) => (
        // The paragraphs never change order, and a short one such as "or" can repeat.
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}
