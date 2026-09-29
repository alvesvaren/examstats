import { Link, Outlet, type ErrorComponentProps } from "@tanstack/react-router";
import { ArrowUpIcon, MoonIcon, SunIcon } from "lucide-react";
import { cn } from "cn";
import { GradeChip } from "@/components/grade";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useScrolledPast } from "@/hooks/use-scrolled-past";
import { useTheme } from "@/hooks/use-theme";

const LOGO_GRADES = ["U", "3", "4", "5"] as const;
const SKELETON_ROWS = 12;
/** How far down the page, in pixels, the button back to the top appears. */
const SCROLL_TOP_OFFSET = 600;

function ThemeToggle() {
  const { toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode">
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  );
}

const scrollUp = () => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });

/** Shows once the page has scrolled a way down. Hidden, it stays in place but out of sight and out of the tab order. */
function ScrollToTop() {
  const visible = useScrolledPast(SCROLL_TOP_OFFSET);
  return (
    <Button
      variant="outline"
      size="icon-lg"
      onClick={scrollUp}
      aria-label="Back to top"
      inert={!visible}
      className={cn(
        "fixed right-4 bottom-4 z-40 rounded-full shadow-md transition-opacity md:right-6 md:bottom-6",
        !visible && "opacity-0",
      )}
    >
      <ArrowUpIcon />
    </Button>
  );
}

export function AppLayout() {
  return (
    <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-4">
      <header className="flex items-center justify-between py-4">
        <Link to="/" className="flex items-center gap-2.5 font-medium">
          <span className="flex gap-0.5" aria-hidden>
            {LOGO_GRADES.map((grade) => (
              <GradeChip key={grade} grade={grade} />
            ))}
          </span>
          Chalmers exam results
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex-1 pb-16">
        <Outlet />
      </main>
      <footer className="border-t py-6 text-sm text-muted-foreground">
        Data from{" "}
        <a href="https://stats.ftek.se" className="underline underline-offset-4 hover:text-foreground">
          stats.ftek.se
        </a>
      </footer>
      <ScrollToTop />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <h1 className="text-xl font-semibold">Could not load the data</h1>
      <p className="text-muted-foreground">{error instanceof Error ? error.message : "Something went wrong."}</p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

export function NotFoundState() {
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <h1 className="text-xl font-semibold">No such course</h1>
      <Button variant="outline" asChild>
        <Link to="/">All courses</Link>
      </Button>
    </div>
  );
}
