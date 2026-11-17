import { z } from "zod";
import { TOPICS } from "./prerequisite-topics.ts";

export const syllabusSchema = z.object({
  code: z.string(),
  name: z.string(),
  /** Chalmers' level, such as "First-cycle" or "Second-cycle". */
  level: z.string(),
  credits: z.number().nonnegative(),
  /** Master's programmes whose plan lists the course. Empty for a course only another course's prerequisites name. */
  programmes: z.array(z.string()),
  /** Codes of earlier courses this one replaces. */
  replaces: z.array(z.string()),
  /** The syllabus' prerequisites as plain text, one line per paragraph or list item. Empty when it states none. */
  prerequisites: z.string(),
});

/** The committed file that `pnpm prerequisites` writes. */
export const syllabiFileSchema = z.object({
  academicYear: z.string(),
  /** Name of every master's programme in the academic year, by code. */
  programmes: z.record(z.string(), z.string()),
  /** Name of every course given in the academic year, by code. */
  catalog: z.record(z.string(), z.string()),
  courses: z.array(syllabusSchema),
});

export type Syllabus = z.infer<typeof syllabusSchema>;
export type SyllabiFile = z.infer<typeof syllabiFileSchema>;

export const STRENGTHS = ["required", "recommended", "excluded"] as const;
export type Strength = (typeof STRENGTHS)[number];

