import { CheckIcon, ExternalLinkIcon } from "lucide-react";
import { cn } from "cn";
import {
  coursesOf,
  type AdmissionCheck,
  type Clause,
  type CourseRule,
  type GuideCourse,
  type OfferedCourse,
  type PublishedEligibility,
} from "@/domain/eligibility";
import type { Language } from "@/domain/names";
import type { MarkedAdmissionRule } from "@/domain/planner";
import { academicYearOf, type StudyPeriod } from "@/domain/programme-plans";
import { useLanguage } from "@/hooks/use-language";
import { useMessages } from "@/hooks/use-messages";
import type { Messages } from "@/lib/i18n/en";
import { RuleMarker } from "./degree-marks";

type Names = PublishedEligibility["names"];
type CourseLabel = (course: GuideCourse) => string;

/**
 * Names a course of the guide in `language`: Chalmers' name, or else the guide's, with the codes of it that `planned`
 * holds, or else every code the guide gives it.
 */
const courseLabel =
  (names: Names, language: Language, planned: ReadonlySet<string>): CourseLabel =>
  ({ codes, name }) => {
    const inPlans = codes.filter((code) => planned.has(code));
    const shown = inPlans.length > 0 ? inPlans : codes;
    const named = [...shown, ...codes].map((code) => names[code]).find((n) => n !== undefined);
    return `${named ? (language === "sv" ? named.swedishName : named.name) : name} (${shown.join("/")})`;
  };

/** A rule in words: a course, "A or B", "A and B", "2 of A; B; C", and the courses of an alternative in brackets. */
function ruleText(rule: CourseRule, label: CourseLabel, t: Messages): string {
  const words = t.planner.admission;
  const parts = (rules: readonly CourseRule[]) =>
    rules.map((r) => (r.kind === "all" ? `(${ruleText(r, label, t)})` : ruleText(r, label, t)));
  switch (rule.kind) {
    case "course":
      return label(rule);
    case "any":
      return words.either(parts(rule.of));
    case "all":
      return words.all(parts(rule.of));
    case "atLeast":
      return words.someOf(rule.count, parts(rule.of));
  }
}

/** The codes a student's plans hold or offer of a clause's courses. */
const plannedCodes = ({ held, late, offered, offeredLate }: Clause) =>
  new Set([...held, ...late, ...offered, ...offeredLate].map((c) => c.code));

/** The words for the guide's clauses and courses in the language shown. */
function useAdmissionWords(names: Names) {
  const t = useMessages();
  const language = useLanguage();
  return {
    /** A clause in words, by the courses and codes the plans have when they can meet it. */
    clause: (clause: Clause) => ruleText(clause.withinPlans, courseLabel(names, language, plannedCodes(clause)), t),
    /** A course in words, by every code the guide gives it. */
    course: courseLabel(names, language, new Set()),
    /** Where the plans have some courses: each course's code, and the study periods of its rounds in each year of study. */
    places: (courses: readonly OfferedCourse[]) =>
      [...Map.groupBy(courses, (c) => c.code)].map(([code, rounds]) =>
        t.planner.admission.courseIn(
          code,
          [...Map.groupBy(rounds, (r) => r.year)].map(([year, inYear]) => ({ year, periods: inYear.map((r) => t.periods(r.periods)) })),
        ),
      ),
  };
}

/** Whether an eligibility check passes: the compulsory courses suffice, or the plan holds the courses it names. */
const passes = ({ eligibility }: AdmissionCheck) =>
  eligibility.kind === "compulsory" || (eligibility.kind === "courses" && eligibility.met);

/** The requirements a check still misses. */
const missingOf = ({ eligibility }: AdmissionCheck) => (eligibility.kind === "courses" ? eligibility.clauses.filter((c) => !c.met) : []);

/** Whether only a course outside the programme's plans meets a requirement, so no choice within the plan can. */
const isOutside = (clause: Clause) => clause.reach === "outside";

/**
 * Green once met, red while the plans can meet more, muted when only courses outside them are missing or the planner
 * does not check it.
 */
const statusClass = (check: AdmissionCheck) =>
  passes(check) ? "font-medium text-grade-4" : missingOf(check).some((c) => !isOutside(c)) ? "text-grade-u" : "text-muted-foreground";

function Met() {
  return <CheckIcon className="mr-0.5 inline size-[1em] align-[-0.15em]" aria-hidden />;
}

interface AdmissionSummaryProps {
  check: AdmissionCheck;
  names: Names;
  className?: string;
}

/** Whether a student's plan meets the entry requirements of a master's programme, in a line for its card. */
export function AdmissionSummary({ check, names, className }: AdmissionSummaryProps) {
  const t = useMessages();
  const words = useAdmissionWords(names);
  const { summary } = t.planner.admission;
  const { eligibility } = check;
  const text =
    eligibility.kind !== "courses"
      ? summary[eligibility.kind]
      : eligibility.met
        ? summary.met
        : summary.missing(missingOf(check).map((c) => (isOutside(c) ? summary.outside(words.clause(c)) : words.clause(c))));
  return (
    <span className={cn("block", statusClass(check), className)}>
      {passes(check) && <Met />}
      {text}
    </span>
  );
}

