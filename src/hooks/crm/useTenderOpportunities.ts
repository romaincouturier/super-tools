/**
 * Salle d'attente des appels d'offres publics : lecture de la liste à décider,
 * No Go motivé, et promotion en carte CRM.
 *
 * Le Go passe par `useCreateCard`, le même chemin que le formulaire manuel et
 * le webhook Elementor : une carte issue d'un marché public doit être en tout
 * point identique aux autres, notification Slack et journal d'activité compris.
 *
 * Voir docs/marches-publics.md.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCrmMutation } from "./useCrmMutation";
import { useCreateCard } from "./useCreateCard";
import { notifyCrmSlack } from "@/services/crmSlack";
import { escapeHtml, safeUrl } from "@/lib/tenderHtml";
import type { ServiceType } from "@/types/crm";
import type { TenderOpportunity, TenderWithContext } from "@/types/tenders";

export const TENDERS_QUERY_KEY = "tender-opportunities";

export interface TenderPage {
  items: TenderWithContext[];
  /** Nombre réel d'avis à décider, avant le plafond d'affichage. */
  total: number;
  truncated: boolean;
}

/** Statuts qui appellent une décision. */
const OPEN_STATUSES = ["raw", "to_review"];

/** Aujourd'hui en Europe/Paris, pour dater la prochaine action. */
function todayParis(): string {
  const paris = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  return `${paris.getFullYear()}-${String(paris.getMonth() + 1).padStart(2, "0")}-${String(
    paris.getDate(),
  ).padStart(2, "0")}`;
}

// ── Liste à décider ──────────────────────────────────────────

export const useTenderOpportunities = (status: "open" | "decided" = "open") => {
  return useQuery({
    queryKey: [TENDERS_QUERY_KEY, status],
    // Un onglet resté ouvert affichait encore la liste d'avant une purge ou une
    // resynchronisation : ici la fraîcheur compte plus que le cache.
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    queryFn: async (): Promise<TenderPage> => {
      let query = supabase
        .from("tender_opportunities")
        // `count: exact` : afficher 200 quand il y en a 278 ferait passer un
        // plafond d'affichage pour un total, et croire la revue terminée.
        .select("*", { count: "exact" })
        // Les doublons inter-sources ne sont jamais affichés : le même marché
        // arrive par le BOAMP et par une alerte PLACE, et le qualifier deux
        // fois est ce qui décourage la revue.
        .is("duplicate_of", null)
        // Un avis d'attribution ne se décide pas : il est ingéré pour dire qui
        // est le titulaire sortant. Le laisser dans la file de décision ajoute
        // un tiers de lignes sur lesquelles il n'y a rien à faire.
        .neq("nature", "ATTRIBUTION");

      query = status === "open"
        ? query
            .in("status", OPEN_STATUSES)
            // Une échéance dépassée n'est plus une décision : le cron
            // d'expiration ne passe qu'une fois par jour, et sans ce filtre la
            // liste s'ouvre sur des marchés morts.
            .or(`datelimitereponse.is.null,datelimitereponse.gte.${new Date().toISOString()}`)
        : query.in("status", ["go", "no_go", "expired"]);

      // Les avis sans date limite connue passent en dernier plutôt que d'être
      // traités comme les plus urgents.
      const PAGE_MAX = 200;
      const { data, error, count } = await query
        .order("datelimitereponse", { ascending: true, nullsFirst: false })
        .order("dateparution", { ascending: false })
        .limit(PAGE_MAX);
      if (error) throw error;

      const rows = (data || []) as unknown as TenderOpportunity[];

      // Historique CRM avec les mêmes acheteurs : c'est l'élément de décision
      // le plus rapide à lire, et il est déjà en base.
      // Plafonné : `.in()` part dans l'URL de la requête, et 200 noms
      // d'acheteurs la feraient dépasser la limite du serveur. Les avis les
      // plus urgents sont en tête, ce sont eux qui ont besoin du contexte.
      const BUYERS_MAX = 60;
      const buyers = ([...new Set(rows.map((r) => r.acheteur).filter(Boolean))] as string[]).slice(
        0,
        BUYERS_MAX,
      );
      const history = new Map<string, TenderWithContext["buyer_history"]>();
      const awards = new Map<string, TenderWithContext["buyer_awards"]>();
      if (buyers.length) {
        const [{ data: cards }, { data: attributions }] = await Promise.all([
          supabase
            .from("crm_cards")
            .select("id, title, company, sales_status, estimated_value, created_at")
            .in("company", buyers)
            .order("created_at", { ascending: false })
            .limit(100),
          // Les attributions passées du même acheteur : titulaire sortant et
          // montant, le signal de décision numéro un de la spec.
          supabase
            .from("tender_opportunities")
            .select("id, objet, acheteur, decision, dateparution, url_avis")
            .eq("nature", "ATTRIBUTION")
            .in("acheteur", buyers)
            .order("dateparution", { ascending: false })
            .limit(100),
        ]);
        for (const card of cards || []) {
          const key = card.company as string;
          if (!history.has(key)) history.set(key, []);
          history.get(key)!.push({
            id: card.id,
            title: card.title,
            sales_status: card.sales_status,
            estimated_value: card.estimated_value,
            created_at: card.created_at,
          });
        }
        for (const row of (attributions || []) as unknown as TenderOpportunity[]) {
          const key = row.acheteur as string;
          const titulaire = row.decision?.titulaire ?? null;
          if (!key || !titulaire) continue;
          if (!awards.has(key)) awards.set(key, []);
          awards.get(key)!.push({
            id: row.id,
            objet: row.objet,
            titulaire,
            montant: row.decision?.montant ?? null,
            dateparution: row.dateparution,
            url_avis: row.url_avis,
          });
        }
      }

      const items = rows.map((row) => ({
        ...row,
        decision: row.decision ?? {},
        buyer_history: (row.acheteur && history.get(row.acheteur)) || [],
        buyer_awards: (row.acheteur && awards.get(row.acheteur)?.slice(0, 3)) || [],
      }));
      return { items, total: count ?? items.length, truncated: (count ?? 0) > PAGE_MAX };

    },
  });
};

