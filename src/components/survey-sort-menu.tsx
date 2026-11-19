import { ArrowDownUpIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isOtherQuestion, OTHER_QUESTIONS, type OtherQuestion } from "@/domain/evaluation";
import { QUESTION_LABELS } from "@/lib/survey-questions";

/** Nothing in the menu is picked when the sort is one of the columns. */
const NONE = "";

interface SurveySortMenuProps {
  /** The survey question the list is sorted by, if any. */
  value: OtherQuestion | undefined;
  onChange: (question: OtherQuestion) => void;
  className?: string;
}

/** A button beside the columns for sorting by the course survey questions besides the rating. */
export function SurveySortMenu({ value, onChange, className }: SurveySortMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={value ? "secondary" : "outline"} className={cn("gap-1.5", className)}>
          <ArrowDownUpIcon aria-hidden />
          {value ? QUESTION_LABELS[value].label : "More sorts"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Sort by course survey</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value ?? NONE} onValueChange={(next) => isOtherQuestion(next) && onChange(next)}>
          {OTHER_QUESTIONS.map((question) => (
            <DropdownMenuRadioItem key={question} value={question}>
              {QUESTION_LABELS[question].label}
              {question === "workload" && <span className="ml-auto text-xs text-muted-foreground">lightest first</span>}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