interface AdmissionDetailsProps {
  check: AdmissionCheck;
  guide: Pick<PublishedEligibility, "academicYear" | "source" | "names">;
  /** The programme whose compulsory courses meet the requirements when the guide says they do. */
  programmeName: string;
  /** The calendar year the student's master's programme starts in. */
  masterStart: number;
  /** The study periods a course runs in this academic year, by its code. */
  periodsOf: (code: string) => readonly StudyPeriod[];
}

/**
 * What admission to the chosen master's programme asks of the student's plan, by Chalmers' eligibility guide: whether
 * the plan meets it, what is missing and where the plans offer it, and when a course counts.
 */
export function AdmissionDetails({ check, guide, programmeName, masterStart, periodsOf }: AdmissionDetailsProps) {
  const t = useMessages();
  const words = t.planner.admission;
  const { clause, course, places } = useAdmissionWords(guide.names);
  const { eligibility, recommended, corrections, fit } = check;
  const missing = missingOf(check);
  const inPlans = missing.filter((c) => !isOutside(c));
  const outside = missing.filter(isOutside);
  const status = {
    compulsory: words.compulsory(programmeName),
    courses: missing.length === 0 ? words.met : inPlans.length > 0 ? words.missing : words.metInPlans,
    regulations: words.regulations,
    words: words.words,
  }[eligibility.kind];
  /** When each course of a requirement that the plans do not have runs this year, by the first of its codes that does. */
  const runs = (c: Clause) => {
    const planned = plannedCodes(c);
    const lines = coursesOf(c.rule)
      .filter(({ codes }) => !codes.some((code) => planned.has(code)))
      .map(({ codes }) => {
        const running = codes.map((code) => ({ code, periods: periodsOf(code) })).find(({ periods }) => periods.length > 0);
        return running ? words.runsIn(running.code, t.periods(running.periods)) : words.notThisYear(codes[0]!);
      });
    return [...new Set(lines)].join(" · ");
  };

  return (
    <section aria-label={words.heading} className="flex max-w-prose flex-col gap-1 text-sm">
      <p className={statusClass(check)}>
        {passes(check) && <Met />}
        {status}
      </p>
      {eligibility.kind === "words" && <p className="whitespace-pre-line text-muted-foreground">{eligibility.text}</p>}
      {inPlans.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {inPlans.map((c) => (
            <li key={clause(c)}>
              {clause(c)}
              {(c.offered.length > 0 || c.late.length === 0) && (
                <span className="block text-xs text-muted-foreground">
                  {c.offered.length > 0 ? words.offeredIn(places(c.offered)) : words.onlyLate(places(c.offeredLate))}
                </span>
              )}
              {c.late.map((late) => (
                <span key={late.code} className="block text-xs text-grade-u">
                  {words.late(late.code, t.periods(late.periods))}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
      {outside.length > 0 && (
        <div className="flex flex-col gap-1">
          <p>{words.outside}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {outside.map((c) => (
              <li key={clause(c)}>
                {clause(c)}
                <span className="block text-xs text-muted-foreground">{runs(c)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{words.outsideHint}</p>
        </div>
      )}
      {recommended.length > 0 && <p className="text-muted-foreground">{words.recommended(recommended.map(course))}</p>}
      {corrections.map(({ guide: line, corrected }) => (
        <p key={line} className="text-xs text-muted-foreground">
          {words.corrected(line, corrected)}
        </p>
      ))}
      <p className="text-xs text-muted-foreground">
        {words.deadline} {fit === "earlier" && words.guideEarlier(academicYearOf(masterStart))}{" "}
        <a
          href={guide.source}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
        >
          {words.guide(guide.academicYear)}
          <ExternalLinkIcon className="size-3" />
        </a>
      </p>
    </section>
  );
}

interface AdmissionRuleProps {
  rule: MarkedAdmissionRule;
  /** The master's programme's code. */
  master: string;
  names: Names;
}

/** A requirement for admission to the master's programme as a rule of the year, and how far the plan goes towards it. */
export function AdmissionRule({ rule, master, names }: AdmissionRuleProps) {
  const t = useMessages();
  const words = t.planner.admission.rule;
  const { clause } = useAdmissionWords(names);
  const { marker, met, have, need } = rule;
  const text =
    rule.rule.kind === "course"
      ? words.course(clause(rule), master)
      : rule.rule.kind === "atLeast"
        ? words.someOf(rule.rule.count, master)
        : rule.rule.of.every((r) => r.kind === "course")
          ? words.oneOf(master)
          : words.alternatives(master);
  return (
    <p className="flex items-baseline gap-2">
      <RuleMarker marker={marker} done={met} />
      <span>
        {text}{" "}
        <span className={cn("whitespace-nowrap", met ? "font-medium text-grade-4" : "text-muted-foreground")}>
          {met && <Met />}
          {t.of(t.format.number(have), t.format.count(need))}
        </span>
      </span>
    </p>
  );
}