// ── No Go ────────────────────────────────────────────────────

/**
 * Le motif est obligatoire côté appelant : sans lui, l'historique des No Go
 * ne sert ni à affiner le filtrage ni à produire du contenu, et c'est le seul
 * usage qui justifie de conserver ces lignes.
 */
export const useTenderNoGo = () =>
  useCrmMutation(
    async ({
      id,
      reason,
      detail,
      actorEmail,
    }: {
      id: string;
      reason: string;
      detail?: string | null;
      actorEmail: string;
    }) => {
      const { error } = await supabase
        .from("tender_opportunities")
        .update({
          status: "no_go",
          no_go_reason: reason,
          no_go_detail: detail || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: actorEmail,
        })
        .eq("id", id);
      if (error) throw error;
    },
    { successMessage: "Opportunité écartée", invalidateKey: [TENDERS_QUERY_KEY] },
  );

/**
 * Remet une opportunité en attente de décision. Vaut pour un No Go comme pour
 * un Go : on se trompe dans les deux sens.
 *
 * Sur un Go, la carte CRM déjà créée n'est PAS supprimée — elle peut porter
 * des commentaires ou un devis. Seul le lien est défait, et l'appelant
 * prévient l'utilisateur pour qu'il aille la traiter dans le kanban. Sans ça,
 * l'avis resterait en `go` avec un crm_card_id pointant vers une carte
 * abandonnée.
 */
