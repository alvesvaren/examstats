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
import { isQuestion, QUESTIONS, type Question } from "@/domain/evaluation";
import { useMessages } from "@/hooks/use-messages";

interface SurveyColumnPickerProps {
  /** The question the column shows. */
  question: Question;
  onPick: (question: Question) => void;
}

/** Picks the course survey question that the survey column shows and sorts by. Sits beside the column's header. */
export function SurveyColumnPicker({ question, onPick }: SurveyColumnPickerProps) {
  const t = useMessages();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t.survey.choose}
        className="-mx-0.5 grid size-5 place-items-center rounded-md hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground"
      >
        <ChevronDownIcon className="size-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex flex-col gap-1">
          {t.survey.title}
          <span className="text-xs font-normal text-muted-foreground">{t.survey.meanAnswer}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={question} onValueChange={(next) => isQuestion(next) && onPick(next)}>
          {QUESTIONS.map((q) => (
            <DropdownMenuRadioItem key={q} value={q} className="justify-between gap-3">
              {t.survey.questions[q].label}
              {t.survey.hints[q] && <span className="text-xs text-muted-foreground">{t.survey.hints[q]}</span>}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
