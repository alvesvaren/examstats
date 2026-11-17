import { TOPICS, type TopicId } from "./prerequisite-topics.ts";
import type { Prerequisite, PrerequisiteSnapshot } from "./prerequisites.ts";
import { isCompulsory, roundKey, STUDY_PERIODS, type StudyPeriod, type StudyPick, type StudyYear } from "./programme-plans.ts";

/** Broader subjects that a course of a subject also counts towards, as a course in linear algebra counts as mathematics. */
const ALSO_COUNTS_AS: Partial<Record<TopicId, readonly TopicId[]>> = {
  "linear-algebra": ["mathematics"],
  calculus: ["mathematics"],
  "multivariable-calculus": ["mathematics"],
  "dynamical-systems": ["mathematics"],
  "differential-equations": ["mathematics"],
  "numerical-analysis": ["mathematics"],
  "complex-analysis": ["mathematics"],
  transforms: ["mathematics"],
  probability: ["mathematics"],
  statistics: ["mathematics", "probability"],
  "stochastic-processes": ["mathematics", "probability"],
  "discrete-mathematics": ["mathematics", "logic"],
  logic: ["mathematics"],
  optimization: ["mathematics"],
  "functional-programming": ["programming"],
  "object-oriented-programming": ["programming"],
  "concurrent-programming": ["programming"],
  "machine-oriented-programming": ["programming"],
  python: ["programming"],
  mechanics: ["physics"],
  "classical-mechanics": ["physics", "mechanics"],
  "quantum-physics": ["physics"],
  electromagnetism: ["physics"],
  thermodynamics: ["physics"],
  "statistical-physics": ["physics"],
  "solid-state-physics": ["physics"],
  optics: ["physics"],
  acoustics: ["physics"],
  relativity: ["physics"],
  astronomy: ["physics"],
  "nuclear-physics": ["physics"],
  "general-chemistry": ["chemistry"],
  "organic-chemistry": ["chemistry"],
  "physical-chemistry": ["chemistry"],
  "analytical-chemistry": ["chemistry"],
  "polymer-chemistry": ["chemistry"],
  "surface-chemistry": ["chemistry"],
  biochemistry: ["chemistry"],
};

/** Course codes of Chalmers' and the University of Gothenburg's mathematics departments, whose courses all count as mathematics. */
const MATHEMATICS_DEPARTMENT = /^(?:TM[AV]|MV[AE]|MM[AG]|MS[AG]|LMA)\d/;

const isTopicId = (id: string): id is TopicId => Object.hasOwn(TOPICS, id);
const TOPIC_IDS = Object.keys(TOPICS).filter(isTopicId);

/** The subjects a course teaches, from its English name and its department, with the broader subjects they count towards. */
export function subjectsOf(code: string, englishName: string): ReadonlySet<TopicId> {
  const name = englishName.toLowerCase().replace(/\s+/g, " ");
  const named = TOPIC_IDS.filter((id) => TOPICS[id].pattern.test(name));
  const direct: TopicId[] = MATHEMATICS_DEPARTMENT.test(code) ? [...named, "mathematics"] : named;
  return new Set(direct.flatMap((id) => [id, ...(ALSO_COUNTS_AS[id] ?? [])]));
}

/** A node of the prerequisite graph by what it is. */
export type PrerequisiteNode =
  | { kind: "course"; code: string }
  | { kind: "topic"; id: TopicId }
  | { kind: "programme"; code: string }
  /** A subject that `TOPICS` no longer has, which nothing can meet. */
  | { kind: "unknown"; node: string };

export function parseNode(node: string): PrerequisiteNode {
  const [prefix, rest = ""] = node.split(":", 2);
  if (prefix === "programme") return { kind: "programme", code: rest };
  if (prefix !== "topic") return { kind: "course", code: node };
  return isTopicId(rest) ? { kind: "topic", id: rest } : { kind: "unknown", node };
}

/** What the planner needs of the prerequisite graph: each course's and master's programme's edges, and what each course teaches. */
export function prerequisiteLookup(snapshot: PrerequisiteSnapshot) {
  const courses = new Map(snapshot.courses.map((c) => [c.code, c]));
  const replacedBy = new Map(snapshot.courses.flatMap((c) => c.replaces.map((old) => [old, c.code] as const)));
  const programmes = new Map(snapshot.programmes.map((p) => [p.code, p.edges]));
  /** The code the graph knows a course by: its own, or that of the course that replaced it. */
  const current = (code: string) => (courses.has(code) ? code : (replacedBy.get(code) ?? code));
  const subjects = new Map<string, ReadonlySet<TopicId>>();
  return {
    current,
    edgesOf: (code: string) => courses.get(current(code))?.edges ?? [],
    edgesOfProgramme: (code: string) => programmes.get(code) ?? [],
    /** English name of a node of the graph, if it has one. */
    nameOf: (node: string): string | undefined => snapshot.names[node] ?? courses.get(node)?.name,
    /** The subjects a course teaches. Plans name courses in the language picked, so its English name comes from the graph. */
    subjectsOf: ({ code, name }: { code: string; name: string }) => {
      const known = subjects.get(code);
      if (known) return known;
      const taught = subjectsOf(code, courses.get(current(code))?.name ?? snapshot.names[code] ?? name);
      subjects.set(code, taught);
      return taught;
    },
  };
}
export type PrerequisiteLookup = ReturnType<typeof prerequisiteLookup>;

