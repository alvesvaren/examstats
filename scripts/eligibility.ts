/**
 * Fetches Chalmers' eligibility guide for its own students, "Val av masterprogram för Chalmersstudenter –
 * Behörighetsguide", and writes `data/eligibility.json`. The guide translates the entry requirements of each master's
 * programme into Chalmers course codes for the students of each Chalmers programme, so the planner can check a plan
 * against them exactly. Chalmers publishes the guide of the next academic year each October on its admission
 * regulations page, and the newest guide is the one to plan by.
 *
 * The guide is a PDF whose blocks follow a few fixed phrasings. The parser reads only those, and a block of courses
 * has to read back to its own words. Anything else keeps the guide's words, which the planner shows without checking,
 * and the script lists it. The only code that knows the guide.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import {
  guideCourses,
  type Admission,
  type CourseRule,
  type EligibilityFile,
  type GuideCourse,
  type GuideEntry,
  type GuideMaster,
} from "../src/domain/eligibility.ts";
import { namesFileSchema, normalize } from "../src/domain/names.ts";
import { toJsonLines } from "./json-lines.ts";

const parseEnv = () =>
  z
    .object({
      PAGE_URL: z
        .url()
        .default("https://www.chalmers.se/utbildning/dina-studier/rattigheter-och-skyldigheter/antagningsordning-for-grundutbildningen/"),
      OUT_FILE: z.string().default("data/eligibility.json"),
      NAMES_FILE: z.string().default("data/names.json"),
    })
    .parse(process.env);

const HEADERS = { "User-Agent": "u345 course stats (+https://github.com/alvesvaren/examstats)" };

/** A course code of Chalmers or the University of Gothenburg: three capital letters and three digits. */
const CODE = "[A-Z]{3}\\d{3}";
const STARTS_WITH_CODE = new RegExp(`^${CODE}`);
/** A Chalmers programme's code in brackets, as the guide writes it after the programme's name. */
const PROGRAMME_CODE = /\((T[A-Z]{3,5}[a-z]?)\)/;

