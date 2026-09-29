import { createRootRouteWithContext, createRoute, createRouter, notFound } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AppLayout, ErrorState, NotFoundState, PageSkeleton } from "@/components/app-layout";
import { courseQuery, queryClient, snapshotQuery } from "@/data/queries";
import { SORT_KEYS, toCatalogCourse } from "@/domain/catalog";
import { CoursePage } from "@/features/course/course-page";
import { CourseListPage } from "@/features/course-list/course-list-page";

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: AppLayout,
});

const listSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  programme: z.string().optional().catch(undefined),
  sort: z.enum(SORT_KEYS).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  ended: z.boolean().optional().catch(undefined),
});

const listRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: listSearchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  component: CourseListPage,
});

const courseSearchSchema = z.object({
  part: z.number().int().nonnegative().optional().catch(undefined),
  survey: z
    .union([z.number().int(), z.literal("all")])
    .optional()
    .catch(undefined),
});

const courseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/course/$code",
  validateSearch: courseSearchSchema,
  loader: async ({ context, params }) => {
    const snapshot = await context.queryClient.ensureQueryData(snapshotQuery);
    const course = snapshot.courses.find((c) => c.code === params.code);
    if (!course) throw notFound();
    await context.queryClient.ensureQueryData(courseQuery(params.code));
    return { course: toCatalogCourse(course) };
  },
  component: CoursePage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([listRoute, courseRoute]),
  context: { queryClient },
  basepath: import.meta.env.BASE_URL,
  defaultPreload: "intent",
  // Loaders only read the query cache, and cached data never goes stale, so search changes need no reload.
  defaultStaleTime: Infinity,
  scrollRestoration: true,
  defaultPendingComponent: PageSkeleton,
  defaultErrorComponent: ErrorState,
  defaultNotFoundComponent: NotFoundState,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
