/**
 * The link preview image of a course page, at `/api/og?code=<code>`. The page's HTML adds a `v` parameter that changes
 * with each build, so caches keep an image for as long as its URL is in use.
 *
 * Satori draws the image and supports a subset of CSS: every element with more than one child needs `display: flex`,
 * and colours cannot read the theme's CSS variables. The components live in this file because Vercel's file tracing
 * follows imports of `.ts` files but not of `.tsx` files.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import type { ReactNode } from "react";
import { z } from "zod";
import { toCatalogCourse } from "../src/domain/catalog.ts";
import { RECENT_YEARS } from "../src/domain/course-stats.ts";
import { attemptsOf, GRADES } from "../src/domain/grades.ts";
import { snapshotSchema, type CourseSummary } from "../src/domain/snapshot.ts";
import { ANSWER_SCALE, answerFrequencies } from "../src/domain/evaluation.ts";
import type { Frequencies } from "../src/domain/spread.ts";
import { distributionMark } from "../src/lib/distribution-mark.ts";
import { formatPercent, formatScore } from "../src/lib/format.ts";
import { GRADE_COLOURS } from "../src/lib/grade-colours.ts";
import { COURSE_IMAGE_SIZE } from "../src/lib/page-meta.ts";

const FOREGROUND_RGB = "10, 10, 10";
const FOREGROUND = `rgb(${FOREGROUND_RGB})`;
const MUTED = "#737373";
const TRACK = `rgba(${FOREGROUND_RGB}, 0.1)`;

const PADDING = 72;
const COLUMN_GAP = 96;
const BAR_HEIGHT = 40;
const BAR_RADIUS = 8;
const TICK_WIDTH = 6;
const TICK_OVERHANG = 8;
/** Grades with a smaller share than this leave out their letter, so letters never crowd each other. */
const MIN_LABELLED_SHARE = 0.06;

const labelStyle = { display: "flex", height: 36, fontSize: 28, fontWeight: 600 } as const;

/** Grade distribution as one bar, U first, with each grade's letter below its segment. */
function GradeBar({ grades }: { grades: CourseSummary["recentGrades"] }) {
  const total = attemptsOf(grades);
  const present = GRADES.filter((grade) => grades[grade] > 0);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {present.map((grade) => (
        <div key={grade} style={{ display: "flex", flexDirection: "column", gap: 10, flexGrow: grades[grade], flexBasis: 0, minWidth: 0 }}>
          <div style={{ height: BAR_HEIGHT, borderRadius: BAR_RADIUS, backgroundColor: GRADE_COLOURS[grade] }} />
          <span style={{ ...labelStyle, justifyContent: "center" }}>{grades[grade] / total >= MIN_LABELLED_SHARE ? grade : ""}</span>
        </div>
      ))}
    </div>
  );
}

/** The course page's distribution mark, with `rgba` in place of `color-mix`, which Satori cannot draw. */
function DistributionMark({ frequencies, min, max }: { frequencies: Frequencies; min: number; max: number }) {
  const { stops, median } = distributionMark(frequencies, min, max);
  const gradient = stops.map(({ at, shade }) => `rgba(${FOREGROUND_RGB}, ${shade}) ${at}%`);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          position: "relative",
          height: BAR_HEIGHT,
          borderRadius: BAR_RADIUS,
          backgroundColor: TRACK,
          backgroundImage: `linear-gradient(to right, ${gradient.join(", ")})`,
        }}
      >
        {median !== null && (
          <div
            style={{
              position: "absolute",
              top: -TICK_OVERHANG,
              bottom: -TICK_OVERHANG,
              left: `${median}%`,
              marginLeft: -TICK_WIDTH / 2,
              width: TICK_WIDTH,
              borderRadius: TICK_WIDTH / 2,
              backgroundColor: FOREGROUND,
            }}
          />
        )}
      </div>
      <div style={{ ...labelStyle, color: MUTED }}>
        {frequencies.map(([value]) => (
          <span key={value} style={{ flexGrow: 1, flexBasis: 0, justifyContent: "center" }}>
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

interface MetricProps {
  label: string;
  value: string;
  unit?: string;
  /** Drawn below the value, or null to say why there is no value. */
  chart: ReactNode;
  missing: string;
}

/** One headline number over the chart it comes from. */
function Metric({ label, value, unit, chart, missing }: MetricProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, flexBasis: 0 }}>
      <span style={{ fontSize: 30, color: MUTED }}>{label}</span>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 24 }}>
        <span style={{ fontSize: 112, fontWeight: 600, letterSpacing: -4, lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontSize: 44, color: MUTED, lineHeight: 1, marginBottom: 4 }}>{unit}</span>}
      </div>
      {chart ?? <span style={{ fontSize: 28, color: MUTED }}>{missing}</span>}
    </div>
  );
}

