import type { Catalog } from "@/domain/catalog";
import type { PrerequisiteLookup } from "@/domain/prerequisite-check";
import type { ProgrammePlan } from "@/domain/programme-plans";

/** Names of the courses and programmes prerequisites name, in the language picked. */
export interface Naming {
  course: (code: string) => string;
  programme: (code: string) => string;
}

/** Names from the plans and the catalog, which are in the language picked, else the graph's English ones. */
export function namingOf(plans: readonly ProgrammePlan[], catalog: Catalog, lookup: PrerequisiteLookup): Naming {
  const courses = new Map([
    ...catalog.courses.map((c) => [c.code, c.name] as const),
    ...plans.flatMap((p) => p.years.flatMap((y) => y.courses.map((c) => [c.code, c.name] as const))),
  ]);
  return {
    course: (code) => courses.get(code) ?? lookup.nameOf(code) ?? code,
    programme: (code) => catalog.programmes[code]?.name ?? lookup.nameOf(`programme:${code}`) ?? code,
  };
}
