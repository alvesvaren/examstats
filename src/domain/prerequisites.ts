import { z } from "zod";
import type { NamesFile } from "./names.ts";
import { TOPICS } from "./prerequisite-topics.ts";
import type { ProgrammePlan } from "./programme-plans.ts";

/** A course's syllabus, as far as its prerequisites go. */
export const courseSyllabusSchema = z.object({
  code: z.string(),
  name: z.string(),
  /** Chalmers' level, such as "First-cycle" or "Second-cycle". */
  level: z.string(),
  credits: z.number().nonnegative(),
  /** Codes of earlier courses this one replaces. */
  replaces: z.array(z.string()),
  /** The syllabus' prerequisites as plain text, one line per paragraph or list item. Empty when it states none. */
  prerequisites: z.string(),
});

/**
 * The committed file that `pnpm programme-plans` writes and `pnpm snapshot` reads: the syllabus of every course in
 * the current plans, and of every course their prerequisites name by code, that is given this academic year.
 */
export const syllabiFileSchema = z.object({
  academicYear: z.string(),
  courses: z.array(courseSyllabusSchema),
});

export type CourseSyllabus = z.infer<typeof courseSyllabusSchema>;
export type SyllabiFile = z.infer<typeof syllabiFileSchema>;

export const STRENGTHS = ["required", "recommended", "excluded"] as const;
export type Strength = (typeof STRENGTHS)[number];

/**
 * One prerequisite of a course or a master's programme. `to` is a course code, `topic:<id>` for a subject from
 * `TOPICS`, or `programme:<code>` for a programme the text names, such as its admission requirements.
 */
export const prerequisiteSchema = z.object({
  to: z.string(),
  /** "excluded" marks a course that cannot be in the same degree, which syllabi list next to prerequisites. */
  strength: z.enum(STRENGTHS),
  /** How the parser found it, or "fix" for an edge from the hand-written fixes. */
  via: z.enum(["code", "name", "topic", "programme", "fix"]),
  /** Credits the text asks for, such as 15 in "15 credits in programming". */
  credits: z.number().positive().nullable(),
  /** The code as the text wrote it, when `to` is the course that replaced it. */
  writtenAs: z.string().nullable(),
  /** The sentence it came from, or the fix's note. */
  source: z.string(),
});
export type Prerequisite = z.infer<typeof prerequisiteSchema>;

/**
 * A hand-written correction of the parser. It sets the edge from `from`, a course code or `programme:<code>`, to `to`,
 * replacing what the parser found, and "none" removes it.
 */
export const prerequisiteFixSchema = z.object({
  from: z.string(),
  to: z.string(),
  strength: z.enum([...STRENGTHS, "none"]),
  note: z.string().optional(),
});
export const prerequisiteFixesSchema = z.array(prerequisiteFixSchema);
export type PrerequisiteFix = z.infer<typeof prerequisiteFixSchema>;

export const topicNode = (id: string) => `topic:${id}`;
export const programmeNode = (code: string) => `programme:${code}`;

const COURSE_CODE = /\b([A-Z]{3}) ?(\d{3})\b/g;
const PROGRAMME_CODE = /\b(?:MP|TK)[A-Z]{3,4}\b/g;
/** Chalmers' codes of master's programmes start with this. */
const MASTERS_PREFIX = "MP";

/** Course codes a text names, in order of first mention. Also finds codes written with a space, such as "TDA 357". */
export const courseCodesIn = (text: string) => [
  ...new Set(Array.from(text.matchAll(COURSE_CODE), ([, letters, digits]) => `${letters}${digits}`)),
];

const RECOMMENDED =
  /recommend|desirabl|preferabl|advantage|helpful|useful|beneficial|suggested|is a plus|good to have|not (?:a )?(?:hard |strict )?(?:pre)?requirement|not required/i;
