import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { catalogQuery, plansQuery } from "@/data/queries";
import { openProgramme, plannerCohort, plannerStep, resolvePlanner, type PlannerAction } from "@/domain/planner-state";
import { useLanguage } from "@/hooks/use-language";
import { usePlannerMemory } from "@/hooks/use-planner-memory";

const route = getRouteApi("/planner");

/**
 * What the planner shows, from the link and what this device remembers, and the way to change it: `dispatch` an
 * action, which updates the link and what is remembered. Suspends while the plans of a start year load.
 */
export function usePlanner() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const language = useLanguage();
  const { data: catalog } = useSuspenseQuery(catalogQuery(language));
  const { memory, remember } = usePlannerMemory();
  const cohort = plannerCohort(catalog.plans, search, memory);
  const { data: plans } = useSuspenseQuery(plansQuery(language, cohort.start));
  const { data: masterPlans } = useSuspenseQuery(plansQuery(language, cohort.masterPlans));
  const state = resolvePlanner({ search, memory, cohort, plans, masterPlans, programmes: catalog.programmes });

  const dispatch = (action: PlannerAction) => {
    if (state.kind !== "plan") return;
    const step = plannerStep(state, action);
    if (step.remember) remember(step.remember);
    void navigate({ search: (prev) => ({ ...prev, ...step.search }), replace: true, resetScroll: false });
  };
  /** Remembers the programme as the one last worked on. A link to it opens it. */
  const rememberProgramme = (code: string) => remember(openProgramme(code));
  const open = (code: string) => {
    rememberProgramme(code);
    void navigate({ to: "/planner", search: { programme: code } });
  };
  return { state, catalog, dispatch, openProgramme: open, rememberProgramme };
}
