import { createRootRouteWithContext, createRoute, createRouter, notFound } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AppLayout, CourseNotFound, ErrorState, PageNotFound, PageSkeleton } from "@/components/app-layout";
import { courseQuery, plansQuery, queryClient, snapshotQuery } from "@/data/queries";
import { SORT_KEYS, toCatalogCourse } from "@/domain/catalog";
import { plannerSearchSchema } from "@/domain/planner-state";
import { OTHER_QUESTIONS } from "@/domain/evaluation";
import { cohortOf, STUDY_PERIODS } from "@/domain/programme-plans";
import { getLanguage } from "@/hooks/use-language";
import { getMessages } from "@/hooks/use-messages";
import { CoursePage } from "@/features/course/course-page";
import { CourseListPage } from "@/features/course-list/course-list-page";
import { PlannerPage } from "@/features/planner/planner-page";
import { PlannerSkeleton } from "@/features/planner/planner-skeleton";
import { courseHeading, pageTitle } from "@/lib/page-meta";

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [{ title: pageTitle(getMessages().layout.siteHeading) }] }),
  component: AppLayout,
});

const listSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  programme: z.string().optional().catch(undefined),
  /** An examiner's name, as the plans write it. */
  examiner: z.string().optional().catch(undefined),
  /** Study periods this year that listed courses run in. */
  periods: z.array(z.enum(STUDY_PERIODS)).optional().catch(undefined),
  sort: z.enum(SORT_KEYS).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  /** The course survey question the survey column shows, when not the overall impression. */
  survey: z.enum(OTHER_QUESTIONS).optional().catch(undefined),
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
    return { course: toCatalogCourse(course, getLanguage()) };
  },
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: pageTitle(courseHeading(loaderData.course)) }] : [] }),
  notFoundComponent: CourseNotFound,
  component: CoursePage,
});

const plannerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/planner",
  validateSearch: plannerSearchSchema,
  loaderDeps: ({ search }) => ({ programme: search.programme, start: search.start }),
  loader: async ({ context, deps }) => {
    const snapshot = await context.queryClient.ensureQueryData(snapshotQuery);
    const { start, masterPlans } = cohortOf(snapshot.plans, deps.programme, deps.start);
    // A start year this device remembers loads in the page instead.
    await Promise.all([start, masterPlans].map((year) => context.queryClient.ensureQueryData(plansQuery(getLanguage(), year))));
  },
  head: () => ({ meta: [{ title: pageTitle(getMessages().layout.plannerHeading) }] }),
  component: PlannerPage,
  // The page suspends when a remembered start year needs another plan file.
  pendingComponent: PlannerSkeleton,
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
  defaultNotFoundComponent: PageNotFound,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
