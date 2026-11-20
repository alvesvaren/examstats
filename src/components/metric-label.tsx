import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMessages } from "@/hooks/use-messages";
import type { Messages } from "@/lib/i18n/en";

export type Metric = keyof Messages["metrics"]["help"];

/** An info icon that explains a metric on hover and focus. */
export function MetricInfo({ metric, name }: { metric: Metric; name: string }) {
  const t = useMessages();
  return (
    <Tooltip>
      <TooltipTrigger className="rounded-full text-muted-foreground hover:text-foreground" aria-label={t.metrics.about(name)}>
        <InfoIcon className="size-3.5" aria-hidden />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{t.metrics.help[metric]}</TooltipContent>
    </Tooltip>
  );
}

export function MetricLabel({ metric, children }: { metric: Metric; children: ReactNode & string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <MetricInfo metric={metric} name={children.toLowerCase()} />
    </span>
  );
}
