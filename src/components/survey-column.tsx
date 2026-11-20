import { ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ANSWER_SCALE, isQuestion, QUESTIONS, type Question } from "@/domain/evaluation";
import { QUESTION_LABELS, SPREAD_HELP, SURVEY_SOURCE } from "@/lib/survey-questions";

const HINTS: Partial<Record<Question, string>> = { overall: "Rating", workload: `${ANSWER_SCALE.max} is too high` };

interface SurveyColumnPickerProps {
  /** The question the column shows. */
  question: Question;
  onPick: (question: Question) => void;
}

/** Picks the course survey question that the survey column shows and sorts by. Sits beside the column's header. */
export function SurveyColumnPicker({ question, onPick }: SurveyColumnPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Choose the course survey question"
        className="-mx-0.5 grid size-5 place-items-center rounded-md hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground"
      >
        <ChevronDownIcon className="size-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex flex-col gap-1">
          Course survey
          <span className="text-xs font-normal text-muted-foreground">
            Mean answer {SURVEY_SOURCE}. {SPREAD_HELP}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={question} onValueChange={(next) => isQuestion(next) && onPick(next)}>
          {QUESTIONS.map((q) => (
            <DropdownMenuRadioItem key={q} value={q} className="justify-between gap-3">
              {QUESTION_LABELS[q].label}
              {HINTS[q] && <span className="text-xs text-muted-foreground">{HINTS[q]}</span>}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
