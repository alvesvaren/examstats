import { QueryClient, queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import { toCatalog } from "@/domain/catalog";
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

/** The snapshot with search text and sort values computed once. `select` caches the result per snapshot. */
export const catalogQuery = queryOptions({ ...snapshotQuery, select: toCatalog });

export const courseQuery = (code: string) =>
  queryOptions({
    queryKey: ["course", code],
    queryFn: ({ signal }) => getJson(`${DATA_URL}/courses/${encodeURIComponent(code)}.json`, courseDetailSchema, signal),
  });
