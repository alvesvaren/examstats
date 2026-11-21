import type { ComponentProps } from "react";
import { cn } from "cn";
import { NativeSelect } from "@/components/ui/native-select";

/** 16px text on phones, because iOS zooms into focused fields with smaller text. */
const FIELD_SIZE = "[&_select]:h-10 [&_select]:text-base md:[&_select]:text-sm";

/** A `NativeSelect` in the size of the page's fields. */
export function FieldSelect({ className, ...props }: ComponentProps<typeof NativeSelect>) {
  return <NativeSelect className={cn(FIELD_SIZE, className)} {...props} />;
}
