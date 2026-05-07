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
  const rawFmt = args.format || "presentiel";
  if (rawFmt === "classe_virtuelle") return "training.classe_virtuelle";
  if (rawFmt === "e_learning") return "training.e_learning";
  // Normalise les variantes présentielles ("inter-entreprises", "intra", "presentiel"…)
  // vers la sous-clé "presentiel" attendue par les templates.
  const fmt = "presentiel";
  // Détermine inter / intra depuis sessionType OU format_formation
  const isIntra = args.sessionType === "intra" || rawFmt === "intra";
  const session = isIntra ? "intra" : "inter";
  return `training.${session}.${fmt}`;
}
