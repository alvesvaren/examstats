import { useSyncExternalStore } from "react";
import { languageSchema, type Language } from "@/domain/names";

const STORAGE_KEY = "u345-language";
const listeners = new Set<() => void>();

/** Swedish when the device's language is, else English. */
const deviceLanguage = (): Language => (navigator.language.startsWith("sv") ? "sv" : "en");

function readLanguage(): Language {
  try {
    return languageSchema.catch(deviceLanguage).parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return deviceLanguage();
  }
}

let language = readLanguage();

/** The language course and programme names show in. Route loaders read it outside React. */
export const getLanguage = () => language;

export function setLanguage(next: Language) {
  language = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private windows can refuse storage. The language still applies for this visit.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useLanguage = () => useSyncExternalStore(subscribe, getLanguage);
