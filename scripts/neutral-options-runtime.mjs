import { createJiti } from "jiti";

// Use the same TypeScript loader on Node 20 and newer; keep one shared source.
export const { planOptionBackfill, normalizeOptionKey } = await createJiti(
  import.meta.url,
  { tryNative: false },
).import("../src/lib/sellable-options.ts");
