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
import { snapshotSchema, type CourseSummary, type TrendPoint } from "../src/domain/snapshot.ts";
import { ANSWER_SCALE, answerFrequencies } from "../src/domain/evaluation.ts";
import type { Frequencies } from "../src/domain/spread.ts";
import { distributionMark } from "../src/lib/distribution-mark.ts";
import { formatAcademicYear, formatCount, formatGrade, formatPercent, formatScore } from "../src/lib/format.ts";
import { GRADE_COLOURS } from "../src/lib/grade-colours.ts";
import { COURSE_IMAGE_SIZE, SITE_NAME } from "../src/lib/page-meta.ts";

const FOREGROUND_RGB = "10, 10, 10";
const FOREGROUND = `rgb(${FOREGROUND_RGB})`;
const MUTED = "#737373";
const TRACK = "#f0f0f0";

const PADDING = 72;
const SPARK_WIDTH = 220;
const SPARK_HEIGHT = 64;
const SPARK_PAD = 6;
const MARK_WIDTH = 120;
const MARK_HEIGHT = 12;
const TICK_WIDTH = 4;
const TICK_OVERHANG = 4;

/** Pass rate per academic year on a fixed 0 to 100% scale, like the sparkline in the course list. */
function Sparkline({ trend }: { trend: readonly TrendPoint[] }) {
  const first = trend[0];
  const last = trend.at(-1);
  if (!first || !last || trend.length < 2) return null;
  const x = (i: number) => SPARK_PAD + ((SPARK_WIDTH - 2 * SPARK_PAD) * i) / (trend.length - 1);
  const y = (rate: number) => SPARK_PAD + (SPARK_HEIGHT - 2 * SPARK_PAD) * (1 - rate);
  const line = trend.map(([, rate], i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(rate).toFixed(1)}`).join("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <svg width={SPARK_WIDTH} height={SPARK_HEIGHT} viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}>
        <path d={line} fill="none" stroke={MUTED} strokeWidth={3} strokeLinejoin="round" />
        <circle cx={x(trend.length - 1)} cy={y(last[1])} r={6} fill={FOREGROUND} />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", width: SPARK_WIDTH, fontSize: 20, color: MUTED }}>
        <span>{formatAcademicYear(first[0])}</span>
        <span>{formatAcademicYear(last[0])}</span>
      </div>
    </div>
  );
}

/** The course page's distribution mark, with `rgba` in place of `color-mix`, which Satori cannot draw. */
function DistributionMark({ frequencies, min, max }: { frequencies: Frequencies; min: number; max: number }) {
  const { stops, median } = distributionMark(frequencies, min, max);
  const gradient = stops.map(({ at, shade }) => `rgba(${FOREGROUND_RGB}, ${shade}) ${at}%`);
  return (
    <div style={{ display: "flex", position: "relative", width: MARK_WIDTH, height: MARK_HEIGHT }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          borderRadius: 4,
          backgroundColor: `rgba(${FOREGROUND_RGB}, 0.1)`,
          backgroundImage: `linear-gradient(to right, ${gradient.join(", ")})`,
        }}
      />
      {median !== null && (
        <div
          style={{
            position: "absolute",
            top: -TICK_OVERHANG,
            bottom: -TICK_OVERHANG,
            left: (median / 100) * MARK_WIDTH - TICK_WIDTH / 2,
            width: TICK_WIDTH,
            borderRadius: TICK_WIDTH / 2,
            backgroundColor: FOREGROUND,
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 24, color: MUTED }}>{label}</span>
      <span style={{ fontSize: 64, fontWeight: 600, letterSpacing: -2 }}>{value}</span>
      {children}
    </div>
  );
}

/** Grade distribution as one bar, U first, with each grade's share below it. */
function GradeBar({ grades }: { grades: CourseSummary["recentGrades"] }) {
  const present = GRADES.filter((grade) => grades[grade] > 0);
  const total = present.reduce((sum, grade) => sum + grades[grade], 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", height: 24, gap: 3, borderRadius: 6, overflow: "hidden", backgroundColor: TRACK }}>
        {present.map((grade) => (
          <div key={grade} style={{ flexGrow: grades[grade], backgroundColor: GRADE_COLOURS[grade] }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 28, fontSize: 22, color: MUTED }}>
        <span>Main exam, last {RECENT_YEARS} years</span>
        {present.map((grade) => (
          <div key={grade} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: GRADE_COLOURS[grade] }} />
            <span style={{ color: FOREGROUND, fontWeight: 600 }}>{grade}</span>
            <span>{formatPercent(grades[grade] / total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CourseImageProps {
  course: CourseSummary;
  programme: string | null;
  /** The site icon as a data URL. */
  icon: string;
}

export function CourseImage({ course, programme, icon }: CourseImageProps) {
  const { code, name, recentGrades, trend, overallAnswers, passRate, averageGrade, attemptsPerYear, rating } = toCatalogCourse(course);
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
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: MUTED }}>
          <img src={icon} width={40} height={40} />
          <span style={{ color: FOREGROUND, fontWeight: 600 }}>{SITE_NAME}</span>
          <span>{[code, programme].filter(Boolean).join(" · ")}</span>
        </div>
        <span style={{ display: "block", fontSize: 60, fontWeight: 600, letterSpacing: -2, lineHeight: 1.1, lineClamp: 2 }}>{name}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 64 }}>
            <Stat label="Pass rate" value={formatPercent(passRate)} />
            <Stat label="Average grade" value={formatGrade(averageGrade)} />
            <Stat label="Attempts per year" value={formatCount(attemptsPerYear)} />
            <Stat label="Rating" value={formatScore(rating)}>
              {overallAnswers && <DistributionMark frequencies={answerFrequencies(overallAnswers)} {...ANSWER_SCALE} />}
            </Stat>
          </div>
          <Sparkline trend={trend} />
        </div>
        <GradeBar grades={recentGrades} />
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