const EXCLUDED = /\bnot be (?:included|counted|part of)\b[^.]*\bdegree\b|\boverlap/i;
/** Breaks after a full stop, except in abbreviations such as "e.g." that the next word often follows in capitals. */
const SENTENCE_BREAK = /(?<!\b(?:e\.g|i\.e|etc|cf|approx|incl|resp|ca|no)\.)(?<=[.!?])\s+(?=[A-Z0-9])/;
/** The end of a sentence after its last comma or similar break: the part a credit count applies to. */
const PHRASE = /[^,;:()]*$/;
/** A credit count that a subject follows, as in "15 hec in programming" or "7.5 credits or equivalent of statistics". */
const CREDITS = /(\d+(?:[.,]\d+)?)\s*(?:credits?|hec|hp|ects|cr|c)\b\.?(?:\s+or equivalent)?\s+(?:in|of|within|with)\b/gi;
/** A credit count in brackets right after a subject, as in "Linear Algebra (at least 7,5 cr.)". */
const CREDITS_AFTER = /^\s*\((?:at least |min(?:imum)?\.? )?(\d+(?:[.,]\d+)?)\s*(?:credits?|hec|hp|ects|cr|c)\b/i;
/**
 * A degree or programme and what follows it in the sentence, as in "BSc in Civil Engineering or equivalent". Course
 * names there name a subject of a degree, not a course.
 */
const DEGREE = /\b(?:b\.?sc|m\.?sc|bachelor(?:'s)?|master(?:'s)?|degree|programmes?|programs?)\b[^.;:]*?\b(?:in|within)\b[^.;]*/g;
/** Course names shorter than this, or of one word, are too generic to find a course by. */
const MIN_NAME_LENGTH = 10;

const strengthOf = (text: string): Strength | null => (EXCLUDED.test(text) ? "excluded" : RECOMMENDED.test(text) ? "recommended" : null);

/**
 * The sentences of a prerequisite text with how strongly each asks for what it names. A line that ends in a colon, such
 * as "The following are also recommended:", sets the strength of the lines after it.
 */
export function sentencesOf(text: string) {
  let heading: Strength = "required";
  return text.split("\n").flatMap((line) => {
    const inherited = heading;
    if (line.trimEnd().endsWith(":")) heading = strengthOf(line) ?? "required";
    return line.split(SENTENCE_BREAK).map((sentence) => ({ text: sentence.trim(), strength: strengthOf(sentence) ?? inherited }));
  });
}

const toCredits = (digits: string) => Number(digits.replace(",", "."));

/**
 * The credits a sentence asks for of the subject from `start` to `end`: from the phrase before it, as in "at least 7.5
 * credits of probability", or from brackets right after it, as in "Calculus (at least 7,5 cr.)".
 */
function creditsOf(sentence: string, start: number, end: number) {
  const [phrase = ""] = sentence.slice(0, start).match(PHRASE) ?? [];
  const before = [...phrase.matchAll(CREDITS)].at(-1)?.[1];
  const after = sentence.slice(end).match(CREDITS_AFTER)?.[1];
  const digits = before ?? after;
  return digits ? toCredits(digits) : null;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Finds names from `names`, a record of names by code, in lower-case text. A name that more than one code has, or that
 * is short or a single word, finds nothing. The longest name wins where names overlap.
 */
function nameFinder(names: Readonly<Record<string, string>>) {
  const codesByName = Map.groupBy(
    Object.entries(names).filter(([, name]) => name.length >= MIN_NAME_LENGTH && /\s/.test(name)),
    ([, name]) => name.toLowerCase(),
  );
  const codeOf = new Map([...codesByName].filter(([, codes]) => codes.length === 1).map(([name, codes]) => [name, codes[0]![0]]));
  const pattern = new RegExp(
    `\\b(?:${[...codeOf.keys()]
      .toSorted((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join("|")})\\b`,
    "g",
  );
  return (text: string) => (codeOf.size ? [...text.matchAll(pattern)] : []).map((match) => ({ match, code: codeOf.get(match[0])! }));
}

/** English name of every course and master's programme, by code. */
const englishNames = (names: NamesFile) => ({
  courses: Object.fromEntries(names.courses.map((c) => [c.code, c.en])),
  masters: Object.fromEntries(
    Object.entries(names.programmes).flatMap(([code, n]) => (code.startsWith(MASTERS_PREFIX) ? [[code, n.en]] : [])),
  ),
});

/**
 * What the parser knows beyond one text: which names find which course or master's programme, and which course
 * replaced a code that has no syllabus this year.
 */
export function prerequisiteIndex(syllabi: readonly CourseSyllabus[], names: NamesFile) {
  const { courses, masters } = englishNames(names);
  return {
    given: new Set(syllabi.map((c) => c.code)),
    replacedBy: new Map(syllabi.flatMap((c) => c.replaces.map((old) => [old, c.code] as const))),
    findCourses: nameFinder(courses),
    findProgrammes: nameFinder(masters),
  };
}
export type PrerequisiteIndex = ReturnType<typeof prerequisiteIndex>;

/** Blanks out a match so later patterns cannot match inside it, keeping the indexes of everything else. */
const blank = (text: string, start: number, length: number) => text.slice(0, start) + " ".repeat(length) + text.slice(start + length);

function edgesInSentence(from: string, { text, strength }: ReturnType<typeof sentencesOf>[number], index: PrerequisiteIndex) {
  const edge = (to: string, via: Prerequisite["via"], match: RegExpExecArray, writtenAs: string | null = null): Prerequisite => ({
    to,
    strength,
    via,
    credits: creditsOf(text, match.index, match.index + match[0].length),
    writtenAs,
    source: text,
  });

  const codes = [...text.matchAll(COURSE_CODE)].map((match) => {
    const written = `${match[1]}${match[2]}`;
    const replacement = index.given.has(written) ? undefined : index.replacedBy.get(written);
    return edge(replacement ?? written, "code", match, replacement ? written : null);
  });
  const programmeCodes = [...text.matchAll(PROGRAMME_CODE)].map((match) => edge(programmeNode(match[0]), "programme", match));

  let lower = text.toLowerCase();
  const programmeNames = index.findProgrammes(lower).map(({ match, code }) => {
    lower = blank(lower, match.index, match[0].length);
    return edge(programmeNode(code), "name", match);
  });
  const courseNames = index.findCourses(lower.replace(DEGREE, (degree) => " ".repeat(degree.length))).map(({ match, code }) => {
    lower = blank(lower, match.index, match[0].length);
    return edge(code, "name", match);
  });

  const topics = Object.entries(TOPICS).flatMap(([id, { pattern }]) => {
    const match = pattern.exec(lower);
    return match ? [edge(topicNode(id), "topic", match)] : [];
  });

  const courses = [...codes, ...courseNames].filter((e) => e.to !== from);
  // A sentence that excludes courses from a degree names other things only to describe those courses.
  return strength === "excluded" ? courses : [...courses, ...programmeCodes, ...programmeNames, ...topics];
}

const STRENGTH_RANK: Record<Strength, number> = { required: 0, recommended: 1, excluded: 2 };

/**
 * The prerequisites a text states for `from`, a course code or `programme:<code>`: one edge per node, with its
 * strongest mention, in order of mention.
 */
export function parsePrerequisites(from: string, text: string, index: PrerequisiteIndex) {
  const edges = sentencesOf(text).flatMap((sentence) => edgesInSentence(from, sentence, index));
  const byNode = Map.groupBy(edges, (e) => e.to);
  return [...byNode.values()].map((mentions) => {
    const strongest = mentions.toSorted((a, b) => STRENGTH_RANK[a.strength] - STRENGTH_RANK[b.strength])[0]!;
    return { ...strongest, credits: strongest.credits ?? mentions.find((m) => m.credits)?.credits ?? null };
  });
}

/** `edges` with the fixes for `from` applied: each fix replaces or removes the edge to its node, or adds one. */
export function applyFixes(from: string, edges: readonly Prerequisite[], fixes: readonly PrerequisiteFix[]) {
  const own = new Map(fixes.filter((f) => f.from === from).map((f) => [f.to, f]));
  const fixed = [...own.values()].flatMap((fix): Prerequisite[] =>
    fix.strength === "none"
      ? []
      : [{ to: fix.to, strength: fix.strength, via: "fix", credits: null, writtenAs: null, source: fix.note ?? "" }],
  );
  return [...edges.filter((e) => !own.has(e.to)), ...fixed];
}

export interface PrerequisiteSources {
  syllabi: SyllabiFile;
  names: NamesFile;
  /** The current academic year's programme plans, as far as the graph needs them. */
  programmes: readonly (Pick<ProgrammePlan, "code" | "prerequisites"> & { years: readonly { courses: readonly { code: string }[] }[] })[];
  fixes: readonly PrerequisiteFix[];
}

/**
 * The texts the graph parses: each course syllabus' prerequisites, and each master's programme's, by the node they
 * belong to.
 */
export const prerequisiteTexts = ({ syllabi, programmes }: Pick<PrerequisiteSources, "syllabi" | "programmes">) =>
  new Map([
    ...programmes.filter((p) => p.code.startsWith(MASTERS_PREFIX)).map((p) => [programmeNode(p.code), p.prerequisites.join("\n")] as const),
    ...syllabi.courses.map((c) => [c.code, c.prerequisites] as const),
  ]);

/** The prerequisites of every course and master's programme by node, parsed from their texts and then corrected by `fixes`. */
export function prerequisiteGraph(sources: PrerequisiteSources) {
  const index = prerequisiteIndex(sources.syllabi.courses, sources.names);
  return new Map(
    [...prerequisiteTexts(sources)].map(([from, text]) => [from, applyFixes(from, parsePrerequisites(from, text, index), sources.fixes)]),
  );
}

/** The graph that `pnpm snapshot` writes for the app. */
export const prerequisiteSnapshotSchema = z.object({
  academicYear: z.string(),
  /** Display name of every node in the graph: a course code, `topic:<id>` or `programme:<code>`. */
  names: z.record(z.string(), z.string()),
  /** Master's programmes with the prerequisites their syllabi state. */
  programmes: z.array(z.object({ code: z.string(), edges: z.array(prerequisiteSchema) })),
  courses: z.array(
    courseSyllabusSchema.omit({ prerequisites: true }).extend({
      /** Programmes whose current plan lists the course. */
      programmes: z.array(z.string()),
      edges: z.array(prerequisiteSchema),
    }),
  ),
});
export type PrerequisiteSnapshot = z.infer<typeof prerequisiteSnapshotSchema>;

/** The graph the app reads, from the committed syllabi, names, plans and fixes. */
export function prerequisiteSnapshot(sources: PrerequisiteSources): PrerequisiteSnapshot {
  const graph = prerequisiteGraph(sources);
  const { syllabi, names, programmes } = sources;
  const programmesOf = Map.groupBy(
    programmes.flatMap((p) =>
      [...new Set(p.years.flatMap((y) => y.courses.map((c) => c.code)))].map((code) => ({ code, programme: p.code })),
    ),
    (placement) => placement.code,
  );
  const allNames: Record<string, string> = {
    ...englishNames(names).courses,
    ...Object.fromEntries(syllabi.courses.map((c) => [c.code, c.name])),
    ...Object.fromEntries(Object.entries(names.programmes).map(([code, n]) => [programmeNode(code), n.en])),
    ...Object.fromEntries(Object.entries(TOPICS).map(([id, { label }]) => [topicNode(id), label])),
  };
  const nodes = new Set([...graph].flatMap(([from, edges]) => [from, ...edges.map((e) => e.to)]));
  return {
    academicYear: syllabi.academicYear,
    names: Object.fromEntries(Object.entries(allNames).filter(([node]) => nodes.has(node))),
    programmes: programmes
      .filter((p) => graph.has(programmeNode(p.code)))
      .map((p) => ({ code: p.code, edges: graph.get(programmeNode(p.code)) ?? [] })),
    courses: syllabi.courses.map(({ prerequisites: _, ...course }) => ({
      ...course,
      programmes: (programmesOf.get(course.code) ?? []).map((p) => p.programme).toSorted(),
      edges: graph.get(course.code) ?? [],
    })),
  };
}
