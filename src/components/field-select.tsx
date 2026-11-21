import type { ComponentProps } from "react";
import { cn } from "cn";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

/** 16px text on phones, because iOS zooms into focused fields with smaller text. */
const FIELD_SIZE = "[&_select]:h-10 [&_select]:text-base md:[&_select]:text-sm";

interface FieldSelectProps extends Omit<ComponentProps<typeof NativeSelect>, "children"> {
  options: readonly { value: string; label: string }[];
}

/** A select in the size of the page's fields, with its options. */
export function FieldSelect({ options, className, ...props }: FieldSelectProps) {
  return (
    <NativeSelect className={cn(FIELD_SIZE, className)} {...props}>
      {options.map(({ value, label }) => (
        <NativeSelectOption key={value} value={value}>
          {label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
