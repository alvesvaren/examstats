/**
 * Every word the site shows in English. The Swedish messages have the same shape. The build imports this file for page
 * titles and link previews, so imports use relative paths.
 */
import { RECENT_YEARS } from "../../domain/course-stats.ts";
import { ANSWER_SCALE, BALANCED_WORKLOAD, EVALUATION_YEARS, RATING_YEARS, type Question } from "../../domain/evaluation.ts";
import type { Requirement, StudyPeriod, Theme, TrackKind } from "../../domain/programme-plans.ts";
import type { TrendPoint } from "../../domain/evaluation.ts";
import type { Spread } from "../../domain/spread.ts";
import { FORMATS, periodsWith } from "../format.ts";
import { partLabel } from "./part-label.ts";

const f = FORMATS.en;

const credits = (value: number) => `${f.credits(value)} credits`;
const counted = (value: number, one: string, many: string) => `${f.count(value)} ${f.isOne(value) ? one : many}`;
const courses = (value: number) => counted(value, "course", "courses");

const RECENT = `the main exam over the last ${RECENT_YEARS} academic years with results`;
const SURVEY_SOURCE = `in Chalmers course surveys, from ${ANSWER_SCALE.min} to ${ANSWER_SCALE.max}, over the last ${RATING_YEARS} academic years`;
const SPREAD_HELP = "In the mark, the darker a value, the larger its share of answers. The tick is the median.";

const QUESTIONS = {
  overall: { label: "Overall impression", short: "Rating" },
  teaching: { label: "Teaching", short: "Teaching" },
  structure: { label: "Course structure", short: "Structure" },
  literature: { label: "Course material", short: "Material" },
  assessment: { label: "Assessment", short: "Assessment" },
  administration: { label: "Administration", short: "Admin" },
  learningOutcomes: { label: "Clear learning outcomes", short: "Outcomes" },
  prerequisites: { label: "Enough prior knowledge", short: "Prereqs" },
  workload: { label: "Workload", short: "Workload" },
} satisfies Record<Question, { label: string; short: string }>;

const THEMES = {
  mts: { short: "MTS", name: "Human, technology and society" },
  environment: { short: "Environment", name: "Environment and sustainable development" },
} satisfies Record<Theme, { short: string; name: string }>;

const REQUIREMENTS: Partial<Record<Requirement["kind"], string>> = {
  compulsory: "Compulsory",
  compulsoryElective: "Compulsory elective",
  elective: "Elective",
};

const HINTS: Partial<Record<Question, string>> = { overall: QUESTIONS.overall.short, workload: `${ANSWER_SCALE.max} is too high` };

/** The planner's lane of courses whose study periods are not known yet. */
const NOT_SCHEDULED = "Not scheduled";

/** The words for each kind of track. */
const TRACKS = {
  specialisation: { label: "Specialisation", one: "specialisation", many: "specialisations" },
  concentration: { label: "Concentration", one: "concentration", many: "concentrations" },
} satisfies Record<TrackKind, { label: string; one: string; many: string }>;

const formatPeriods = periodsWith({ LP1: "LP1", LP2: "LP2", LP3: "LP3", LP4: "LP4", Summer: "Summer", Other: "Outside study periods" });

