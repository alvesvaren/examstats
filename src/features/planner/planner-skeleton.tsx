import { Skeleton } from "@/components/ui/skeleton";

const YEARS = 5;
const PERIODS = 4;

/** Stands in for the planner while the plans of a start year load: a back link, a title, the years of study and the study periods. */
export function PlannerSkeleton() {
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
