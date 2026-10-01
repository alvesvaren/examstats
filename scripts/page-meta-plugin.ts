/**
 * Writes each page's title, description and Open Graph tags into its HTML. Link previews in chat apps read the HTML
 * and run no JavaScript, so the build writes one `course/<code>.html` per course, which Vercel serves at
 * `/course/<code>`. Unknown paths still fall back to `index.html`.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import { z } from "zod";
import { snapshotSchema } from "../src/domain/snapshot.ts";
import {
  COURSE_IMAGE_SIZE,
  courseDescription,
  courseHeading,
  HOME_DESCRIPTION,
  HOME_HEADING,
  pageTitle,
  SITE_NAME,
} from "../src/lib/page-meta.ts";

/** Open Graph wants absolute URLs. Vercel names the deployment's domains at build time. */
const env = z
  .object({
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
    VERCEL_BRANCH_URL: z.string().optional(),
  })
  .parse(process.env);

/**
 * Production links to the production domain. A preview links to its branch's domain, so its previews show its own
 * images, which production may not have yet. Local builds point at `pnpm preview`.
 */
const host = env.VERCEL_ENV === "production" ? env.VERCEL_PROJECT_PRODUCTION_URL : env.VERCEL_BRANCH_URL;
const ORIGIN = host ? `https://${host}` : "http://localhost:4173";

interface PageImage {
  /** Relative to the base path. */
  path: string;
  width: number;
  height: number;
  /** A large image spans the preview. A small one sits beside the text. */
  card: "summary" | "summary_large_image";
}

interface PageMeta {
  heading: string;
  description: string;
  /** Relative to the base path. */
  path: string;
  image: PageImage;
}

const HOME: PageMeta = {
  heading: HOME_HEADING,
  description: HOME_DESCRIPTION,
  path: "",
  image: { path: "icon-512.png", width: 512, height: 512, card: "summary" },
};

/** Drawn on request by `api/og.tsx`. `v` changes with each build, so caches never serve an image from older data. */
const courseImage = (code: string, version: string): PageImage => ({
  path: `api/og?${new URLSearchParams({ code, v: version }).toString()}`,
  ...COURSE_IMAGE_SIZE,
  card: "summary_large_image",
});

const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function pageMeta(): Plugin {
  let base = "/";
  let publicDir = "public";
  const url = (pagePath: string) => new URL(base + pagePath, ORIGIN).href;

  const headTags = ({ heading, description, path: pagePath, image }: PageMeta) =>
    [
      `<title>${escapeHtml(pageTitle(heading))}</title>`,
      `<meta name="description" content="${escapeHtml(description)}" />`,
      ...Object.entries({
        "og:type": "website",
        "og:site_name": SITE_NAME,
        "og:title": heading,
        "og:description": description,
        "og:url": url(pagePath),
        "og:image": url(image.path),
        "og:image:width": String(image.width),
        "og:image:height": String(image.height),
      }).map(([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}" />`),
      `<meta name="twitter:card" content="${image.card}" />`,
    ].join("\n    ");

  const homeTags = headTags(HOME);

  return {
    name: "page-meta",
    configResolved(config) {
      ({ base, publicDir } = config);
    },
    transformIndexHtml: (html) => html.replace("</head>", `  ${homeTags}\n  </head>`),
    generateBundle: {
      order: "post",
      async handler(_options, bundle) {
        const index = bundle["index.html"];
        if (index?.type !== "asset" || typeof index.source !== "string" || !index.source.includes(homeTags)) {
          throw new Error("page-meta: index.html is missing the home page tags");
        }
        const snapshotFile = path.join(publicDir, "data", "index.json");
        const json = await readFile(snapshotFile, "utf8").catch(() => {
          throw new Error(`page-meta: ${snapshotFile} is missing. Run pnpm snapshot before building.`);
        });
        const snapshot = snapshotSchema.parse(JSON.parse(json));
        const { source } = index;
        const version = Date.parse(snapshot.generatedAt).toString(36);
        for (const course of snapshot.courses) {
          const tags = headTags({
            heading: courseHeading(course),
            description: courseDescription(course),
            path: `course/${encodeURIComponent(course.code)}`,
            image: courseImage(course.code, version),
          });
          this.emitFile({ type: "asset", fileName: `course/${course.code}.html`, source: source.replace(homeTags, () => tags) });
        }
      },
    },
  };
}
