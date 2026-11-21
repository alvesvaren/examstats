import { getRouteApi } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";

const route = getRouteApi("/planner");

const YEARS = 5;
const PERIODS = 4;
const PROGRAMMES = 6;

/** Stands in for the planner while it loads: the programme search without a programme in the URL, else the programme's plan. */
export function PlannerSkeleton() {
  const { programme } = route.useSearch();
  return programme ? <ProgrammeSkeleton /> : <SearchSkeleton />;
}

/** A heading, a search field and some programme cards. */
function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-6 w-72 max-w-full" />
      </div>
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-1 sm:grid-cols-2">
        {Array.from({ length: PROGRAMMES }, (_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </div>
  );
}

/** A back link, a title, the years of study and the study periods. */
function ProgrammeSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-72 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: YEARS }, (_, i) => (
          <Skeleton key={i} className="h-10 w-20" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: PERIODS }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
