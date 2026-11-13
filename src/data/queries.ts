import { QueryClient, queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { toCatalog } from "@/domain/catalog";
import type { Language } from "@/domain/names";
import { planInLanguage, publishedPlanSchema } from "@/domain/programme-plans";
import { courseDetailSchema, snapshotSchema } from "@/domain/snapshot";

const DATA_URL = `${import.meta.env.BASE_URL}data`;

async function getJson<T>(url: string, schema: z.ZodType<T>, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  return schema.parse(await response.json());
}

/** The snapshot only changes when the site is rebuilt, so cached data never goes stale. */
export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });

export const snapshotQuery = queryOptions({
  queryKey: ["snapshot"],
  queryFn: ({ signal }) => getJson(`${DATA_URL}/index.json`, snapshotSchema, signal),
});

/** One query per language, so each keeps a stable `select`, which caches its result per snapshot. */
const perLanguage = <T>(make: (language: Language) => T) => {
  const queries: Record<Language, T> = { en: make("en"), sv: make("sv") };
  return (language: Language) => queries[language];
};

/** The snapshot named in `language`, with search text and sort values computed once. */
export const catalogQuery = perLanguage((language) =>
  queryOptions({ ...snapshotQuery, select: (snapshot) => toCatalog(snapshot, language) }),
);

export const courseQuery = (code: string) =>
  queryOptions({
    queryKey: ["course", code],
    queryFn: ({ signal }) => getJson(`${DATA_URL}/courses/${encodeURIComponent(code)}.json`, courseDetailSchema, signal),
  });

const publishedPlansQuery = queryOptions({
  queryKey: ["plans"],
  queryFn: ({ signal }) => getJson(`${DATA_URL}/plans.json`, z.array(publishedPlanSchema), signal),
});

/** Every programme's plan for the current academic year, named in `language`. Only the course planner loads it. */
export const plansQuery = perLanguage((language) =>
  queryOptions({ ...publishedPlansQuery, select: (plans) => plans.map((plan) => planInLanguage(plan, language)) }),
);
