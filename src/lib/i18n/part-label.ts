const PART_WORDS: readonly [sv: string, en: string][] = [
  ["Muntlig tentamen", "Oral exam"],
  ["Hemtentamen", "Take-home exam"],
  ["Tentamen", "Exam"],
  ["Laborationer", "Labs"],
  ["Laboration", "Lab"],
  ["Projektarbete", "Project"],
  ["Projekt", "Project"],
  ["Inlämningsuppgifter", "Assignments"],
  ["Inlämningsuppgift", "Assignment"],
  ["Examensarbete", "Thesis"],
  ["Duggor", "Quizzes"],
  ["Dugga", "Quiz"],
  ["Övningar", "Exercises"],
  ["Övning", "Exercise"],
  ["Seminarier", "Seminars"],
  ["Seminarium", "Seminar"],
  ["Konstruktionsövning", "Design exercise"],
  ["Kontrollskrivning", "Midterm"],
  ["Förberedande kurs i matematik", "Preparatory maths"],
];

/** English label for a Swedish part type. Unknown types keep their Swedish name. */
export function partLabel(type: string): string {
  const match = PART_WORDS.find(([sv]) => new RegExp(`^${sv}(?=$|[ ,+])`).test(type));
  const translated = match ? match[1] + type.slice(match[0].length) : type;
  return translated.replace(", del ", ", part ");
}