/** A course of a student's degree, with the year of study and the study periods it is in. */
export interface DegreeCourse {
  code: string;
  name: string;
  credits: number;
  /** Year of study in the whole degree, from 1. */
  year: number;
  periods: readonly StudyPeriod[];
}

/**
 * The courses of a degree's years: those a student takes, compulsory or picked, and every course the plans offer, in
 * order of the years and study periods they are in.
 */
export function degreeCourses(years: readonly StudyYear[], picks: readonly StudyPick[], track?: string) {
  const offered = years.flatMap(({ number, plan, year }) =>
    (plan.years.find((y) => y.year === year)?.courses ?? []).map((course) => ({
      course,
      degreeCourse: { code: course.code, name: course.name, credits: course.credits, year: number, periods: course.periods },
      picked: picks.some((p) => p.number === number && p.key === roundKey(course.code, course.periods)),
    })),
  );
  const ordered = offered.toSorted((a, b) => periodOrder(a.degreeCourse) - periodOrder(b.degreeCourse));
  return {
    taken: ordered
      .filter(({ course, picked }) => picked || (isCompulsory(course) && (course.track === null || course.track === track)))
      .map((entry) => entry.degreeCourse),
    offered: ordered.map((entry) => entry.degreeCourse),
  };
}

const periodIndex = (period: StudyPeriod) => STUDY_PERIODS.indexOf(period);
const periodOrder = ({ year, periods }: Pick<DegreeCourse, "year" | "periods">) =>
  year * STUDY_PERIODS.length + periodIndex(periods[0] ?? "Other");

/** Whether a course ends before study period `period` of year of study `year` starts. */
export const endsBefore = ({ year, periods }: Pick<DegreeCourse, "year" | "periods">, before: { year: number; period: StudyPeriod }) =>
  year < before.year || (year === before.year && periods.every((p) => periodIndex(p) < periodIndex(before.period)));

/** One thing a prerequisite asks for, and the courses of the student's that meet it. */
export interface PrerequisiteItem {
  node: PrerequisiteNode;
  /** Credits it asks for, or null when any course of it will do. */
  credits: number | null;
  /** Courses taken that meet it. */
  by: DegreeCourse[];
  met: boolean;
}

/** Things a prerequisite sentence asks for, of which any one will do, such as "TDA548 or TDA553". */
export interface PrerequisiteGroup {
  strength: "required" | "recommended";
  /** The sentence it comes from. */
  source: string;
  items: PrerequisiteItem[];
  met: boolean;
  /** Courses the plan offers that would meet it, earliest first. Empty once it is met. */
  fixes: DegreeCourse[];
}

/** Words that make what follows an example of what comes before, as "e.g." does in "programming, e.g. TDA548". */
const EXAMPLE =
  /\be\.g\b|\bi\.e\b|\bfor (?:example|instance)\b|\bsuch as\b|\bas in\b|\bcorresponding to\b|\bacquired (?:with|through|in)\b/i;
