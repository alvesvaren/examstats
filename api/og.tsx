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
import { GRADES } from "../src/domain/grades.ts";
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
/** Grade distribution as one bar, U first. Like the site's bar, only its outer corners are round. */
function GradeBar({ grades }: { grades: CourseSummary["recentGrades"] }) {
  const present = GRADES.filter((grade) => grades[grade] > 0);
  return (
    <div style={{ display: "flex", gap: 4, overflow: "hidden", borderRadius: BAR_RADIUS }}>
      {present.map((grade) => (
        <div key={grade} style={{ height: BAR_HEIGHT, flexGrow: grades[grade], flexBasis: 0, backgroundColor: GRADE_COLOURS[grade] }} />
      ))}
    </div>
  );
}

/** The course page's distribution mark, with `rgba` in place of `color-mix`, which Satori cannot draw. */
function DistributionMark({ frequencies, min, max }: { frequencies: Frequencies; min: number; max: number }) {
  const { stops, median } = distributionMark(frequencies, min, max);
  const gradient = stops.map(({ at, shade }) => `rgba(${FOREGROUND_RGB}, ${shade}) ${at}%`);
  return (
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
}

/**
 * What a shared link most needs to answer: how hard the course is and what students think of it.
 */
export function CourseImage({ course, programme }: CourseImageProps) {
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
        <span style={{ fontSize: 30 }}>{[code, programme].filter(Boolean).join(" · ")}</span>
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
  /** Satori needs WOFF or TTF, so the static Geist files rather than the variable WOFF2 the site uses. */
  regular: "node_modules/@fontsource/geist/files/geist-latin-400-normal.woff",
  semibold: "node_modules/@fontsource/geist/files/geist-latin-600-normal.woff",
};

const CACHE_FOREVER = "public, max-age=31536000, s-maxage=31536000, immutable";

const read = (file: string) => readFile(path.join(process.cwd(), file));

async function load() {
  const [snapshot, regular, semibold] = await Promise.all([read(FILES.snapshot), read(FILES.regular), read(FILES.semibold)]);
  return {
    snapshot: snapshotSchema.parse(JSON.parse(snapshot.toString())),
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
  const { snapshot, fonts } = await (loaded ??= load());
  const course = snapshot.courses.find((c) => c.code === query.data.code);
  if (!course) return new Response("No such course", { status: 404 });
  const programme = course.programme && programmeName(snapshot.programmes, course.programme);
  const svg = await satori(<CourseImage course={course} programme={programme} />, { ...COURSE_IMAGE_SIZE, fonts });
  const png = new Resvg(svg).render().asPng();
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": CACHE_FOREVER } });
}