/** Links to documents in Chalmers' archive of rules, which the admission regulations page lists. */
export function documentLinks(html: string, pageUrl: string): string[] {
  const links = html.match(/\/api\/media\/\?url=https:\/\/webbpublicering360\.portal\.chalmers\.se\/[^"\\\s<>]+/g) ?? [];
  return [...new Set(links)].map((link) => new URL(link, pageUrl).href);
}

/** The academic year a guide's title page names, such as "2027/2028". Null for a document that is not the guide. */
export function guideYear(pages: readonly string[]): string | null {
  // The title's font drops spaces between words.
  const title = (pages[0] ?? "").replace(/\s+/g, "");
  const year = /^Valavmasterprogram.*Behörighetsguide.*läsåret(\d{2})(\d{2})\/(\d{2})/.exec(title);
  return year ? `${year[1]}${year[2]}/${year[1]}${year[3]}` : null;
}

const space = (text: string) => text.replace(/\s+/g, " ").trim();

const isPageNumber = (line: string | undefined) => line !== undefined && /^\d+$/.test(line);

/** The lines of a guide's pages, without the page numbers, which a PDF reader gives first or last on the page. */
export function guideLines(pages: readonly string[]): string[] {
  return pages.flatMap((page) => {
    const lines = page.split("\n").map(space).filter(Boolean);
    return lines.slice(isPageNumber(lines[0]) ? 1 : 0, isPageNumber(lines.at(-1)) ? -1 : undefined);
  });
}

const TOC_ENTRY = /^(.+?)\s*\.{3,}\s*\d+$/;
const MASTER_TITLE = /^.+ \((MP[A-Z]{3})\)(?: med specialiseringen: (.+))?$/;

interface Section {
  code: string;
  specialisation: string | null;
  lines: string[];
}

/** Where a heading starts and ends in `body`, at or after `from`. A long heading wraps onto the lines after it. */
function headingAt(body: readonly string[], title: string, from: number) {
  for (let start = from; start < body.length; start++) {
    let text = body[start]!;
    for (let end = start + 1; title.startsWith(text); end++) {
      if (text === title) return { start, end };
      if (end >= body.length) break;
      text = `${text} ${body[end]}`;
    }
  }
  return null;
}

/** The guide's section of each master's programme, and of each specialisation with requirements of its own, by its table of contents. */
function sectionsOf(lines: readonly string[]): Section[] {
  const titles = lines.flatMap((line) => TOC_ENTRY.exec(line)?.[1] ?? []);
  const body = lines.slice(lines.findLastIndex((line) => TOC_ENTRY.test(line)) + 1);
  let from = 0;
  const headings = titles.flatMap((title) => {
    const master = MASTER_TITLE.exec(title);
    if (!master) return [];
    const at = headingAt(body, title, from);
    if (!at) throw new Error(`The guide has no heading "${title}"`);
    from = at.end;
    return [{ code: master[1]!, specialisation: master[2] ?? null, ...at }];
  });
  if (headings.length === 0) throw new Error("The guide lists no master's programmes");
  return headings.map(({ code, specialisation, end }, i) => ({
    code,
    specialisation,
    lines: body.slice(end, headings[i + 1]?.start ?? body.length),
  }));
}

const isProgrammeLine = (line: string) => !STARTS_WITH_CODE.test(line) && PROGRAMME_CODE.test(line);

/** Lines that start something of their own. Any other line continues the one before it, which the PDF wrapped. */
const STARTS = [
  STARTS_WITH_CODE,
  /^samt$/i,
  /^Kurskrav:/,
  /^\d+ av /,
  /^Alternativ \d+:/,
  /^Sökande från /,
  /^De särskilda behörighetskraven /,
  /^Följande program /,
  /^Rekommendera/,
  /^\*\)/,
  /^Observera/,
  /^För sökande /,
  /^Är programmet /,
  /^\(?Anmälan görs /,
  /^Programmet /,
  /^Den generella regeln /,
];

/**
 * The lines of a section as the guide writes them, with the lines the PDF wrapped joined. A line ending in "eller" or
 * "/" goes on, and so does a programme's line that ends in a colon before its list of specialisations. Any other line
 * ending in a colon heads the lines after it.
 */
function logicalLines(lines: readonly string[]): string[] {
  const joined: string[] = [];
  for (const line of lines) {
    const previous = joined.at(-1);
    const heads = previous?.endsWith(":") && !isProgrammeLine(previous);
    const continues =
      previous !== undefined && !heads && (/(?: eller|\/)$/.test(previous) || !(STARTS.some((s) => s.test(line)) || isProgrammeLine(line)));
    if (continues) joined[joined.length - 1] = `${previous} ${line}`;
    else joined.push(line);
  }
  return joined.map((line) => line.replace(/\/ /g, "/").replace(/ ,/g, ","));
}

const LETTER_AND_INTERVIEW =
  "Observera att det finns ett krav på att sökande ska ladda upp ett personligt brev. Urvalet baseras på det personliga brevet samt en intervju.";

type HeadingKind = "same" | "compulsory" | "regulations";

/** The headings of a list of programmes, and what they say of the programmes after them. */
const HEADINGS: { kind: HeadingKind; pattern: RegExp }[] = [
  {
    kind: "same",
    pattern: new RegExp(
      `^Sökande från följande program har samma kurskrav(?::| utöver de obligatoriska kurserna i årskurs 1-3 på respektive program\\. ${escape(LETTER_AND_INTERVIEW)})$`,
    ),
  },
  {
    kind: "compulsory",
    pattern: new RegExp(
      "^Sökande från (?:följande program|nedanstående civilingenjörsprogram 300hp) uppfyller (?:alla )?(?:behörigheten|särskilda förkunskapskrav) " +
        "utifrån de obligatoriska kurserna i (?:årskurs 1-3(?: på(?: respektive program)?)?|respektive programs? kandidatdel|respektive program),? " +
        `utan ytterligare kurskrav(?::|\\.(?: ${escape(LETTER_AND_INTERVIEW)})?)$`,
    ),
  },
  {
    kind: "regulations",
    pattern:
      /^De särskilda behörighetskraven ska kontrolleras, de framgår av kapitlet Särskild behörighet till avancerad nivå \(huvudområde och kurskrav specificerat för varje masterprogram\) i Antagningsordningen\.$/,
  },
  { kind: "regulations", pattern: /^Följande program är ackrediterade:$/ },
];

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Sentences that say nothing of what a programme's students need, or say it in the way the parser already reads. */
const NOTES = [
  /^För sökande från andra program på grundutbildningsnivå än de som anges nedan framgår de särskilda behörighetskraven av kapitlet Särskild behörighet till avancerad nivå \(huvudområde och kurskrav specificerat för varje masterprogram\) i Antagningsordningen\.$/,
  /^Är programmet ackrediterat omfattas det av förtur\.(?: Om ett högskoleingenjörs- eller kandidatprogram omfattas av förtur anges det nedan\.)?$/,
  /^\(Anmälan görs samtidigt till program och specialiseringen, på antagning\.se\)$/,
  /^Observera att (?:en |två )?av programmets specialiseringar har egna behörighetskrav, som anges längre ner\.$/,
  /^Observera:$/,
  /^Den generella regeln att ackreditering likställs med förtur gäller inte till programmet\. Programmets alternativa urvalsprocess innehåller flera moment och ingen sökande kan ges en förhandsbedömning\.$/,
  /^Programmet tillämpar ett alternativt urval baserat på skriftliga reflektioner, resumé samt intervju för samtliga sökande\. För sökande från samtliga program på grundutbildningsnivå framgår de särskilda behörighetskraven av kapitlet Särskild behörighet till avancerad nivå \(huvudområde och kurskrav specificerat för varje masterprogram\) i Antagningsordningen\.$/,
  /^Programmet tillämpar ett alternativt urval baserat på ett personligt brev och en godkänd personlig intervju för samtliga sökande\. För sökande från andra program på grundutbildningsnivå än de som anges nedan framgår de särskilda behörighetskraven av kapitlet Särskild behörighet till avancerad nivå \(huvudområde och kurskrav specificerat för varje masterprogram\) i Antagningsordningen\.$/,
  /^Programmet är inte ackrediterat av något civilingenjörs-\/arkitektprogram\.$/,
  // The asterisk it explains marks the course as one that needs only a registration.
  /^\*\) kursregistrering kontroller(?:er)?as, undantag från kravet på slutrapporterad kurs i Ladok gäller endast för anmälan i tid till höstterminen \d{4} och vid studier i nominell studietakt\. Vid sen anmälan till höstterminen \d{4} ska kursen vara slutrapporterad\. Undantag från avklarad kurs upphör efter \d{4} och gäller inte för anmälan till höstterminen \d{4}\.$/,
];

/** A specialisation's section that defers to the programme's. */
const SAME_AS_PROGRAMME =
  /^Anmälan görs samtidigt till program och specialiseringen, på antagning\.se\. Den här specialiseringen är inte valbar senare\. De särskilda behörighetskraven är desamma som till programmet, se ovan\.$/;

const RECOMMENDED_LIST = /^Rekommenderade kurser (?:för )?samtliga sökande:$/;
const RECOMMENDED_INLINE = /^Rekommendera(?:de kurser|d kurs): (.+)$/;

const COURSE = new RegExp(`^(${CODE}\\*?(?:/${CODE}\\*?)*)\\s*(?:[-–]\\s*)?(\\S.*)$`);
const OR = new RegExp(`\\s+eller\\s+(?=${CODE})`);
const AND = new RegExp(`\\s+och\\s+(?=${CODE})`);
const PICK = /^(\d+) av (\d+) valfritt? från nedan kurser$/;
const ALTERNATIVES = /^(\d+) av följande (\d+) alternativ:$/;
const ALTERNATIVE = /^Alternativ (\d+):$/;

function courseOf(text: string): GuideCourse | null {
  const match = COURSE.exec(text);
  if (!match) return null;
  return { codes: match[1]!.replaceAll("*", "").split("/"), name: match[2]!, registration: match[1]!.includes("*") };
}

/** Courses that are alternatives on one line: "LMA017 Matematisk analys i flera variabler eller MVE655 Flervariabelanalys". */
function orLineOf(line: string): CourseRule | null {
  const courses = line.split(OR).map(courseOf);
  if (courses.some((c) => c === null)) return null;
  const rules = courses.map((c) => ({ kind: "course" as const, ...c! }));
  return rules.length === 1 ? rules[0]! : { kind: "any", of: rules };
}

/** "1 av följande 2 alternativ:" and the alternatives after it, each headed "Alternativ 1:" and so on. */
function alternativesOf(lines: readonly string[], count: number, total: number): CourseRule | null {
  const starts = lines.flatMap((line, i) => (ALTERNATIVE.test(line) ? [i] : []));
  const numbered = starts.every((start, k) => ALTERNATIVE.exec(lines[start]!)?.[1] === String(k + 1));
  if (starts.length !== total || starts[0] !== 0 || !numbered) return null;
  const alternatives = starts.map((start, k) => ruleOf(lines.slice(start + 1, starts[k + 1] ?? lines.length)));
  if (alternatives.some((a) => a === null)) return null;
  const of = alternatives.map((a) => a!);
  return count === 1 ? { kind: "any", of } : { kind: "atLeast", count, of };
}

/**
 * The rule of a block of course lines, or null when the lines do not follow the guide's grammar: lines of alternative
 * courses joined by lines of "samt", a line "2 av 4 valfritt från nedan kurser" with its four lines, or "1 av följande
 * 2 alternativ:" with the alternatives that end the block.
 */
function ruleOf(lines: readonly string[]): CourseRule | null {
  const terms: CourseRule[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const alternatives = ALTERNATIVES.exec(line);
    const pick = PICK.exec(line);
    if (alternatives) {
      const rule = alternativesOf(lines.slice(i + 1), Number(alternatives[1]), Number(alternatives[2]));
      if (!rule) return null;
      terms.push(rule);
      i = lines.length;
    } else if (pick) {
      const [count, total] = [Number(pick[1]), Number(pick[2])];
      const items = lines.slice(i + 1, i + 1 + total).map(orLineOf);
      if (items.length !== total || total < 2 || items.some((item) => item === null)) return null;
      terms.push({ kind: "atLeast", count, of: items.map((item) => item!) });
      i += 1 + total;
    } else {
      const item = orLineOf(line);
      if (!item) return null;
      terms.push(item);
      i += 1;
    }
    if (i < lines.length) {
      // Two terms without "samt" between them leave open how they combine.
      if (!/^samt$/i.test(lines[i]!) || i + 1 >= lines.length) return null;
      i += 1;
    }
  }
  if (terms.length === 0) return null;
  return terms.length === 1 ? terms[0]! : { kind: "all", of: terms };
}

const courseText = ({ codes, name, registration }: GuideCourse) => `${codes.join("/")}${registration ? "*" : ""} ${name}`;
const isLine = (rule: CourseRule) => rule.kind === "course" || (rule.kind === "any" && rule.of.every((r) => r.kind === "course"));
const alternativesText = (count: number, of: readonly CourseRule[]) =>
  [`${count} av följande ${of.length} alternativ:`, ...of.flatMap((rule, i) => [`Alternativ ${i + 1}:`, ruleText(rule)])].join("\n");

/** A rule in the guide's words, line by line. */
export function ruleText(rule: CourseRule): string {
  switch (rule.kind) {
    case "course":
      return courseText(rule);
    case "all":
      return rule.of.map(ruleText).join("\nsamt\n");
    case "any":
      return isLine(rule) ? rule.of.map(ruleText).join(" eller ") : alternativesText(1, rule.of);
    case "atLeast":
      return rule.of.every(isLine)
        ? [`${rule.count} av ${rule.of.length} valfritt från nedan kurser`, ...rule.of.map(ruleText)].join("\n")
        : alternativesText(rule.count, rule.of);
  }
}

/** The guide's lines with the spellings it varies between made one: "MTF053 - Strömningsmekanik", "LMA224Matematisk", "Samt". */
const comparable = (lines: readonly string[]) =>
  lines
    .map((line) =>
      space(line)
        .replace(new RegExp(`(${CODE}\\*?)\\s*[-–]?\\s*(?=[A-ZÅÄÖa-zåäö])`, "g"), "$1 ")
        .replace(/^samt$/i, "samt")
        .replace(/valfrit från/, "valfritt från"),
    )
    .join("\n");

/** The rule of a block of course lines, if it follows the guide's grammar and reads back to the same words. */
export function requirementOf(lines: readonly string[]): CourseRule | null {
  const rule = ruleOf(lines.map(space));
  return rule && comparable(ruleText(rule).split("\n")) === comparable(lines) ? rule : null;
}

/** Courses the guide recommends, one per line or several joined by "och" on one line, if every item is one course. */
function recommendedOf(items: readonly string[]): GuideCourse[] | null {
  const courses = items.map(courseOf);
  return courses.some((c) => c === null) ? null : courses.map((c) => c!);
}

const PATH = /\(?för student som följer programp\w* mot (civilingenjörs|högskoleingenjörs)\w*\)?/;
const PATHS: Readonly<Record<string, GuideEntry["path"]>> = { civilingenjörs: "fiveYear", högskoleingenjörs: "threeYear" };
const CONDITIONAL =
  /med villkorad ackreditering(?: \(för civilingenjörsexamen\))? för (?:specialiseringen|följande specialiseringar): (.+?)(?=\s*(?:–|$))/;
const ACCREDITED = /\backrediterat(?: \((?:för )?(?:civilingenjörs|arkitekt)examen\))?/;
const PRIORITY = /\bförtur(?: \(platsgaranti\))?/;
const CREDITS = /\s*\((?:\d+ ?hp(?:\/\d+ ?hp)?|\d+\/\d+ ?hp)\)/g;
/** The dashes the guide puts between a programme and what it says of it, written in several ways. */
const DASHES = /^\s*-+\s*|\s*-+–\s*|\s+-+\s+|\s*–\s*/g;

/**
 * A programme's line: its code, the path of its students the line is for, and whether the rest says only what the
 * parser knows: accreditation, conditional accreditation for specialisations, and priority.
 */
function programmeOf(line: string) {
  const code = PROGRAMME_CODE.exec(line)![1]!;
  const plain = line.replace(CREDITS, "");
  const rest = plain.slice(plain.indexOf(`(${code})`) + code.length + 2).replace(DASHES, " – ");
  const leftover = [PATH, CONDITIONAL, ACCREDITED, PRIORITY].reduce((text, pattern) => text.replace(pattern, ""), rest);
  return { code, path: PATHS[PATH.exec(rest)?.[1] ?? ""] ?? null, known: /^[\s–,]*$/.test(leftover) };
}

interface Group {
  heading: { kind: HeadingKind | "words"; text: string } | null;
  programmes: string[];
  /** The lines after "Kurskrav:", or null without one. */
  requirement: string[] | null;
  recommended: string[];
}

/** The guide's words for a programme of a group, to show where the parser cannot check them. */
const groupText = (group: Group, programme: string) =>
  [...(group.heading ? [group.heading.text] : []), programme, ...(group.requirement ? ["Kurskrav:", ...group.requirement] : [])].join("\n");

/** What a group of programmes asks of each of them, with a problem to report when the parser cannot read it. */
function admissionOf(group: Group, programme: string): { admission: Admission; problem: string | null } {
  const words = (problem: string) => ({ admission: { kind: "words" as const, text: groupText(group, programme) }, problem });
  const kind = group.heading?.kind ?? "same";
  if (kind === "words") return words("its heading is not one the parser knows");
  if (kind !== "same") {
    if (group.requirement) return words(`it is listed as ${kind} but has course requirements`);
    return { admission: { kind }, problem: null };
  }
  if (!group.requirement) return words("it has no course requirements, nor a heading that says why");
  const rule = requirementOf(group.requirement);
  if (!rule) return words("its course requirements do not follow the guide's grammar");
  return { admission: { kind: "courses", rule }, problem: null };
}

/** Each master's programme of a guide, with what it asks of the students of each programme the guide names. */
export function parseGuide(pages: readonly string[]): { masters: GuideMaster[]; problems: string[] } {
  const problems: string[] = [];
  const masters: GuideMaster[] = [];
  for (const section of sectionsOf(guideLines(pages))) {
    const label = section.specialisation ? `${section.code} (${section.specialisation})` : section.code;
    const groups: Group[] = [];
    const recommended: string[] = [];
    const stray: string[] = [];
    let sameAsProgramme = false;
    let listingRecommended = false;
    for (const line of logicalLines(section.lines)) {
      const group = groups.at(-1);
      if (listingRecommended && STARTS_WITH_CODE.test(line)) {
        recommended.push(line);
        continue;
      }
      listingRecommended = false;
      if (NOTES.some((note) => note.test(line))) continue;
      if (SAME_AS_PROGRAMME.test(line)) {
        sameAsProgramme = true;
        continue;
      }
      const heading = HEADINGS.find(({ pattern }) => pattern.test(line));
      if (heading || line.startsWith("Sökande från ")) {
        groups.push({ heading: { kind: heading?.kind ?? "words", text: line }, programmes: [], requirement: null, recommended: [] });
      } else if (isProgrammeLine(line)) {
        // A programme on its own line heads a group of its own, unless a heading lists it.
        const joins = group && !group.requirement && (group.heading ? true : group.programmes.length === 0);
        if (joins) group.programmes.push(line);
        else groups.push({ heading: null, programmes: [line], requirement: null, recommended: [] });
      } else if (line === "Kurskrav:" && group && group.programmes.length > 0 && !group.requirement) {
        group.requirement = [];
      } else if (RECOMMENDED_LIST.test(line)) {
        listingRecommended = true;
      } else if (RECOMMENDED_INLINE.test(line)) {
        const items = RECOMMENDED_INLINE.exec(line)![1]!.split(AND);
        (group ? group.recommended : recommended).push(...items);
      } else if (group?.requirement) {
        group.requirement.push(line);
      } else if (group && group.programmes.length > 0) {
        // Words after a programme's line that the PDF did not wrap into it, such as a note on its priority.
        group.programmes[group.programmes.length - 1] += ` ${line}`;
      } else {
        stray.push(line);
      }
    }

    if (sameAsProgramme) {
      const programme = masters.find((m) => m.code === section.code && m.specialisation === null);
      if (!programme) throw new Error(`${label} defers to a programme the guide has no section for`);
      masters.push({ ...programme, specialisation: section.specialisation });
      continue;
    }
    const sectionRecommended = recommendedOf(recommended);
    if (!sectionRecommended) problems.push(`${label}: its recommended courses do not read as courses`);
    if (stray.length > 0) problems.push(`${label}: it says what the parser cannot place: ${stray.join(" ")}`);
    const entries: GuideEntry[] = groups.flatMap((group) => {
      if (group.programmes.length === 0) problems.push(`${label}: a heading lists no programmes: ${group.heading?.text ?? ""}`);
      const groupRecommended = recommendedOf(group.recommended);
      return group.programmes.map((line) => {
        const { code, path, known } = programmeOf(line);
        const read = admissionOf(group, line);
        const problem = !known ? `its line says what the parser does not know: ${line}` : read.problem;
        if (problem) problems.push(`${label} ${code}: ${problem}`);
        if (!groupRecommended) problems.push(`${label} ${code}: its recommended courses do not read as courses`);
        const admission: Admission =
          known && stray.length === 0 ? read.admission : { kind: "words", text: [...stray, groupText(group, line)].join("\n") };
        return { programme: code, path, admission, recommended: groupRecommended ?? [] };
      });
    });
    const duplicates = entries.filter(
      (entry, i) => entries.findIndex((other) => other.programme === entry.programme && other.path === entry.path) !== i,
    );
    for (const { programme } of duplicates) problems.push(`${label} ${programme}: the guide names it twice`);
    masters.push({ code: section.code, specialisation: section.specialisation, entries, recommended: sectionRecommended ?? [] });
  }
  return { masters, problems };
}

/** The text of each page of a PDF. */
export async function pdfPages(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  return text;
}

async function fetchOk(url: string) {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`GET ${url}: ${response.status} ${response.statusText}`);
  return response;
}

