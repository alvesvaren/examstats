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

/** A course code, also when the text runs it into the word before or after it, as in "systemENM066" or "TME226Mechanics". */
const COURSE_CODE = /(?<![A-Z])([A-Z]{3}) ?(\d{3})(?!\d)/g;
const PROGRAMME_CODE = /\b(?:MP|TK)[A-Z]{3,4}\b/g;
/** Chalmers' codes of master's programmes start with this. */
const MASTERS_PREFIX = "MP";

/** Course codes a text names, in order of first mention. Also finds codes written with a space, such as "TDA 357". */
export const courseCodesIn = (text: string) => [
  ...new Set(Array.from(text.matchAll(COURSE_CODE), ([, letters, digits]) => `${letters}${digits}`)),
];

const RECOMMENDED =
  /recom+e?n?d|desirabl|\bconsider\b|encouraged|preferabl|ideally|advant[ae]g|helpful|useful|beneficial|suggested|is a plus|good to have|an asset|suitable background|not (?:absolutely |strictly )?(?:mandatory|necessary|required|compulsory)|not (?:a |an )?(?:\w+ )?(?:pre)?requirement/i;
/** Words that recommend only the phrase they stand in, as "preferably" in "programming, preferably in Python". */
const LOCALLY_RECOMMENDED = /\bpreferably\b|\bideally\b/i;
/** Words that require what their phrase names, so that a recommendation elsewhere in the sentence does not reach it. */
const REQUIRED = /(?<!\bnot (?:\w+ )?)\b(?:essential|mandatory|must|necessary|needed|is required|are required)\b/i;
const EXCLUDED =
  /\b(?:can ?not|can't|may not|must not|not|neither can)\b[^.]*?\bbe (?:included|counted|part of)\b[^.]*\bdegree\b|\boverlap/i;
/** Breaks after a full stop, except in abbreviations such as "e.g." that the next word often follows in capitals. */
const SENTENCE_BREAK = /(?<!\b(?:e\.g|i\.e|etc|cf|approx|incl|resp|ca|no)\.)(?<=[.!?])\s+(?=[A-Z0-9])/;
/** What ends the phrase a credit count applies to. A comma between digits, as in "7,5", is a decimal comma. */
const PHRASE_BREAK = /[;:()]|,(?!\d)|\bas well as\b/g;
/** A credit count that a subject follows, as in "15 hec in programming" or "7.5 credits or equivalent of statistics". */
const CREDITS = /(\d+(?:[.,]\d+)?)(?:\s*(?:credits?|hec|hp|ects|cr)|\s+c)\b\.?(?:\s+or equivalent)?\s+(?:in|of|on|within|with)\b/gi;
/**
 * A credit count in brackets after a subject, as in "Linear Algebra (at least 7,5 cr.)" or "Programming in a
 * General-Purpose Language (at least 7,5 cr.)".
 */
const CREDITS_AFTER =
  /^(?:\s+[\w/-]+){0,4}?\s*\((?:at least |min(?:imum)?\.? )?(\d+(?:[.,]\d+)?)(?:\s*(?:credits?|hec|hp|ects|cr)|\s+c)\b/i;
/** More credits than this describe a degree or a whole subject area, not what a course needs. */
const MAX_CREDITS = 45;
/**
 * A degree or programme and what follows it in the sentence, up to a course, as in "BSc in Civil Engineering or
 * equivalent". Course names there name a subject of a degree, not a course.
 */
const DEGREE =
  /\b(?:b\.?sc|m\.?sc|bachelor(?:'s)?|master(?:'s)?|degree|programmes?|programs?)\b[^.;:]*?\b(?:in|within)\b[^.;]*?(?=[,;]?\s*(?:and\s+)?(?:(?:a|the|one)\s+)?courses?\b|[.;]|$)/g;
/** A sentence that speaks of a programme, so that a programme's name in it names the programme and not its subject. */
const PROGRAMME_CONTEXT = /\bprogram(?:me)?s?\b|\bmaster'?s?\b|\bm\.?sc\b/i;
/** Course names shorter than this, or of one word, are too generic to find a course by. */
const MIN_NAME_LENGTH = 10;
/** Words that make a course name no more specific than its subject, as in "Basic physics". */
const GENERIC_PREFIX = /^(?:basic|general|introductory|fundamental|introduction to) /;

const strengthOf = (text: string): Strength | null => (EXCLUDED.test(text) ? "excluded" : RECOMMENDED.test(text) ? "recommended" : null);

/** A line this short that recommends, such as "Recommended prerequisites", heads the lines after it. */
const MAX_HEADING_WORDS = 4;

/**
 * The sentences of a prerequisite text with the strength each inherits. A line that ends in a colon, such as "The
 * following are also recommended:", or a short line that recommends sets the strength of the lines after it.
 */
export function sentencesOf(text: string) {
  let heading: Strength = "required";
  // A line that goes on in lower case continues the sentence of the line before.
  return text
    .replace(/\n(?=[a-z])/g, " ")
    .split("\n")
    .flatMap((line) => {
      const inherited = heading;
      const short = line.trim().split(/\s+/).length <= MAX_HEADING_WORDS && strengthOf(line) !== null;
      if (line.trimEnd().endsWith(":") || short) heading = strengthOf(line) ?? "required";
      return line.split(SENTENCE_BREAK).map((sentence) => ({ text: sentence.trim(), inherited }));
    });
}
type Sentence = ReturnType<typeof sentencesOf>[number];

/**
 * Brackets of this many words or fewer, such as "(recommended)", belong to the phrase they stand in, unless they
 * recommend only themselves, as "(preferably object-oriented)" does.
 */
const MAX_INLINE_BRACKET_WORDS = 3;

/** `text` with the content of every longer bracket blanked out, keeping the indexes of everything else. */
const withoutBrackets = (text: string) =>
  text.replace(/\([^()]*\)/g, (bracket) =>
    bracket.trim().split(/\s+/).length <= MAX_INLINE_BRACKET_WORDS && !LOCALLY_RECOMMENDED.test(bracket)
      ? bracket
      : `(${" ".repeat(bracket.length - 2)})`,
  );

/**
 * How strongly a sentence asks for what it names at `index`. A bracket or a comma-separated phrase that recommends or
 * excludes decides for itself. Otherwise a recommendation elsewhere in the sentence reaches it, as in "Recommended:
 * courses in hydraulics, hydrology", unless another phrase of the sentence states a requirement.
 */
function strengthAt({ text, inherited }: Sentence, index: number): Strength {
  const bracket = [...text.matchAll(/\([^()]*\)/g)].find((b) => b.index < index && index < b.index + b[0].length);
  const inBracket = bracket && strengthOf(bracket[0]);
  if (inBracket) return inBracket;
  const outside = withoutBrackets(text);
  const phrases = [...outside.matchAll(/[^,;]+/g)];
  const own = phrases.find((p) => p.index <= index && index <= p.index + p[0].length);
  const ownStrength = own && strengthOf(own[0]);
  if (ownStrength) return ownStrength;
  if (phrases.some((p) => REQUIRED.test(p[0]))) return own && REQUIRED.test(own[0]) ? "required" : inherited;
  const others = phrases.filter((p) => p !== own);
  const locally = new RegExp(LOCALLY_RECOMMENDED.source, "gi");
  return others.map((p) => strengthOf(p[0].replace(locally, ""))).find((s) => s !== null) ?? inherited;
}

const toCredits = (digits: string) => Number(digits.replace(",", "."));

/**
 * The credits a sentence asks for of the subject from `start` to `end`: from the phrase before it, as in "at least 7.5
 * credits of probability", or from brackets after it, as in "Calculus (at least 7,5 cr.)".
 */
function creditsOf(sentence: string, start: number, end: number) {
  const before = sentence.slice(0, start);
  const lastBreak = [...before.matchAll(PHRASE_BREAK)].at(-1);
  const phraseStart = lastBreak ? lastBreak.index + lastBreak[0].length : 0;
  const digits = [...before.slice(phraseStart).matchAll(CREDITS)].at(-1)?.[1] ?? sentence.slice(end).match(CREDITS_AFTER)?.[1];
  const credits = digits ? toCredits(digits) : null;
  return credits !== null && credits <= MAX_CREDITS ? credits : null;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether a name says no more than one of the subjects in `TOPICS`, as "Linear algebra" or "Basic physics" do. */
function isSubject(name: string) {
  const subject = name.toLowerCase().replace(GENERIC_PREFIX, "");
  return Object.values(TOPICS).some(({ pattern }) => new RegExp(`^(?:${pattern.source})$`).test(subject));
}

/**
 * Finds names from `names`, a record of names by code, in lower-case text. Each name finds the code `pick` chooses
 * among the codes that have it, and nothing when it chooses none. Short names and names of one word find nothing. The
 * longest name wins where names overlap.
 */
function nameFinder(names: Readonly<Record<string, string>>, pick: (codes: readonly string[]) => string | undefined) {
  const codesByName = Map.groupBy(
    Object.entries(names).filter(([, name]) => name.length >= MIN_NAME_LENGTH && /\s/.test(name)),
    ([, name]) => name.toLowerCase(),
  );
  const codeOf = new Map(
    [...codesByName].flatMap(([name, entries]) => {
      const code = pick(entries.map(([c]) => c));
      return code ? [[name, code] as const] : [];
    }),
  );
  const pattern = new RegExp(
    `\\b(?:${[...codeOf.keys()]
      .toSorted((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join("|")})\\b`,
    "g",
  );
  return (text: string) => (codeOf.size ? [...text.matchAll(pattern)] : []).map((match) => ({ match, code: codeOf.get(match[0])! }));
}

/** The one item of `items`, or undefined when it has none or several. */
const only = <T>(items: readonly T[]) => (items.length === 1 ? items[0] : undefined);

/** English name of every course and master's programme, by code. */
const englishNames = (names: NamesFile) => ({
  courses: Object.fromEntries(names.courses.map((c) => [c.code, c.en])),
  masters: Object.fromEntries(
    Object.entries(names.programmes).flatMap(([code, n]) => (code.startsWith(MASTERS_PREFIX) ? [[code, n.en]] : [])),
  ),
});

/**
 * What the parser knows beyond one text: which names find which course or master's programme, and which course given
 * this year a code with no syllabus stands for.
 */
export function prerequisiteIndex(syllabi: readonly CourseSyllabus[], names: NamesFile) {
  const { courses, masters } = englishNames(names);
  const given = new Set(syllabi.map((c) => c.code));
  /** A course given this year by each name, when exactly one is. */
  const givenByName = new Map(
    [...Map.groupBy(syllabi, (c) => c.name.toLowerCase())].flatMap(([name, list]) => {
      const code = only(list)?.code;
      return code ? [[name, code] as const] : [];
    }),
  );
  const replacedBy = new Map(syllabi.flatMap((c) => c.replaces.map((old) => [old, c.code] as const)));
  /** The course given this year that `code` stands for: itself, the course that replaced it, or one of its name. */
  const current = (code: string) =>
    given.has(code) ? code : (replacedBy.get(code) ?? givenByName.get(courses[code]?.toLowerCase() ?? "") ?? code);
  return {
    current,
    findCourses: nameFinder(courses, (codes) => only(codes.filter((c) => given.has(c))) ?? only(codes)),
    findProgrammes: nameFinder(masters, only),
    subjects: new Set(
      Object.values(courses)
        .filter(isSubject)
        .map((name) => name.toLowerCase()),
    ),
  };
}
export type PrerequisiteIndex = ReturnType<typeof prerequisiteIndex>;

/** Blanks out a match so later patterns cannot match inside it, keeping the indexes of everything else. */
const blank = (text: string, start: number, length: number) => text.slice(0, start) + " ".repeat(length) + text.slice(start + length);

/**
 * What a course name found at `start` to `end` of a sentence is. Next to a code it is that code's title. A name that
 * only says a subject, such as "Linear algebra", names a course right after "the course". Another name also does right
 * after "course", before "or equivalent", with a capital letter, or at the start of a sentence or list item.
 */
function courseNameAt(text: string, start: number, end: number, subject: boolean): "title" | "course" | null {
  const before = text.slice(0, start);
  const after = text.slice(end);
  if (/^\s*(?:-\s*)?\(?\s*[A-Z]{3}\d{3}/.test(after) || /[A-Z]{3}\d{3}\)?\s*[-–:]?\s*$/.test(before)) return "title";
  if (/^\s*program/i.test(after)) return null;
  if (/\bthe courses?\s+$/i.test(before)) return "course";
  if (subject) return null;
  const pointed =
    /\bcourses?\b[\s:"'(,]*(?:(?:such as|like|e\.g\.,?|for example|i\.e\.,?)\s+)?$/i.test(before) ||
    /^,?\s*or (?:an? )?(?:equivalent|similar|corresponding)/.test(after);
  return pointed || /^[A-Z]/.test(text.slice(start)) || /^\s*(?:[-–•o]\s*|\d+[.)]\s*)?$/.test(before) ? "course" : null;
}

function edgesInSentence(from: string, sentence: Sentence, index: PrerequisiteIndex) {
  const { text } = sentence;
  const edge = (to: string, via: Prerequisite["via"], match: RegExpExecArray, writtenAs: string | null = null): Prerequisite => ({
    to,
    strength: strengthAt(sentence, match.index),
    via,
    credits: creditsOf(text, match.index, match.index + match[0].length),
    writtenAs,
    source: text,
  });

  const codes = [...text.matchAll(COURSE_CODE)].map((match) => {
    const written = `${match[1]}${match[2]}`;
    const code = index.current(written);
    return edge(code, "code", match, code === written ? null : written);
  });
  const programmeCodes = [...text.matchAll(PROGRAMME_CODE)].map((match) => edge(programmeNode(match[0]), "programme", match));

  let lower = text.toLowerCase();
  // A master's programme asks for subjects, which its applicants may have studied anywhere, not for Chalmers' courses.
  const courseNames = from.startsWith("programme:")
    ? []
    : index.findCourses(lower.replace(DEGREE, (degree) => " ".repeat(degree.length))).flatMap(({ match, code }) => {
        const kind = courseNameAt(text, match.index, match.index + match[0].length, index.subjects.has(match[0]));
        if (kind) lower = blank(lower, match.index, match[0].length);
        return kind === "course" ? [edge(index.current(code), "name", match)] : [];
      });
  const programmeNames = PROGRAMME_CONTEXT.test(text)
    ? index.findProgrammes(lower).map(({ match, code }) => {
        lower = blank(lower, match.index, match[0].length);
        return edge(programmeNode(code), "name", match);
      })
    : [];

  const topics = Object.entries(TOPICS).flatMap(([id, { pattern }]) => {
    const match = pattern.exec(lower);
    return match ? [edge(topicNode(id), "topic", match)] : [];
  });

  const edges = [...codes, ...courseNames, ...programmeCodes, ...programmeNames, ...topics].filter((e) => e.to !== from);
  // A sentence that excludes courses from a degree names other things only to describe those courses.
  return edges.filter((e) => e.strength !== "excluded" || e.via === "code" || e.via === "name");
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
