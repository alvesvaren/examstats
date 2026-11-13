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

const namedPlansQuery = (language: Language, start: number) =>
  queryOptions({
    queryKey: ["plans", start],
    queryFn: ({ signal }) => getJson(`${DATA_URL}/plans/${start}.json`, z.array(publishedPlanSchema), signal),
    select: (plans) => plans.map((plan) => planInLanguage(plan, language)),
  });

/** One query per language and start year, so each keeps a stable `select`. */
const plansQueries = new Map<string, ReturnType<typeof namedPlansQuery>>();

/**
 * Every programme as the students who started it in `start` study it, named in `language`. Only the course planner
 * loads them.
 */
export function plansQuery(language: Language, start: number) {
  const key = `${language}.${start}`;
  const query = plansQueries.get(key) ?? namedPlansQuery(language, start);
  plansQueries.set(key, query);
  return query;
}