/** The newest guide that the admission regulations page links to, with its pages. */
async function newestGuide(pageUrl: string) {
  const html = await (await fetchOk(pageUrl)).text();
  const documents = await Promise.all(
    documentLinks(html, pageUrl).map(async (url) => {
      const pages = await pdfPages(new Uint8Array(await (await fetchOk(url)).arrayBuffer()));
      return { url, pages, year: guideYear(pages) };
    }),
  );
  const guides = documents.filter((d) => d.year !== null).toSorted((a, b) => a.year!.localeCompare(b.year!));
  const newest = guides.at(-1);
  if (!newest) throw new Error(`${pageUrl} links to no eligibility guide among ${documents.length} documents`);
  return { ...newest, year: newest.year! };
}

/** A course name without punctuation, so that "Människa-maskinsystem" and "Människa maskinsystem" compare equal. */
const nameWords = (name: string) => space(normalize(name).replace(/[^a-z0-9]+/g, " "));

/**
 * Codes the guide names that chalmers.se has not named since 2021/2022, and names the guide gives courses that
 * chalmers.se names otherwise, either of which can be a typo in the guide. Older codes are common, since the guide
 * names the codes a course had before.
 */
function courseWarnings(masters: readonly GuideMaster[], names: ReadonlyMap<string, { en: string; sv: string }>) {
  const courses = guideCourses(masters);
  const unknown = new Set(courses.flatMap(({ codes }) => codes.filter((code) => !names.has(code))));
  const renamed = new Set(
    courses.flatMap(({ codes, name }) =>
      codes.flatMap((code) => {
        const known = names.get(code);
        const same = (other: string) => nameWords(other).includes(nameWords(name)) || nameWords(name).includes(nameWords(other));
        return !known || same(known.sv) || same(known.en) ? [] : [`${code} ${name}: chalmers.se names it ${known.sv}`];
      }),
    ),
  );
  return { unknown: [...unknown].toSorted(), renamed: [...renamed].toSorted() };
}

