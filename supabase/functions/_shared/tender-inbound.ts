/**
 * Routage des alertes de marchés publics reçues par mail (PLACE, AWS, autres).
 *
 * Clé de routage : l'ADRESSE DE DESTINATION, jamais l'expéditeur. Une adresse
 * par source sur un sous-domaine dédié — `place@inbound.supertilt.fr`,
 * `aws@inbound.supertilt.fr` — et la partie locale devient la source. Ajouter
 * une source demain, c'est une règle de transfert de plus, aucune ligne de
 * code et aucun déploiement.
 *
 * Conséquence de sécurité, et c'est l'invariant du module : un mail reçu sur ce
 * sous-domaine ne peut JAMAIS créer de carte CRM. La règle porte sur le
 * domaine, pas sur une liste d'expéditeurs à tenir à jour.
 *
 * Le destinataire à regarder est `received_for` (destinataire d'enveloppe) et
 * non l'en-tête `To`. Sur un mail transféré automatiquement par Gmail, `To`
 * garde l'adresse d'origine : router dessus ne marcherait que sur les envois
 * directs, c'est-à-dire uniquement pendant les tests.
 */

import { parseEmailAddress } from "./email-address.ts";
import { dedupKey, loadTenderFilterConfig, matchTender } from "./tender-tools.ts";

export interface InboundAddresses {
  /** Destinataires d'enveloppe, puis en-tête To en repli. */
  recipients: string[];
}

export interface TenderInboundResult {
  routed: boolean;
  source: string | null;
  created: boolean;
  reason: string | null;
}

/** Réglage : `@inbound.supertilt.fr` (tout le sous-domaine) ou une adresse exacte. */
const SETTING_KEY = "tender_inbound_email";

/**
 * Destinataires d'un mail, en privilégiant l'enveloppe.
 * Resend fournit `received_for` ; on retombe sur `to` quand il est absent.
 */
export function inboundRecipients(data: {
  received_for?: string[];
  to?: string[];
}): string[] {
  const envelope = (data.received_for ?? []).map((a) => parseEmailAddress(a).email);
  if (envelope.some(Boolean)) return envelope.filter(Boolean);
  return (data.to ?? []).map((a) => parseEmailAddress(a).email).filter(Boolean);
}

/**
 * Le mail relève-t-il du flux marchés publics, et pour quelle source.
 * Le réglage peut être un sous-domaine (`@inbound.supertilt.fr`) ou une
 * adresse complète. Vide = routage désactivé.
 */
export function matchTenderRecipient(
  recipients: string[],
  setting: string | null | undefined,
): { matched: boolean; source: string | null } {
  const rule = (setting ?? "").trim().toLowerCase();
  if (!rule) return { matched: false, source: null };

  for (const raw of recipients) {
    const address = raw.trim().toLowerCase();
    if (!address) continue;

    if (rule.startsWith("@")) {
      if (address.endsWith(rule)) {
        // La partie locale porte la source : place@, aws@, boamp@...
        const local = address.slice(0, address.length - rule.length);
        return { matched: true, source: local || "mail" };
      }
      continue;
    }
    if (address === rule) return { matched: true, source: "mail" };
  }
  return { matched: false, source: null };
}

/**
 * Crée une opportunité à partir d'une alerte mail.
 *
 * Le corps du message n'est pas livré par le webhook de Resend, qui ne
 * transmet que des métadonnées : on travaille donc sur le sujet, et le texte
 * complet est récupéré plus tard s'il est nécessaire. L'avis arrive donc
 * directement en `to_review` : il est décidable en l'état.
 */
export async function routeTenderEmail(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  email: {
    id: string;
    messageId: string;
    subject: string | null;
    from: string | null;
    body: string | null;
    recipients: string[];
  },
): Promise<TenderInboundResult> {
  const { data: setting } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", SETTING_KEY)
    .maybeSingle();

  const { matched, source } = matchTenderRecipient(email.recipients, setting?.setting_value);
  if (!matched || !source) {
    return { routed: false, source: null, created: false, reason: null };
  }

  const config = await loadTenderFilterConfig(supabase);
  const objet = (email.subject ?? "").trim() || "(alerte sans objet)";
  const match = matchTender({ objet, extraText: email.body }, config);

  // Une exclusion évidente est écartée sans créer de ligne : c'est le rôle du
  // préfiltre déterministe, avant tout traitement plus coûteux.
  if (match.excludedBy) {
    return { routed: true, source, created: false, reason: `exclu (${match.excludedBy})` };
  }

  // Même raison que pour le connecteur BOAMP : un upsert réécrirait `status`
  // et ferait réapparaître un avis déjà écarté si l'alerte est renvoyée.
  const { error } = await supabase.rpc("upsert_tender_opportunity", {
    p_source: source,
    p_source_ref: email.messageId,
    // `to_review` et non `raw` : il n'existe aucune étape d'analyse, et une
    // alerte mail est décidable telle quelle (objet + lien dans le message).
    // La laisser en `raw` la rendrait invisible pour la revue tout en
    // déclenchant en permanence l'alerte de file qui stagne.
    p_initial_status: "to_review",
    p_payload: {
      source_email_id: email.id,
      objet,
      nature: "APPEL_OFFRE",
      matched_on: match.matched,
      dedup_key: dedupKey({ objet }),
      raw: { subject: email.subject, from: email.from, body: email.body },
    },
  });

  if (error) {
    return { routed: true, source, created: false, reason: error.message };
  }
  return { routed: true, source, created: true, reason: null };
}
