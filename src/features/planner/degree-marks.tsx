import { CheckIcon } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import type { DegreeRuleMark, DegreeRuleProgress, pickProgress } from "@/domain/degree";
import type { PlanChoice, PlanRequirement } from "@/domain/programme-plans";
import { useMessages } from "@/hooks/use-messages";
import type { Messages } from "@/lib/i18n/en";

/** Marks the compulsory electives, in the list and in the rule that explains them. */
export function PickMarker() {
  return <span className="inline-block size-2 shrink-0 rounded-full bg-primary" aria-hidden />;
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

/** A rule that asks for some of the marked courses, and how far the courses of every year go towards it. */
export function PickRule({ pick, progress }: { pick: PlanChoice; progress: ReturnType<typeof pickProgress> }) {
  const t = useMessages();
  const { have, need, unit, done } = progress;
  return (
    <p className="flex items-baseline gap-2">
      <PickMarker />
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

/** Marks the courses of a list the degree needs some of. Faded once the plan has enough of them. */
function ListMarker({ done }: { done: boolean }) {
  return <span className={cn("inline-block size-2 shrink-0 rotate-45 bg-primary", done && "opacity-40")} aria-hidden />;
}

/** What a degree requirement asks for, in short. A list of one course names it, and says so when no year of the plan has it. */
function requirementText(requirement: PlanRequirement, offered: ReadonlySet<string>, t: Messages) {
  if (requirement.kind === "theme") return t.planner.themeCredits;
  const [code, ...others] = requirement.courses;
  if (code && others.length === 0) return t.planner.courseForDegree(code, offered.has(code));
  return t.planner.someOfMarked(requirement.minCourses);
}

/** A requirement of the whole degree, and how far the compulsory courses and the picks of every year go towards it. */
export function DegreeRule({ rule, offered }: { rule: DegreeRuleProgress; offered: ReadonlySet<string> }) {
  const t = useMessages();
  const { requirement, have, need, unit, done } = rule;
  return (
    <p className="flex items-baseline gap-2">
      {requirement.kind === "theme" ? (
        <Badge variant="outline" title={t.planner.themes[requirement.theme].name} className={cn(done && "opacity-50")}>
          {t.planner.themes[requirement.theme].short}
        </Badge>
      ) : (
        <ListMarker done={done} />
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

/** What a course gives towards a degree requirement. Faded once the plan meets the requirement. */
export function DegreeMark({ mark }: { mark: DegreeRuleMark }) {
  const t = useMessages();
  const { requirement, done, amount } = mark;
  if (requirement.kind === "courses") {
    return (
      <span className="inline-flex items-center">
        <ListMarker done={done} />
        <span className="sr-only">{t.planner.oneOfDegree}</span>
      </span>
    );
  }
  return (
    <Badge variant="outline" title={t.planner.themes[requirement.theme].name} className={cn(done && "opacity-50")}>
      {t.planner.themes[requirement.theme].short} {t.credits(amount)}
    </Badge>
  );
}
