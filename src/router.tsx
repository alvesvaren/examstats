import { createRootRouteWithContext, createRoute, createRouter, notFound } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AppLayout, ErrorState, NotFoundState, PageSkeleton } from "@/components/app-layout";
import { courseQuery, plansQuery, queryClient, snapshotQuery } from "@/data/queries";
import { SORT_KEYS, toCatalogCourse } from "@/domain/catalog";
import { PLANNER_SORT_KEYS } from "@/domain/planner";
import { STUDY_PERIODS } from "@/domain/programme-plans";
import { CoursePage } from "@/features/course/course-page";
import { CourseListPage } from "@/features/course-list/course-list-page";
import { PlannerPage } from "@/features/planner/planner-page";
import { courseHeading, HOME_HEADING, pageTitle, PLANNER_HEADING } from "@/lib/page-meta";

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [{ title: pageTitle(HOME_HEADING) }] }),
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
  /** A round key such as "2025-LP3". Coerced because the router reads a bare year as a number. */
  survey: z.coerce.string().optional().catch(undefined),
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
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: pageTitle(courseHeading(loaderData.course)) }] : [] }),
  component: CoursePage,
});

const plannerSearchSchema = z.object({
  programme: z.string().optional().catch(undefined),
  year: z.number().int().positive().optional().catch(undefined),
  track: z.string().optional().catch(undefined),
  /** The study period whose courses are listed. */
  period: z.enum(STUDY_PERIODS).optional().catch(undefined),
  sort: z.enum(PLANNER_SORT_KEYS).optional().catch(undefined),
  /** Round keys of the courses added to the year, such as "TDA357.LP2". */
  picked: z.array(z.string()).optional().catch(undefined),
});

const plannerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/planner",
  validateSearch: plannerSearchSchema,
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(snapshotQuery), context.queryClient.ensureQueryData(plansQuery)]),
  head: () => ({ meta: [{ title: pageTitle(PLANNER_HEADING) }] }),
  component: PlannerPage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([listRoute, courseRoute, plannerRoute]),
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