export const useTenderReopen = () =>
  useCrmMutation(
    async (id: string) => {
      const { error } = await supabase
        .from("tender_opportunities")
        .update({
          status: "to_review",
          no_go_reason: null,
          no_go_detail: null,
          reviewed_at: null,
          reviewed_by: null,
          crm_card_id: null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    { successMessage: "Opportunité remise en revue", invalidateKey: [TENDERS_QUERY_KEY] },
  );

// ── Go : promotion en carte CRM ──────────────────────────────

export interface TenderGoInput {
  tender: TenderOpportunity;
  serviceType: ServiceType;
  estimatedValue: number;
  columnId: string;
  tagId?: string | null;
  actorEmail: string;
}

/**
 * Crée la carte, la relie à l'avis, et pose la prochaine action au bon
 * intitulé. La carte reste dans le pipeline commun : seul le tag « Marché
 * public » permet de l'isoler dans les rapports.
 */
export const useTenderGo = () => {
  const queryClient = useQueryClient();
  const createCard = useCreateCard();

  return useCrmMutation(
    async ({ tender, serviceType, estimatedValue, columnId, tagId, actorEmail }: TenderGoInput) => {
      // Un second Go créerait une deuxième carte pour le même marché. Le cas
      // arrive si la liste n'a pas été rafraîchie entre deux onglets.
      if (tender.crm_card_id) {
        throw new Error("Cet appel d'offres a déjà une carte dans le CRM.");
      }

      const deadline = tender.datelimitereponse
        ? new Date(tender.datelimitereponse).toLocaleDateString("fr-FR")
        : null;
      const title = (tender.objet || "Appel d'offres").slice(0, 180);

      const dceUrl = safeUrl(tender.decision.url_dce);
      const avisUrl = safeUrl(tender.url_avis);
      const descriptionLines = [
        tender.acheteur ? `<p><strong>Acheteur :</strong> ${escapeHtml(tender.acheteur)}</p>` : "",
        deadline ? `<p><strong>Remise des offres avant le ${deadline}</strong></p>` : "",
        tender.decision.montant
          ? `<p><strong>Montant annoncé :</strong> ${tender.decision.montant.toLocaleString("fr-FR")} €</p>`
          : "",
        tender.decision.criteres?.length
          ? `<p><strong>Critères :</strong> ${escapeHtml(
              tender.decision.criteres
                .map((c) => `${c.libelle}${c.poids !== null ? ` ${c.poids}%` : ""}`)
                .join(", "),
            )}</p>`
          : "",
        dceUrl
          ? `<p><a href="${dceUrl}" target="_blank" rel="noopener noreferrer">Retirer le DCE</a></p>`
          : "",
        avisUrl
          ? `<p><a href="${avisUrl}" target="_blank" rel="noopener noreferrer">Voir l'avis</a></p>`
          : "",
      ].filter(Boolean);

      const card = await createCard.mutateAsync({
        input: {
          column_id: columnId,
          title,
          company: tender.acheteur || undefined,
          email: tender.decision.contact_email || undefined,
          service_type: serviceType,
          acquisition_source: "marche_public",
          estimated_value: estimatedValue,
          status_operational: "WAITING",
          waiting_next_action_date: todayParis(),
          waiting_next_action_text: "Retirer le DCE et décider de candidater",
          description_html: descriptionLines.join(""),
          raw_input: tender.url_avis || undefined,
        },
        actorEmail,
      });

      // La date limite pilote le suivi commercial : sans elle, la carte
      // stagnerait dans le pipeline sans échéance visible, et la bascule
      // automatique à J-7 ne pourrait pas la retrouver.
      // `next_action_type` n'est pas porté par CreateCardInput : il se pose ici
      // plutôt que d'élargir un type partagé par trois appelants.
      await supabase
        .from("crm_cards")
        .update({
          next_action_type: "other",
          expected_close_date: tender.datelimitereponse
            ? tender.datelimitereponse.slice(0, 10)
            : null,
        })
        .eq("id", card.id);

      if (tagId) {
        await supabase.from("crm_card_tags").insert({ card_id: card.id, tag_id: tagId });
      }

      const { error } = await supabase
        .from("tender_opportunities")
        .update({
          status: "go",
          crm_card_id: card.id,
          reviewed_at: new Date().toISOString(),
          reviewed_by: actorEmail,
        })
        .eq("id", tender.id);
      // La carte existe déjà à ce stade : un message générique ferait recliquer
      // sur Go et créerait un doublon. On dit explicitement quoi faire.
      if (error) {
        throw new Error(
          `La carte CRM a bien été créée mais l'avis n'a pas pu être marqué comme traité ` +
            `(${error.message}). Ne pas recliquer sur Go : l'opportunité est dans le kanban.`,
        );
      }

      notifyCrmSlack(
        "opportunity_created",
        {
          title,
          company: tender.acheteur || undefined,
          service_type: serviceType,
          estimated_value: estimatedValue || undefined,
          message: `Marché public — ${tender.url_avis ?? tender.source_ref}`,
        },
        actorEmail,
      );

      queryClient.invalidateQueries({ queryKey: [TENDERS_QUERY_KEY] });
      return card;
    },
    // Pas de successMessage ici : useCreateCard affiche déjà « Opportunité créée ».
    { invalidateKey: [TENDERS_QUERY_KEY] },
  );
};
