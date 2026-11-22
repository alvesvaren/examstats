import { CheckIcon } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import type { pickProgress } from "@/domain/degree";
import type { ListedRound, MarkedDegreeRule } from "@/domain/planner";
import type { PlanChoice, PlanRequirement } from "@/domain/programme-plans";
import { useMessages } from "@/hooks/use-messages";
import type { Messages } from "@/lib/i18n/en";

/**
 * One shape per rule of the year, as paths in a 10 by 10 box: a dot, a triangle, a square, a ring and a diamond. Most
 * years have one or two rules, so the first two differ the most, and the diamond, which reads as a dot when small,
 * comes last.
 */
const SHAPES = [
  "M5 .5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9Z",
  "M5 0 10 9.5H0Z",
  "M.75 .75h8.5v8.5H.75Z",
  "M5 .5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9Zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5Z",
  "M5 0 10 5 5 10 0 5Z",
];

interface RuleMarkerProps {
  /** The rule's place among the year's rules. */
  marker: number;
  /** Fades the marker once the plan meets the rule. */
  done?: boolean;
  /** What the marker means, for screen readers. The rule beside it says so where there is one. */
  label?: string;
}

/** Marks a rule of the year and the courses that count towards it with the same shape. */
export function RuleMarker({ marker, done = false, label }: RuleMarkerProps) {
  return (
    <svg
      viewBox="0 0 10 10"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={!label}
      className={cn("inline-block size-2.5 shrink-0 fill-primary", done && "opacity-40")}
    >
      <path d={SHAPES[marker % SHAPES.length]} fillRule="evenodd" />
    </svg>
  );
}

/** Chalmers' own words when they say more than a label, else a sentence from the numbers, if there are any. */
function pickText({ text, minCourses, minCredits }: PlanChoice, t: Messages) {
  if (text && !/^compulsory elective$/i.test(text)) return text;
  if (minCourses) return t.planner.pickAtLeast(t.courses(minCourses));
  if (minCredits) return t.planner.pickAtLeast(t.credits(minCredits));
  return t.planner.pickSome;
}

/** "3 of 2 courses" or "7.5 of 15 credits". */
const progressText = ({ have, need, unit }: { have: number; need: number; unit: "courses" | "credits" }, t: Messages) =>
  t.of(t.format.number(have), unit === "courses" ? t.format.count(need) : t.credits(need));

interface PickRuleProps {
  pick: PlanChoice;
  marker: number;
  progress: ReturnType<typeof pickProgress>;
}

/** A rule that asks for some of the marked courses, and how far the courses of every year go towards it. */
export function PickRule({ pick, marker, progress }: PickRuleProps) {
  const t = useMessages();
  const { have, need, unit, done } = progress;
  return (
    <p className="flex items-baseline gap-2">
      <RuleMarker marker={marker} done={done} />
      <span>
        {pickText(pick, t)}{" "}
        {need !== null && (
          <span className={cn("whitespace-nowrap", done ? "font-medium text-grade-4" : "text-muted-foreground")}>
            {done && <CheckIcon className="mr-0.5 inline size-4 align-[-0.2em]" aria-hidden />}
            {progressText({ have, need, unit }, t)}
          </span>
        )}
      </span>
    </p>
  );
}

/** What a degree requirement asks for, in short. A list of one course names it, and says so when no year of the plan has it. */
function requirementText(requirement: PlanRequirement, offered: ReadonlySet<string>, t: Messages) {
  if (requirement.kind === "theme") return t.planner.themeCredits;
  const [code, ...others] = requirement.courses;
  if (code && others.length === 0) return t.planner.courseForDegree(code, offered.has(code));
  return t.planner.someOfMarked(requirement.minCourses);
}

/** A requirement of the whole degree, and how far the compulsory courses and the picks of every year go towards it. */
export function DegreeRule({ rule, offered }: { rule: MarkedDegreeRule; offered: ReadonlySet<string> }) {
  const t = useMessages();
  const { requirement, marker, have, need, unit, done } = rule;
  return (
    <p className="flex items-baseline gap-2">
      {requirement.kind === "theme" ? (
        <Badge variant="outline" title={t.planner.themes[requirement.theme].name} className={cn(done && "opacity-50")}>
          {t.planner.themes[requirement.theme].short}
        </Badge>
      ) : (
        <RuleMarker marker={marker} done={done} />
      )}
      <span>
        {requirementText(requirement, offered, t)}{" "}
        <span className={cn("whitespace-nowrap", done ? "font-medium text-grade-4" : "text-muted-foreground")}>
          {done && <CheckIcon className="mr-0.5 inline size-4 align-[-0.2em]" aria-hidden />}
          {progressText({ have, need, unit }, t)}
        </span>
      </span>
    </p>
  );
}

interface RoundMarksProps extends Pick<ListedRound, "picks" | "marks" | "admission"> {
  /** The code of the master's programme whose admission the course counts towards. */
  master: string | undefined;
}

/**
 * What a course counts towards, after its name: the marker of each pick and list of courses it is one of, then the
 * credits it gives each theme, then the requirements for admission to the master's programme it meets. Faded once the
 * plan meets the rule.
 */
export function RoundMarks({ picks, marks, admission, master }: RoundMarksProps) {
  const t = useMessages();
  return (
    <>
      {picks.map(({ marker, done }) => (
        <RuleMarker key={marker} marker={marker} done={done} label={t.planner.oneOfPick} />
      ))}
      {marks.map(({ requirement, marker, done, amount }) =>
        requirement.kind === "theme" ? (
          <Badge key={marker} variant="outline" title={t.planner.themes[requirement.theme].name} className={cn(done && "opacity-50")}>
            {t.planner.themes[requirement.theme].short} {t.credits(amount)}
          </Badge>
        ) : (
          <RuleMarker key={marker} marker={marker} done={done} label={t.planner.oneOfDegree} />
        ),
      )}
      {master &&
        admission.map(({ marker, done }) => (
          <RuleMarker key={marker} marker={marker} done={done} label={t.planner.admission.mark(master)} />
        ))}
    </>
  );
}