async function main() {
  const env = parseEnv();
  const names = namesFileSchema.parse(JSON.parse(await readFile(env.NAMES_FILE, "utf8")));
  const guide = await newestGuide(env.PAGE_URL);
  console.log(`Reading the eligibility guide for ${guide.year} from ${guide.url}`);
  const { masters, problems } = parseGuide(guide.pages);
  for (const problem of problems) console.warn(`Not checked: ${problem}`);
  const { unknown: unknownCodes, renamed } = courseWarnings(masters, new Map(names.courses.map(({ code, en, sv }) => [code, { en, sv }])));
  if (unknownCodes.length > 0) console.warn(`Codes chalmers.se has not named since 2021/2022: ${unknownCodes.join(", ")}`);
  for (const warning of renamed) console.warn(`Course: ${warning}`);
  const unknown = [...new Set(masters.flatMap((m) => m.entries.map((e) => e.programme)))].filter((code) => !names.programmes[code]);
  if (unknown.length > 0) console.warn(`Programmes chalmers.se does not name: ${unknown.join(", ")}`);

  const file: EligibilityFile = { academicYear: guide.year, source: guide.url, masters };
  await mkdir(dirname(env.OUT_FILE), { recursive: true });
  const { masters: lines, ...head } = file;
  await writeFile(env.OUT_FILE, toJsonLines(head, "masters", lines));
  const entries = masters.reduce((sum, m) => sum + m.entries.length, 0);
  console.log(`Wrote ${masters.length} master's programmes with ${entries} programmes' requirements to ${env.OUT_FILE}`);
}

if (import.meta.main) await main();