const ALTERNATIVE = /\bor\b|\//i;
const LIST_BREAK = /[,;:]/;
/** What continues a list of examples, as the commas in "e.g. TDA548, TDA553, TDA367". */
const EXAMPLE_LIST = /^[\s,]*(?:or\s*)?$/i;
/** What stands between a course code and its title, as in "TDA452 Functional programming" or "BOM240 - CAD". */
const TITLE = /^[\s\-–:"]*$/;

/** `text` with every closed bracket blanked out, nested ones too, keeping the indexes of everything else. */
function withoutBrackets(text: string): string {
  const blanked = text.replace(/\([^()]*\)/g, (bracket) => " ".repeat(bracket.length));
  return blanked === text ? text : withoutBrackets(blanked);
}

/** The index of the bracket open at `index` of `text`, or -1 when none is. */
function openBracketAt(text: string, index: number) {
  const before = withoutBrackets(text.slice(0, index));
  return before.lastIndexOf("(");
}

const span = (start: number, length: number) => (start < 0 ? null : { start, end: start + length });

/** Where a sentence mentions the node of an edge, or null when it cannot be found, as for a hand-written fix. */
function mentionOf(edge: Prerequisite, node: PrerequisiteNode, lookup: PrerequisiteLookup) {
  const lower = edge.source.toLowerCase();
  const byName = (key: string) => {
    const name = lookup.nameOf(key)?.toLowerCase();
    return name ? span(lower.indexOf(name), name.length) : null;
  };
  switch (node.kind) {
    case "topic": {
      const match = TOPICS[node.id].pattern.exec(lower);
      return match ? span(match.index, match[0].length) : null;
    }
    case "course": {
      const written = edge.writtenAs ?? node.code;
      const match = new RegExp(`${written.slice(0, 3)} ?${written.slice(3)}`).exec(edge.source);
      return match ? span(match.index, match[0].length) : byName(node.code);
    }
    case "programme":
      return span(edge.source.indexOf(node.code), node.code.length) ?? byName(`programme:${node.code}`);
    case "unknown":
      return null;
  }
}

/**
 * The edges of one sentence of one strength in groups of alternatives. Two mentions in a row are alternatives when
 * "or" or a slash joins them, when one is the title of the other, or when the second is an example of the first, as
 * courses in brackets or after "e.g." are. Anything else between them, such as "and" or a comma, makes both required.
 */
function alternativesIn(edges: readonly Prerequisite[], lookup: PrerequisiteLookup): Prerequisite[][] {
  const text = edges[0]?.source ?? "";
  const mentioned = edges.map((edge) => ({ edge, at: mentionOf(edge, parseNode(edge.to), lookup) }));
  const located = mentioned.flatMap(({ edge, at }) => (at ? [{ edge, ...at }] : [])).toSorted((a, b) => a.start - b.start);
  const unlocated = mentioned.filter(({ at }) => !at).map(({ edge }) => [edge]);

  const groups: Prerequisite[][] = [];
  let inExamples = false;
  located.forEach((mention, i) => {
    const previous = located[i - 1];
    const join = previous && joins(text, previous, mention, inExamples);
    if (previous && join) groups.at(-1)!.push(mention.edge);
    else groups.push([mention.edge]);
    inExamples = join === "example" || (join === "alternative" && inExamples);
  });
  return [...groups, ...unlocated];
}

function joins(text: string, previous: { end: number }, next: { start: number }, inExamples: boolean) {
  const bracket = openBracketAt(text, next.start);
  if (bracket >= previous.end) {
    const lead = text.slice(bracket + 1, next.start);
    if (lead.trim() === "" || EXAMPLE.test(lead)) return "example";
  }
  const between = withoutBrackets(text.slice(previous.end, next.start));
  if (TITLE.test(between)) return "alternative";
  if (EXAMPLE.test(between)) return "example";
  if (inExamples && EXAMPLE_LIST.test(between)) return "alternative";
  if (!LIST_BREAK.test(between) && ALTERNATIVE.test(between)) return "alternative";
  return null;
}

/** Whether a course meets a node: it is that course, or it teaches that subject. */
const meets = (node: PrerequisiteNode, course: DegreeCourse, lookup: PrerequisiteLookup) =>
  (node.kind === "course" && lookup.current(course.code) === lookup.current(node.code)) ||
  (node.kind === "topic" && lookup.subjectsOf(course).has(node.id));

const tenths = (credits: number) => Math.round(credits * 10) / 10;

interface PrerequisiteCheck {
  /** Courses taken before the course or programme starts. */
  taken: readonly DegreeCourse[];
  /** Courses the plans offer before it starts, in order. */
  offered: readonly DegreeCourse[];
  /** The programmes of the student's degree. */
  programmes: readonly string[];
}

/**
 * What the prerequisites `edges` ask for, in groups of alternatives with the courses taken that meet them, and the
 * courses that would meet those not met. Required groups come first. Excluded courses are no prerequisites.
 */
export function checkPrerequisites(
  edges: readonly Prerequisite[],
  lookup: PrerequisiteLookup,
  { taken, offered, programmes }: PrerequisiteCheck,
): PrerequisiteGroup[] {
  const takenCodes = new Set(taken.map((c) => lookup.current(c.code)));
  const options = offered.filter((c, i) => !takenCodes.has(lookup.current(c.code)) && offered.findIndex((o) => o.code === c.code) === i);
  const itemOf = (edge: Prerequisite): PrerequisiteItem => {
    const node = parseNode(edge.to);
    const by = taken.filter((course) => meets(node, course, lookup));
    const have = tenths(by.reduce((sum, c) => sum + c.credits, 0));
    const met =
      node.kind === "programme" ? programmes.includes(node.code) : by.length > 0 && (edge.credits === null || have >= edge.credits);
    return { node, credits: edge.credits, by, met };
  };
  const sentences = Map.groupBy(
    edges.filter((e) => e.strength !== "excluded"),
    (e) => `${e.strength}\n${e.source}`,
  );
  return [...sentences.values()]
    .flatMap((sentence) => alternativesIn(sentence, lookup))
    .map((group): PrerequisiteGroup => {
      const items = group.map(itemOf);
      const met = items.some((item) => item.met);
      return {
        strength: group[0]!.strength === "required" ? "required" : "recommended",
        source: group[0]!.source,
        items,
        met,
        fixes: met ? [] : options.filter((course) => items.some((item) => meets(item.node, course, lookup))),
      };
    })
    .toSorted((a, b) => Number(a.strength !== "required") - Number(b.strength !== "required"));
}

/** The required groups of a check that the student's courses do not meet. */
export const missingOf = (groups: readonly PrerequisiteGroup[]) => groups.filter((g) => g.strength === "required" && !g.met);
