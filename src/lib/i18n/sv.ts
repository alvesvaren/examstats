/** Every word the site shows in Swedish, in the shape of the English messages. */
import { RECENT_YEARS } from "@/domain/course-stats";
import { ANSWER_SCALE, BALANCED_WORKLOAD, EVALUATION_YEARS, RATING_YEARS, type Question } from "@/domain/evaluation";
import type { Requirement, Theme } from "@/domain/programme-plans";
import { FORMATS, periodsWith } from "@/lib/format";
import type { Messages } from "./en";

const f = FORMATS.sv;

const credits = (value: number) => `${f.credits(value)} hp`;
const counted = (value: number, one: string, many: string) => `${f.count(value)} ${f.isOne(value) ? one : many}`;
const courses = (value: number) => counted(value, "kurs", "kurser");

const RECENT = `ordinarie tentan under de senaste ${RECENT_YEARS} läsåren med resultat`;
const SURVEY_SOURCE = `i Chalmers kursenkäter, från ${ANSWER_SCALE.min} till ${ANSWER_SCALE.max}, under de senaste ${RATING_YEARS} läsåren`;
const SPREAD_HELP = "Ju mörkare ett värde är i markeringen, desto större andel av svaren. Strecket är medianen.";

const QUESTIONS = {
  overall: { label: "Helhetsintryck", short: "Omdöme" },
  teaching: { label: "Undervisning", short: "Undervisning" },
  structure: { label: "Kursens upplägg", short: "Upplägg" },
  literature: { label: "Kursmaterial", short: "Material" },
  assessment: { label: "Examination", short: "Examination" },
  administration: { label: "Administration", short: "Admin" },
  learningOutcomes: { label: "Tydliga lärandemål", short: "Lärandemål" },
  prerequisites: { label: "Tillräckliga förkunskaper", short: "Förkunskaper" },
  workload: { label: "Arbetsbelastning", short: "Belastning" },
} satisfies Record<Question, { label: string; short: string }>;

const THEMES = {
  mts: { short: "MTS", name: "Människa, teknik och samhälle" },
  environment: { short: "Miljö", name: "Miljö och hållbar utveckling" },
} satisfies Record<Theme, { short: string; name: string }>;

const REQUIREMENTS: Partial<Record<Requirement["kind"], string>> = {
  compulsory: "Obligatorisk",
  compulsoryElective: "Obligatoriskt valbar",
  elective: "Valbar",
};

const HINTS: Partial<Record<Question, string>> = { overall: QUESTIONS.overall.short, workload: `${ANSWER_SCALE.max} är för hög` };

