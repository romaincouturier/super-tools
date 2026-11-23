/** État d'expédition d'une location, partagé par l'écran Commandes et le récap quotidien. */
export type RentalShippingKind = "none" | "wait" | "prepare" | "invalid" | "done";

export interface RentalSignatureLike {
  status: "pending" | "signed" | "expired" | "cancelled" | string;
  email_sent_at?: string | null;
  signed_at?: string | null;
  expires_at?: string | null;
  reminder_count?: number | null;
}
export interface RentalItemLike {
  shipped_confirmed_at?: string | null;
  hand_delivered_at?: string | null;
  location_returned_at?: string | null;
  archived_at?: string | null;
}

export function rentalShippingState(sig: RentalSignatureLike | null | undefined, item: RentalItemLike, now = new Date()) {
  if (item.shipped_confirmed_at || item.hand_delivered_at || item.location_returned_at || item.archived_at) return { kind: "done" as RentalShippingKind };
  if (!sig) return { kind: "none" as RentalShippingKind };
  if (sig.status === "signed") return { kind: "prepare" as RentalShippingKind, signedAt: sig.signed_at ?? null };
  const expired = sig.status === "expired" || (sig.status === "pending" && !!sig.expires_at && new Date(sig.expires_at) < now);
  if (expired || sig.status === "cancelled") return { kind: "invalid" as RentalShippingKind, reason: expired ? "expiré" : "annulé" };
  if (sig.status === "pending" && sig.email_sent_at) {
    return {
      kind: "wait" as RentalShippingKind,
      sentAt: sig.email_sent_at,
      ageDays: Math.max(0, Math.floor((now.getTime() - new Date(sig.email_sent_at).getTime()) / 86400000)),
      reminders: sig.reminder_count ?? 0,
      expiresAt: sig.expires_at ?? null,
    };
  }
  return { kind: "none" as RentalShippingKind };
}

/** Destinataires internes de la confirmation « colis à préparer » (réglage, séparés par des virgules). */
export function parseNotifyEmails(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))];
}

export function formatShippingAddress(a: Record<string, string> | null | undefined): string {
  if (!a) return "";
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ");
  const city = [a.postcode, a.city].filter(Boolean).join(" ");
  return [name, a.company, a.address_1, a.address_2, city, a.country].filter((s) => s && String(s).trim()).join(", ");
}
