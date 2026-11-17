import { useSyncExternalStore } from "react";
import { parsePlannerMemory, type PlannerMemory } from "@/domain/planner-memory";

const STORAGE_KEY = "u345-planner";
/** Tells this tab about its own writes. The browser's `storage` event only reaches other tabs. */
const CHANGE_EVENT = "u345-planner-change";

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  addEventListener("storage", onChange);
  addEventListener(CHANGE_EVENT, onChange);
  return () => {
    removeEventListener("storage", onChange);
    removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** What the planner remembers on this device, and a way to change it. */
export function usePlannerMemory() {
  const memory = parsePlannerMemory(useSyncExternalStore(subscribe, readStored));
  const remember = (change: (memory: PlannerMemory) => PlannerMemory) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(change(parsePlannerMemory(readStored()))));
    } catch {
      // Private windows can refuse storage. The picks still live in the URL for this visit.
    }
    dispatchEvent(new Event(CHANGE_EVENT));
  };
  return { memory, remember };
}
