import { effectiveStatus } from "../../../supabase/functions/_shared/execution-attestation";

export const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyée", signed: "Signée", refused: "Refusée", expired: "Expirée", cancelled: "Annulée",
};
export const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline", sent: "secondary", signed: "default", refused: "destructive", expired: "outline", cancelled: "outline",
};
export { effectiveStatus };
