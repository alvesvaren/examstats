/**
 * Every word the site shows in English. The Swedish messages have the same shape. The build imports this file for page
 * titles and link previews, so imports use relative paths.
 */
import { partLabel } from "../../domain/catalog.ts";
import { RECENT_YEARS } from "../../domain/course-stats.ts";
import { ANSWER_SCALE, BALANCED_WORKLOAD, EVALUATION_YEARS, RATING_YEARS, type Question } from "../../domain/evaluation.ts";
import type { Requirement, Theme } from "../../domain/programme-plans.ts";
import type { TrendPoint } from "../../domain/evaluation.ts";
import type { Spread } from "../../domain/spread.ts";
import { FORMATS, periodsWith } from "../format.ts";

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

export const en = {
  format: f,
  credits,
  courses,
  periods: periodsWith({ LP1: "LP1", LP2: "LP2", LP3: "LP3", LP4: "LP4", Summer: "Summer", Other: "Outside study periods" }),
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
    toggleTheme: "Toggle dark mode",
    backToTop: "Back to top",
    dataFrom: "Data from",
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
    programme: "Programme",
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
    track: "Track",
    allTracks: "All tracks",

    chooseMaster: "Choose your master's programme",
    mastersIntro: (count: number, programme: string) =>
      `${counted(count, "master's programme", "master's programmes")} complete ${programme} as years 4 and 5. Pass rate and rating are the mean over each one's courses with results.`,
    tracks: (count: number) => counted(count, "track", "tracks"),
    compulsoryCredits: (value: number) => `${credits(value)} compulsory`,
    nothingCompulsory: "Nothing compulsory for all",
    electives: (count: number) => counted(count, "elective", "electives"),
    compulsory: (names: readonly string[]) => `Compulsory: ${names.join(", ")}`,
    courseList: "Course list",
    specialisations: (names: readonly string[]) => `Gives your degree only with the specialisation ${f.either(names)}`,
    mastersOnChalmers: "Master's programmes on chalmers.se",
    accreditationMatrix: "Accreditation matrix",
    mastersNotPublished: (year: string, shown: string) =>
      `Chalmers has not published the master's programmes of ${year} yet. Until it does, these are the ones of ${shown}, and the programmes on offer can change.`,
    upcomingMasters: (year: string, announced: string, shown: string) =>
      `Chalmers has not published the plans of the master's programmes of ${year} yet. Until it does, these are the ones its accreditation matrix lists for ${announced}${announced === year ? "" : ", the newest year it has announced"}. Their courses are the ones on each programme's course list that run in ${shown}, in the study periods they run in now. The programmes, their courses and when they run can change.`,
    unplanned: (master: string, names: readonly string[], shown: string) =>
      `The course list of ${master} also names ${names.join(", ")}. They are new or not given in ${shown}, so the plan has no study periods for them.`,

    noCoursesThisYear: "The plan has no courses for this year.",
    yourYear: "Your year",
    inYourYear: (value: number) => `${credits(value)} in your year`,
    clearPicks: "Clear my picks",
    toChooseFrom: (count: number) => `${f.count(count)} to choose from`,
    allInYear: "Every course in this study period is already in your year.",
    noCoursesInPeriod: "The plan has no courses in this study period.",
    sameLectures: (name: string, compulsory: boolean) => `Same lecture times as ${name}${compulsory ? ", which is compulsory" : ""}`,
    exclusive: (name: string) => `Only one of this and ${name} counts towards the degree`,
    shareLectures: "Two of these share lecture times",
    roomFor: (value: number) => `Room for ${credits(value)}`,
    remove: (name: string) => `Remove ${name}`,
    pickAtLeast: (amount: string) => `Pick at least ${amount} of the marked courses.`,
    pickSome: "Choose some of the marked courses. The programme's course list does not say how many.",
    themes: THEMES,
    themeCredits: "Theme credits for the degree",
    courseForDegree: (code: string, offered: boolean) => `${code} for the degree${offered ? "" : ", not in this plan"}`,
    someOfMarked: (count: number) => `${count === 1 ? "One" : f.count(count)} of the marked courses for the degree`,
    oneOfDegree: "One of the courses the degree needs",
    creditsIn: (total: number, here: number, period: string) => `${credits(total)}, ${f.number(here)} in ${period}`,
    block: (block: string) => `block ${block}`,
    seats: (value: number) => counted(value, "seat", "seats"),
    inOtherYear: (name: string, year: number) => `${name} is in year ${year}`,
    removeFromYear: (name: string) => `Remove ${name} from your year`,
    addToYear: (name: string) => `Add ${name} to your year`,
    runs: (periods: string) => `Runs ${periods}`,
    elsewhereInYear: (year: number, periods: string) => `In year ${year} in ${periods}.`,
    elsewhereInThisYear: (periods: string) => `In your year in ${periods}. Adding it here moves it.`,
  },
};

export type Messages = typeof en;