/**
 * One prerequisite of a course. `to` is a course code, `topic:<id>` for a subject from `TOPICS`, or
 * `programme:<code>` for a programme the text names, such as its admission requirements.
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
 * A hand-written correction of the parser. It sets the edge from `from` to `to`, replacing what the parser found, and
 * "none" removes it.
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
const CREDITS = /(\d+(?:[.,]\d+)?)\s*(?:credits?|hec|hp|ects|c)\b(?:\s+or equivalent)?\s+(?:in|of|within|with)\b/gi;
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

/** The credits the phrase before `index` asks for, such as 7.5 in "at least 7.5 credits of probability". */
function creditsBefore(sentence: string, index: number) {
  const [phrase = ""] = sentence.slice(0, index).match(PHRASE) ?? [];
  const last = [...phrase.matchAll(CREDITS)].at(-1);
  return last ? Number(last[1]!.replace(",", ".")) : null;
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

/** What the parser knows beyond one syllabus: which names find which course or programme, and which course replaced an old code. */
export function prerequisiteIndex({ programmes, catalog, courses }: Pick<SyllabiFile, "programmes" | "catalog" | "courses">) {
  return {
    known: new Set([...Object.keys(catalog), ...courses.map((c) => c.code)]),
    replacedBy: new Map(courses.flatMap((c) => c.replaces.map((old) => [old, c.code] as const))),
    findCourses: nameFinder(catalog),
    findProgrammes: nameFinder(programmes),
  };
}
export type PrerequisiteIndex = ReturnType<typeof prerequisiteIndex>;

/** Blanks out a match so later patterns cannot match inside it, keeping the indexes of everything else. */
const blank = (text: string, start: number, length: number) => text.slice(0, start) + " ".repeat(length) + text.slice(start + length);

function edgesInSentence(from: string, { text, strength }: ReturnType<typeof sentencesOf>[number], index: PrerequisiteIndex) {
  const edge = (to: string, via: Prerequisite["via"], at: number, writtenAs: string | null = null): Prerequisite => ({
    to,
    strength,
    via,
    credits: creditsBefore(text, at),
    writtenAs,
    source: text,
  });

  const codes = [...text.matchAll(COURSE_CODE)].map((match) => {
    const written = `${match[1]}${match[2]}`;
    const replacement = index.known.has(written) ? undefined : index.replacedBy.get(written);
    return edge(replacement ?? written, "code", match.index, replacement ? written : null);
  });
  const programmeCodes = [...text.matchAll(PROGRAMME_CODE)].map((match) => edge(programmeNode(match[0]), "programme", match.index));

  let lower = text.toLowerCase();
  const programmeNames = index.findProgrammes(lower).map(({ match, code }) => {
    lower = blank(lower, match.index, match[0].length);
    return edge(programmeNode(code), "name", match.index);
  });
  const courseNames = index.findCourses(lower.replace(DEGREE, (degree) => " ".repeat(degree.length))).map(({ match, code }) => {
    lower = blank(lower, match.index, match[0].length);
    return edge(code, "name", match.index);
  });

  const topics = Object.entries(TOPICS).flatMap(([id, { pattern }]) => {
    const match = pattern.exec(lower);
    return match ? [edge(topicNode(id), "topic", match.index)] : [];
  });

  const courses = [...codes, ...courseNames].filter((e) => e.to !== from);
  // A sentence that excludes courses from a degree names other things only to describe those courses.
  return strength === "excluded" ? courses : [...courses, ...programmeCodes, ...programmeNames, ...topics];
}

const STRENGTH_RANK: Record<Strength, number> = { required: 0, recommended: 1, excluded: 2 };

/** The prerequisites a course's syllabus states, one per node, the strongest mention first, in order of mention. */
export function parsePrerequisites({ code, prerequisites }: Pick<Syllabus, "code" | "prerequisites">, index: PrerequisiteIndex) {
  const edges = sentencesOf(prerequisites).flatMap((sentence) => edgesInSentence(code, sentence, index));
  const byNode = Map.groupBy(edges, (e) => e.to);
  return [...byNode.values()].map((mentions) => {
    const strongest = mentions.toSorted((a, b) => STRENGTH_RANK[a.strength] - STRENGTH_RANK[b.strength])[0]!;
    return { ...strongest, credits: strongest.credits ?? mentions.find((m) => m.credits)?.credits ?? null };
  });
}

/** `edges` with the fixes for course `from` applied: each fix replaces or removes the edge to its node, or adds one. */
export function applyFixes(from: string, edges: readonly Prerequisite[], fixes: readonly PrerequisiteFix[]) {
  const own = new Map(fixes.filter((f) => f.from === from).map((f) => [f.to, f]));
  const fixed = [...own.values()].flatMap((fix): Prerequisite[] =>
    fix.strength === "none"
      ? []
      : [{ to: fix.to, strength: fix.strength, via: "fix", credits: null, writtenAs: null, source: fix.note ?? "" }],
  );
  return [...edges.filter((e) => !own.has(e.to)), ...fixed];
}

/** Every course's prerequisites by course code, parsed from its syllabus and then corrected by `fixes`. */
export function prerequisiteGraph(file: Pick<SyllabiFile, "programmes" | "catalog" | "courses">, fixes: readonly PrerequisiteFix[]) {
  const index = prerequisiteIndex(file);
  return new Map(file.courses.map((course) => [course.code, applyFixes(course.code, parsePrerequisites(course, index), fixes)]));
}

/** The graph that `pnpm snapshot` writes for the app: every syllabus' prerequisites, with fixes applied. */
export const prerequisiteSnapshotSchema = z.object({
  academicYear: z.string(),
  /** Name of each `topic:<id>` node's subject, by id. */
  topics: z.record(z.string(), z.string()),
  /** Name of each `programme:<code>` node, by code. */
  programmes: z.record(z.string(), z.string()),
  /** Name of every course in the graph that has a syllabus this academic year, by code. */
  courseNames: z.record(z.string(), z.string()),
  courses: z.array(syllabusSchema.omit({ prerequisites: true }).extend({ edges: z.array(prerequisiteSchema) })),
});
export type PrerequisiteSnapshot = z.infer<typeof prerequisiteSnapshotSchema>;

/** The graph the app reads, from the committed syllabi and fixes. */
export function prerequisiteSnapshot(file: SyllabiFile, fixes: readonly PrerequisiteFix[]): PrerequisiteSnapshot {
  const graph = prerequisiteGraph(file, fixes);
  const names = { ...file.catalog, ...Object.fromEntries(file.courses.map((c) => [c.code, c.name])) };
  const nodes = new Set([...graph].flatMap(([code, edges]) => [code, ...edges.map((e) => e.to)]));
  return {
    academicYear: file.academicYear,
    topics: Object.fromEntries(Object.entries(TOPICS).map(([id, { label }]) => [id, label])),
    programmes: file.programmes,
    courseNames: Object.fromEntries(Object.entries(names).filter(([code]) => nodes.has(code))),
    courses: file.courses.map(({ prerequisites: _, ...course }) => ({ ...course, edges: graph.get(course.code) ?? [] })),
  };
}