export const sv: Messages = {
  format: f,
  credits,
  courses,
  periods: periodsWith({ LP1: "LP1", LP2: "LP2", LP3: "LP3", LP4: "LP4", Summer: "Sommar", Other: "Utanför läsperioderna" }),
  of: (have, total) => `${have} av ${total}`,
  spread: ({ mean, median, sd }) => `Medel ${f.number(mean)} · median ${f.number(median)} · std.avv. ${f.number(sd)}`,
  medianAndSd: (median, sd) => `Median ${f.number(median)} · std.avv. ${f.number(sd)}`,
  attempts: (value) => counted(value, "försök", "försök"),
  // Chalmers names the rules in English: F for voluntary courses and X for a thesis.
  ruleNames: (chalmers) => ({ ...chalmers, F: "Frivillig", X: "Examensarbete" }),
  requirement: ({ kind, label }) => REQUIREMENTS[kind] ?? label,
  // Chalmers names the parts in Swedish.
  part: (type) => type,
  allCourses: "Alla kurser",
  allProgrammes: "Alla program",
  noResultsYet: "Inga resultat än",
  chalmers: {
    syllabus: (code) =>
      `https://www.chalmers.se/utbildning/dina-studier/hitta-kurs-och-programplaner/kursplaner/${encodeURIComponent(code)}/`,
    programme: (code) =>
      `https://www.chalmers.se/utbildning/dina-studier/hitta-kurs-och-programplaner/programplaner/${encodeURIComponent(code)}/`,
    surveys: "https://www.chalmers.se/utbildning/dina-studier/planera-och-genomfora-studier/kursvardering/",
    masters: "https://www.chalmers.se/utbildning/hitta-masterprogram/",
  },

  layout: {
    siteHeading: "Tentaresultat på Chalmers",
    planner: "Planerare",
    plannerHeading: "Kursplanerare",
    language: "Språk",
    theme: "Tema",
    themes: { light: "Ljust", dark: "Mörkt", system: "System" },
    backToTop: "Till toppen",
    dataFrom: "Data från",
    surveys: "Chalmers kursutvärderingar",
    and: "och",
    loadError: "Kunde inte ladda datan",
    somethingWrong: "Något gick fel.",
    tryAgain: "Försök igen",
    noSuchCourse: "Kursen finns inte",
    noSuchPage: "Sidan finns inte",
  },

  metrics: {
    about: (name) => `Om ${name}`,
    help: {
      passRate: `Andel av försöken som blev godkända på ${RECENT}. En omtenta räknas som ett nytt försök.`,
      averageGrade: `Medelvärdet av betygen 3, 4 och 5 på ${RECENT}. Underkända räknas inte.`,
      attemptsPerYear: `Försök per år på ${RECENT}.`,
      trend: `Studenternas helhetsintryck av kursen per läsår i Chalmers kursenkäter, från ${ANSWER_SCALE.min} till ${ANSWER_SCALE.max}, under de senaste ${EVALUATION_YEARS} läsåren. Sorteringen jämför det senaste läsåret med åren före.`,
      rating: `Studenternas helhetsintryck av kursen ${SURVEY_SOURCE}, räknat över alla svar. ${SPREAD_HELP}`,
    },
    recent: `Ordinarie tenta, senaste ${RECENT_YEARS} åren`,
    trend: ([firstYear, firstRating], [lastYear, lastRating]) =>
      `Helhetsintryck ${f.score(firstRating)} läsåret ${f.academicYear(firstYear)}, ${f.score(lastRating)} läsåret ${f.academicYear(lastYear)}`,
  },

  survey: {
    title: "Kursenkät",
    questions: QUESTIONS,
    window: (question) => `${QUESTIONS[question].label}, senaste ${RATING_YEARS} åren`,
    choose: "Välj fråga ur kursenkäten",
    meanAnswer: `Medelsvar ${SURVEY_SOURCE}. ${SPREAD_HELP}`,
    hints: HINTS,
    workloadScale: `${ANSWER_SCALE.min} för låg, ${BALANCED_WORKLOAD} lagom, ${ANSWER_SCALE.max} för hög`,
    none: `Inga kursenkäter under de senaste ${RATING_YEARS} läsåren.`,
    source: { before: "Från ", link: "Chalmers kursenkäter", after: (day) => `, hämtade ${day}.` },
    rounds: (count) => `alla ${f.count(count)} omgångar`,
    answered: (answers, respondents) => `${f.count(answers)} av ${f.count(respondents)} svarade`,
    answers: (count) => counted(count, "svar", "svar"),
    tooFewAnswers: "För få svar",
    veryPoor: "Mycket dåligt",
    excellent: "Utmärkt",
    columns: { round: "Omgång", overall: "Helhet", answers: "Svar", minutes: "Protokoll" },
    allRounds: "Alla omgångar",
  },

  list: {
    searchPlaceholder: "Kurs, program eller examinator, ; för flera",
    search: "Sök",
    programme: "Program",
    examinerOf: (courseCount) => `Examinator för ${courses(courseCount)}`,
    examinerOfIn: (courseCount, academicYear) => `Examinator för ${courses(courseCount)} ${academicYear}`,
    runsIn: (academicYear) => `Går i läsperioden ${academicYear}`,
    noMatch: "Inga kurser matchar.",
    ended: "Nedlagda kurser",
    columns: {
      name: "Kurs",
      programme: "Program",
      attemptsPerYear: "Försök",
      passRate: "Godkända",
      averageGrade: "Betyg",
      trend: "Trend",
      lastResult: "Senaste tenta",
    },
  },

  course: {
    back: "Tillbaka",
    ended: "Nedlagd",
    syllabus: "Kursplan",
    noResults: "Inga resultat.",
    passRate: "Andel godkända",
    averageGrade: "Medelbetyg",
    attemptsPerYear: "Försök per år",
    seatsIn: (rounds) => f.list(rounds.map(({ seats, periods }) => `${counted(seats, "plats", "platser")} i ${periods}`)),
    latestExam: "Senaste tentan",
    allGrades: (attemptCount) => `Betyg, alla ${f.count(attemptCount)} försök`,
    otherParts: "Andra delar",
    otherInstances: "Samma kurs under andra koder",
    examiners: (academicYear) => `Examinatorer ${academicYear}`,
    programmeYears: (name, years) => `${name}, år ${f.list(years.map(String))}`,
    sittings: (count, from, to) => `${f.count(count)} tentatillfällen från ${f.day(from)} till ${f.day(to)}`,
    passed: (rate) => `${f.percent(rate)} godkända`,
  },

  planner: {
    findProgramme: "Hitta ditt program för att planera ett år med kurser.",
    searchPlaceholder: "Program, till exempel Informationsteknik eller TKITE",
    searchProgrammes: "Sök program",
    noProgrammeMatches: "Inget program matchar.",
    noCourses: "Kursplaneraren har inga kurser för det här programmet än.",
    mastersYears: "År 4 och 5:",
    prerequisites: "Förkunskapskrav",
    prerequisitesOf: (code) => `Förkunskapskrav för ${code}`,
    startYear: "Året du började programmet",
    started: (academicYear) => `Började ${academicYear}`,
    yearOfStudy: "Årskurs",
    year: (number) => `År ${number}`,
    changeMaster: "Byt master",
    addMaster: "Lägg till master",
    track: "Inriktning",
    allTracks: "Alla inriktningar",

    chooseMaster: "Välj ditt masterprogram",
    mastersIntro: (count, programme) =>
      `${counted(count, "masterprogram", "masterprogram")} kan bli år 4 och 5 i ${programme}. Andel godkända och omdöme är medelvärdet över varje programs kurser med resultat.`,
    tracks: (count) => counted(count, "inriktning", "inriktningar"),
    compulsoryCredits: (value) => `${credits(value)} obligatoriskt`,
    nothingCompulsory: "Inget obligatoriskt för alla",
    electives: (count) => counted(count, "valbar kurs", "valbara kurser"),
    compulsory: (names) => `Obligatoriskt: ${names.join(", ")}`,
    courseList: "Kurslista",
    specialisations: (names) => `Ger din examen bara med inriktningen ${f.either(names)}`,
    mastersOnChalmers: "Masterprogram på chalmers.se",
    accreditationMatrix: "Ackrediteringsmatris",
    mastersNotPublished: (year, shown) =>
      `Chalmers har inte publicerat masterprogrammen för ${year} än. Tills dess visas de för ${shown}, och vilka program som ges kan ändras.`,
    upcomingMasters: (year, announced, shown) =>
      `Chalmers har inte publicerat planerna för masterprogrammen ${year} än. Tills dess visas de som ackrediteringsmatrisen listar för ${announced}${announced === year ? "" : ", det senaste år den har annonserat"}. Kurserna är de på varje programs kurslista som ges ${shown}, i de läsperioder de går i nu. Programmen, deras kurser och när de går kan ändras.`,
    unplanned: (master, names, shown) =>
      `Kurslistan för ${master} nämner också ${names.join(", ")}. De är nya eller ges inte ${shown}, så planen har inga läsperioder för dem.`,

    noCoursesThisYear: "Planen har inga kurser för det här året.",
    yourYear: "Ditt år",
    inYourYear: (value) => `${credits(value)} i ditt år`,
    clearPicks: "Rensa mina val",
    toChooseFrom: (count) => `${f.count(count)} att välja bland`,
    allInYear: "Alla kurser i den här läsperioden finns redan i ditt år.",
    noCoursesInPeriod: "Planen har inga kurser i den här läsperioden.",
    sameLectures: (name, compulsory) => `Samma föreläsningstider som ${name}${compulsory ? ", som är obligatorisk" : ""}`,
    exclusive: (name) => `Bara en av den här och ${name} räknas till examen`,
    shareLectures: "Två av dessa har samma föreläsningstider",
    roomFor: (value) => `Plats för ${credits(value)}`,
    remove: (name) => `Ta bort ${name}`,
    pickAtLeast: (amount) => `Välj minst ${amount} av de markerade kurserna.`,
    pickSome: "Välj några av de markerade kurserna. Programmets kurslista säger inte hur många.",
    themes: THEMES,
    themeCredits: "Temapoäng för examen",
    courseForDegree: (code, offered) => `${code} för examen${offered ? "" : ", finns inte i den här planen"}`,
    someOfMarked: (count) => `${count === 1 ? "En" : f.count(count)} av de markerade kurserna för examen`,
    oneOfDegree: "En av kurserna som examen kräver",
    creditsIn: (total, here, period) => `${credits(total)}, ${f.number(here)} i ${period}`,
    block: (block) => `block ${block}`,
    seats: (value) => counted(value, "plats", "platser"),
    inOtherYear: (name, year) => `${name} finns i år ${year}`,
    removeFromYear: (name) => `Ta bort ${name} från ditt år`,
    addToYear: (name) => `Lägg till ${name} i ditt år`,
    runs: (periods) => `Går ${periods}`,
    elsewhereInYear: (year, periods) => `I år ${year} i ${periods}.`,
    elsewhereInThisYear: (periods) => `I ditt år i ${periods}. Lägger du till den här flyttas den.`,
  },
};