export const en = {
  format: f,
  credits,
  courses,
  periods: formatPeriods,
  /** "3 of 15 credits". */
  of: (have: string, total: string) => `${have} of ${total}`,
  spread: ({ mean, median, sd }: Pick<Spread, "mean" | "median" | "sd">) =>
    `Mean ${f.number(mean)} · median ${f.number(median)} · SD ${f.number(sd)}`,
  medianAndSd: (median: number, sd: number) => `Median ${f.number(median)} · SD ${f.number(sd)}`,
  attempts: (value: number) => counted(value, "attempt", "attempts"),
  /** Chalmers' name of each rule code, which labels the rules that have no label of their own, such as a thesis. */
  ruleNames: (chalmers: Readonly<Record<string, string>>): Readonly<Record<string, string>> => chalmers,
  /** How much a plan asks of a student for a course. Other rules, such as a thesis, take their name from `ruleNames`. */
  requirement: ({ kind, label }: Requirement) => REQUIREMENTS[kind] ?? label,
  part: partLabel,
  allCourses: "All courses",
  allProgrammes: "All programmes",
  noResultsYet: "No results yet",
  newCourse: "New course",
  /** A course without results, which links to chalmers.se instead of a page here. */
  onChalmers: (course: string) => `${course} on chalmers.se`,
  chalmers: {
    syllabus: (code: string) =>
      `https://www.chalmers.se/en/education/your-studies/find-course-and-programme-syllabi/course-syllabus/${encodeURIComponent(code)}/`,
    programme: (code: string) =>
      `https://www.chalmers.se/en/education/your-studies/find-course-and-programme-syllabi/programme-overview/${encodeURIComponent(code)}/`,
    surveys: "https://www.chalmers.se/en/education/your-studies/plan-and-conduct-your-studies/course-evaluation/",
    masters: "https://www.chalmers.se/en/education/find-masters-programme/",
  },

  layout: {
    siteHeading: "Chalmers exam results",
    planner: "Planner",
    plannerHeading: "Course planner",
    language: "Language",
    theme: "Theme",
    themes: { light: "Light", dark: "Dark", system: "System" },
    backToTop: "Back to top",
    dataFrom: "Data from",
    surveys: "Chalmers course surveys",
    and: "and",
    loadError: "Could not load the data",
    somethingWrong: "Something went wrong.",
    tryAgain: "Try again",
    noSuchCourse: "No such course",
    noSuchPage: "No such page",
  },

  metrics: {
    about: (name: string) => `About ${name}`,
    help: {
      passRate: `Share of attempts that passed ${RECENT}. A retake counts as a new attempt.`,
      averageGrade: `Mean of grades 3, 4 and 5 on ${RECENT}. Fails are left out.`,
      attemptsPerYear: `Attempts per year on ${RECENT}.`,
      trend: `Students' overall impression of the course per academic year in Chalmers course surveys, from ${ANSWER_SCALE.min} to ${ANSWER_SCALE.max}, over the last ${EVALUATION_YEARS} academic years. Sorting compares the last year with the years before it.`,
      rating: `Students' overall impression of the course ${SURVEY_SOURCE}, counting every answer. ${SPREAD_HELP}`,
    },
    recent: `Main exam, last ${RECENT_YEARS} years`,
    trend: ([firstYear, firstRating]: TrendPoint, [lastYear, lastRating]: TrendPoint) =>
      `Rating ${f.score(firstRating)} in ${f.academicYear(firstYear)}, ${f.score(lastRating)} in ${f.academicYear(lastYear)}`,
  },

  survey: {
    title: "Course survey",
    questions: QUESTIONS,
    /** The question and the years its answers are pooled over, shown above them on hover. */
    window: (question: Question) => `${QUESTIONS[question].label}, last ${RATING_YEARS} years`,
    choose: "Choose the course survey question",
    meanAnswer: `Mean answer ${SURVEY_SOURCE}. ${SPREAD_HELP}`,
    hints: HINTS,
    workloadScale: `${ANSWER_SCALE.min} too low, ${BALANCED_WORKLOAD} balanced, ${ANSWER_SCALE.max} too high`,
    none: `No course surveys in the last ${RATING_YEARS} academic years.`,
    source: { before: "From ", link: "Chalmers course surveys", after: (day: string) => `, fetched ${day}.` },
    rounds: (count: number) => `all ${f.count(count)} rounds`,
    answered: (answers: number, respondents: number) => `${f.count(answers)} of ${f.count(respondents)} answered`,
    answers: (count: number) => counted(count, "answer", "answers"),
    tooFewAnswers: "Too few answers",
    veryPoor: "Very poor",
    excellent: "Excellent",
    columns: { round: "Round", overall: "Overall", answers: "Answers", minutes: "Minutes" },
    allRounds: "All rounds",
  },

  list: {
    searchPlaceholder: "Course, programme or examiner, use ; for several",
    search: "Search",
    examinerOf: (courseCount: number) => `Examiner of ${courses(courseCount)}`,
    examinerOfIn: (courseCount: number, academicYear: string) => `Examiner of ${courses(courseCount)} in ${academicYear}`,
    runsIn: (academicYear: string) => `Runs in the study period in ${academicYear}`,
    noMatch: "No courses match.",
    ended: "Ended courses",
    columns: {
      name: "Course",
      programme: "Programme",
      attemptsPerYear: "Attempts",
      passRate: "Pass rate",
      averageGrade: "Grade",
      trend: "Trend",
      lastResult: "Last exam",
    },
  },

  course: {
    back: "Back",
    ended: "Ended",
    syllabus: "Course syllabus",
    noResults: "No results.",
    passRate: "Pass rate",
    averageGrade: "Average grade",
    attemptsPerYear: "Attempts per year",
    /** "185 seats in LP2 and 165 seats in LP3", or nothing without rounds. */
    seatsIn: (rounds: readonly { seats: number; periods: string }[]) =>
      f.list(rounds.map(({ seats, periods }) => `${counted(seats, "seat", "seats")} in ${periods}`)),
    latestExam: "Latest exam",
    allGrades: (attemptCount: number) => `Grades, all ${f.count(attemptCount)} attempts`,
    otherParts: "Other parts",
    otherInstances: "Other instances",
    examiners: (academicYear: string) => `Examiners ${academicYear}`,
    programmeYears: (name: string, years: readonly number[]) =>
      `${name}, ${years.length > 1 ? "years" : "year"} ${f.list(years.map(String))}`,
    sittings: (count: number, from: string, to: string) => `${f.count(count)} sittings from ${f.day(from)} to ${f.day(to)}`,
    passed: (rate: number | null) => `${f.percent(rate)} passed`,
  },

  planner: {
    findProgramme: "Find your programme to plan a year of courses.",
    searchPlaceholder: "Programme, such as Software Engineering or TKITE",
    searchProgrammes: "Search programmes",
    noProgrammeMatches: "No programme matches.",
    noCourses: "The course planner has no courses for this programme yet.",
    mastersYears: "Years 4 and 5:",
    prerequisites: "Prerequisites",
    prerequisitesOf: (code: string) => `Prerequisites of ${code}`,
    startYear: "Year you started the programme",
    started: (academicYear: string) => `Started ${academicYear}`,
    yearOfStudy: "Year of study",
    year: (number: number) => `Year ${number}`,
    changeMaster: "Change master",
    addMaster: "Add master",
    chooseStart: "When did you start the programme?",
    chooseStartHint: "The plan of the year you started decides your courses and when they run.",
    trackLabel: (kind: TrackKind) => TRACKS[kind].label,
    noTrack: (kind: TrackKind) => `No ${TRACKS[kind].one}`,
    chooseTrack: (kind: TrackKind) => `Which ${TRACKS[kind].one} do you follow?`,
    chooseTrackHint: (kind: TrackKind, plan: string) =>
      `${plan} has ${TRACKS[kind].many} with courses of their own. You can change it later.`,
    everyTrack: "Shows the courses of all of them",
    /** Marks a specialisation that the master's programme does not give the student's degree with. */
    withoutDegree: "Not for your degree",

    chooseMaster: "Choose your master's programme",
    mastersIntro: (count: number, programme: string) =>
      `${counted(count, "master's programme", "master's programmes")} complete ${programme} as years 4 and 5.`,
    trackCount: (kind: TrackKind, count: number) => counted(count, TRACKS[kind].one, TRACKS[kind].many),
    compulsoryCredits: (value: number) => `${credits(value)} compulsory`,
    nothingCompulsory: "Nothing compulsory for all",
    electives: (count: number) => counted(count, "elective", "electives"),
    compulsory: (names: readonly string[]) => `Compulsory: ${names.join(", ")}`,
    courseList: "Course list",
    specialisations: (names: readonly string[]) => `Gives your degree only with the specialisation ${f.either(names)}`,
    mastersOnChalmers: "Master's programmes on chalmers.se",
    accreditationMatrix: "Accreditation matrix",
    mastersNotPublished: (year: string, shown: string) =>
      `Preliminary: Chalmers has not published the master's programmes of ${year} yet. These are the ones of ${shown}.`,
    upcomingMasters: (year: string, announced: string, shown: string) =>
      `Preliminary: Chalmers has not planned the master's programmes of ${year} yet.${announced === year ? "" : ` These are the ones of ${announced}.`} Courses keep their study periods from ${shown}, and new ones wait under ${NOT_SCHEDULED}.`,

    noCoursesThisYear: "The plan has no courses for this year.",
    yourYear: "Your year",
    inYourYear: (value: number, pending: number) =>
      `${credits(value)} in your year${pending > 0 ? `, and ${courses(pending)} with credits not known yet` : ""}`,
    clearPicks: "Clear my picks",
    toChooseFrom: (count: number) => `${f.count(count)} to choose from`,
    allInYear: "Every course in this study period is already in your year.",
    noCoursesInPeriod: "The plan has no courses in this study period.",
    notScheduled: NOT_SCHEDULED,
    notScheduledHint: "New courses, without study periods or credits yet",
    inProgrammePlan: (name: string) => `${name} is part of the programme plan`,
    creditsNotKnown: "Credits not known yet",
    preliminary: "Preliminary",
    sameLectures: (name: string, compulsory: boolean) => `Same lecture times as ${name}${compulsory ? ", which is compulsory" : ""}`,
    exclusive: (name: string) => `Only one of this and ${name} counts towards the degree`,
    shareLectures: "Two of these share lecture times",
    roomFor: (value: number) => `Room for ${credits(value)}`,
    remove: (name: string) => `Remove ${name}`,
    pickAtLeast: (amount: string) => `Pick at least ${amount} of the marked courses.`,
    pickSome: "Compulsory electives. Chalmers has not said how many yet.",
    themes: THEMES,
    themeCredits: "Theme credits for the degree",
    courseForDegree: (code: string, offered: boolean) => `${code} for the degree${offered ? "" : ", not in this plan"}`,
    someOfMarked: (count: number) => `${count === 1 ? "One" : f.count(count)} of the marked courses for the degree`,
    oneOfDegree: "One of the courses the degree needs",
    oneOfPick: "One of the courses to pick from",
    creditsIn: (total: number, here: number, period: string) => `${credits(total)}, ${f.number(here)} in ${period}`,
    block: (block: string) => `block ${block}`,
    seats: (value: number) => counted(value, "seat", "seats"),
    inOtherYear: (name: string, year: number) => `${name} is in year ${year}`,
    removeFromYear: (name: string) => `Remove ${name} from your year`,
    addToYear: (name: string) => `Add ${name} to your year`,
    runs: (periods: string) => `Runs ${periods}`,
    /** Where a course is picked in another year. A course whose study periods are not known yet is only in the year. */
    elsewhereInYear: (year: number, inPeriods: readonly StudyPeriod[]) =>
      `In year ${year}${inPeriods.length > 0 ? ` in ${formatPeriods(inPeriods)}` : ""}.`,
    elsewhereInThisYear: (periods: string) => `In your year in ${periods}. Adding it here moves it.`,

    admission: {
      heading: "Admission",
      guide: (academicYear: string) => `Chalmers' eligibility guide for ${academicYear}`,
      /** The guide is for an earlier year than the one the student's master's programme starts in. */
      guideEarlier: (year: string) => `The guide for ${year} comes out in October the year before and can differ from this one.`,
      deadline:
        "A course counts if it ends in study period 3 of year 3 at the latest, since admission checks your courses in April. Admission can also accept similar courses.",
      compulsory: (programme: string) => `The compulsory courses of ${programme} meet the entry requirements.`,
      met: "Your courses meet the entry requirements.",
      missing: "For admission you also need",
      regulations: "The admission regulations decide by subjects and credits, as the prerequisites describe.",
      words: "The guide says:",
      /** A line of the guide's requirements that has to be a typo, and what the planner reads it as. */
      corrected: (guide: string, corrected: string) =>
        `The guide writes “${guide}”, which must be a typo. The planner reads it as “${corrected}”.`,
      courseIn: (code: string, years: readonly { year: number; periods: readonly string[] }[]) =>
        `${code} in ${years.map(({ year, periods }) => `year ${year} ${periods.join(", ")}`).join(" and ")}`,
      offeredIn: (places: readonly string[]) => `In your plans: ${places.join(" · ")}`,
      /** Where the plans of years 1 to 3 have a course a requirement names, but only after the application. */
      onlyLate: (places: readonly string[]) => `In your plans only after the application: ${places.join(" · ")}`,
      /** The plan holds every course it can of the requirements, and those left are outside the programme's plans. */
      metInPlans: "Your courses meet every requirement that your programme's plans can meet.",
      outside: "Outside your programme's plans",
      outsideHint: "You can take these courses on top of your plan, or ask admissions whether a course you take is enough.",
      runsIn: (code: string, periods: string) => `${code} runs in ${periods} this year`,
      notThisYear: (code: string) => `${code} does not run this year`,
      late: (code: string, periods: string) => `${code} in ${periods} of year 3 ends after the application`,
      recommended: (names: readonly string[]) => `Recommended: ${f.list(names)}`,
      either: (items: readonly string[]) => f.either(items),
      all: (items: readonly string[]) => f.list(items),
      someOf: (count: number, items: readonly string[]) => `${f.count(count)} of ${items.join("; ")}`,
      summary: {
        compulsory: "Admission: the compulsory courses suffice",
        met: "Admission: your courses meet the requirements",
        missing: (items: readonly string[]) => `Admission also needs ${items.join("; ")}`,
        /** Marks a missing requirement that only a course outside the programme's plans meets. */
        outside: (item: string) => `${item} (outside your plans)`,
        regulations: "Admission: subjects and credits, as the prerequisites say",
        words: "Admission: see Chalmers' eligibility guide",
      },
      rule: {
        course: (label: string, master: string) => `${label} for admission to ${master}`,
        oneOf: (master: string) => `One of the marked courses for admission to ${master}`,
        someOf: (count: number, master: string) => `${f.count(count)} of the marked courses for admission to ${master}`,
        alternatives: (master: string) => `The marked courses of one of the guide's alternatives, for admission to ${master}`,
      },
      mark: (master: string) => `One of the courses for admission to ${master}`,
    },
  },
};

export type Messages = typeof en;