interface CourseImageProps {
  course: CourseSummary;
  programme: string | null;
  /** The site icon as a data URL. */
  icon: string;
}

/**
 * What a shared link most needs to answer: how hard the course is and what students think of it. The link preview's
 * text carries the other numbers.
 */
export function CourseImage({ course, programme, icon }: CourseImageProps) {
  const { code, name, recentGrades, overallAnswers, passRate, rating } = toCatalogCourse(course);
  return (
    <div
      style={{
        ...COURSE_IMAGE_SIZE,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: PADDING,
        backgroundColor: "white",
        color: FOREGROUND,
        fontFamily: "Geist",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, color: MUTED }}>
          <img src={icon} width={40} height={40} />
          <span>{[code, programme].filter(Boolean).join(" · ")}</span>
        </div>
        <span style={{ display: "block", fontSize: 64, fontWeight: 600, letterSpacing: -2, lineHeight: 1.1, lineClamp: 2 }}>{name}</span>
      </div>

      <div style={{ display: "flex", gap: COLUMN_GAP }}>
        <Metric
          label={`Pass rate, last ${RECENT_YEARS} years`}
          value={formatPercent(passRate)}
          chart={passRate === null ? null : <GradeBar grades={recentGrades} />}
          missing="No recent exam results"
        />
        <Metric
          label="Student rating"
          value={formatScore(rating)}
          unit={rating === null ? undefined : `/ ${ANSWER_SCALE.max}`}
          chart={overallAnswers && <DistributionMark frequencies={answerFrequencies(overallAnswers)} {...ANSWER_SCALE} />}
          missing="Too few survey answers"
        />
      </div>
    </div>
  );
}

/** Files the function reads at run time. `includeFiles` in vercel.json must match them. */
const FILES = {
  snapshot: "public/data/index.json",
  icon: "public/favicon.svg",
  /** Satori needs WOFF or TTF, so the static Geist files rather than the variable WOFF2 the site uses. */
  regular: "node_modules/@fontsource/geist/files/geist-latin-400-normal.woff",
  semibold: "node_modules/@fontsource/geist/files/geist-latin-600-normal.woff",
};

const CACHE_FOREVER = "public, max-age=31536000, s-maxage=31536000, immutable";

const read = (file: string) => readFile(path.join(process.cwd(), file));

async function load() {
  const [snapshot, icon, regular, semibold] = await Promise.all([
    read(FILES.snapshot),
    read(FILES.icon),
    read(FILES.regular),
    read(FILES.semibold),
  ]);
  return {
    snapshot: snapshotSchema.parse(JSON.parse(snapshot.toString())),
    icon: `data:image/svg+xml;base64,${icon.toString("base64")}`,
    fonts: [
      { name: "Geist", data: regular, weight: 400 as const },
      { name: "Geist", data: semibold, weight: 600 as const },
    ],
  };
}

/** Loaded on the first request, then kept for the life of the instance. Each deploy starts new instances. */
let loaded: ReturnType<typeof load> | undefined;

/** The source names a few programmes "-". Those show their code instead. */
const PLACEHOLDER_NAME = "-";
function programmeName(programmes: Record<string, string>, code: string) {
  const name = programmes[code];
  return name && name !== PLACEHOLDER_NAME ? name : code;
}

const querySchema = z.object({ code: z.string() });

export async function GET(request: Request) {
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return new Response("Missing course code", { status: 400 });
  const { snapshot, icon, fonts } = await (loaded ??= load());
  const course = snapshot.courses.find((c) => c.code === query.data.code);
  if (!course) return new Response("No such course", { status: 404 });
  const programme = course.programme && programmeName(snapshot.programmes, course.programme);
  const svg = await satori(<CourseImage course={course} programme={programme} icon={icon} />, { ...COURSE_IMAGE_SIZE, fonts });
  const png = new Resvg(svg).render().asPng();
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": CACHE_FOREVER } });
}
