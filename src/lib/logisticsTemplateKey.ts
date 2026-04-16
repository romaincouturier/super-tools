import type { LogisticsEntityType } from "@/types/logistics";

/**
 * Resolve the app_settings template key for a given entity.
 *
 * Extracted to a pure module (no Supabase imports) so it can be
 * unit-tested without the full client chain.
 *
 * Mission examples:  "mission.remote", "mission.presentiel"
 * Training examples: "training.inter.presentiel", "training.classe_virtuelle",
 *                    "training.intra.presentiel", "training.e_learning"
 */
export function resolveTemplateKey(args: {
  entityType: LogisticsEntityType;
  isRemote?: boolean;
  format?: string | null;
  sessionType?: string | null;
}): string {
  if (args.entityType === "mission") {
    return args.isRemote ? "mission.remote" : "mission.presentiel";
  }
  // Training
  const fmt = args.format || "presentiel";
  if (fmt === "classe_virtuelle") return "training.classe_virtuelle";
  if (fmt === "e_learning") return "training.e_learning";
  // Presentiel — split inter / intra (default to inter when unknown)
  const session = args.sessionType === "intra" ? "intra" : "inter";
  return `training.${session}.${fmt}`;
}
