import type { Language } from "@/domain/names";
import { getLanguage, useLanguage } from "@/hooks/use-language";
import { en, type Messages } from "@/lib/i18n/en";
import { sv } from "@/lib/i18n/sv";

const MESSAGES: Record<Language, Messages> = { en, sv };

/** The words of the site, and its number and date formats, in the language picked in the header. */
export const useMessages = () => MESSAGES[useLanguage()];

/** The messages in the language picked, for route loaders and heads, which run outside React. */
export const getMessages = () => MESSAGES[getLanguage()];
