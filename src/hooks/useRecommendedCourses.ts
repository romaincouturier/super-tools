import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { expertiseLabel } from "@/lib/lmsCourseMeta";
import { HIDDEN_FREE_COURSE_IDS } from "@/lib/academyFreeCourses";
import { extractCity, formatSessionDays, type UpcomingSessionRow } from "@/lib/lmsUpcomingSessions";

export type RecoCourse = {
  id: string;
  /** « course » : cours LMS gratuit public. « session » : prochaine session inter d'une formation du catalogue. */
  kind: "course" | "session";
  /** Dates et lieu de la session inter (kind = "session"). */
  session_label: string | null;
  session_is_full: boolean;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  estimated_duration_minutes: number | null;
  boutique_url: string;
  prix: number | null;
  expertise: string | null;
  /** Raison affichable de la recommandation (accroche secondaire). */
  reason: string;
};

const SHOP_BASE = "https://supertilt.fr";

/**
 * Lien vers la fiche produit supertilt.fr. Trois niveaux, du plus précis au
 * plus générique, pour qu'une recommandation ait TOUJOURS une destination
 * valide (le bloc ne doit jamais être vide faute de lien).
 */
function resolveBoutiqueUrl(
  supertiltLink: string | null | undefined,
  wcProductId: number | null | undefined,
  title: string,
): string {
  if (supertiltLink && /^https?:\/\//i.test(supertiltLink) && !/\/lms\//i.test(supertiltLink)) {
    return supertiltLink;
  }
  if (wcProductId) return `${SHOP_BASE}/?post_type=product&p=${wcProductId}`;
  return `${SHOP_BASE}/?post_type=product&s=${encodeURIComponent(title)}`;
}

/** Rapprochement souple d'un cours LMS et d'une fiche catalogue par le nom. */
function nameMatches(courseTitle: string, configName: string): boolean {
  const t = (courseTitle || "").toLowerCase();
  const n = (configName || "").toLowerCase();
  if (!t || !n) return false;
  if (n.includes(t) || t.includes(n)) return true;
  return n.split(" ").filter((w) => w.length > 4).some((w) => t.includes(w));
}

type InterSessionRow = UpcomingSessionRow & {
  catalog_id: string;
  formation_name: string;
  supertilt_link: string | null;
  prix: number | null;
};

type Config = {
  id: string;
  formation_name: string;
  supertilt_link: string | null;
  prix: number | null;
  format_formation: string | null;
};

/**
 * Formations à proposer à l'apprenant : sessions inter à venir (une par
 * formation du catalogue, la plus proche) et cours LMS gratuits publics.
 * Sont exclus : les cours déjà possédés, les sessions auxquelles l'apprenant
 * participe, les sessions d'une formation dont il possède déjà le cours, les
 * cours intra / clients et les cours retirés des vitrines publiques.
 *
 * Priorités (ST) : 1) même expertise que les formations suivies,
 * 2) expertise complémentaire, 3) à défaut, le reste mis en avant (fiche
 * catalogue et lien boutique identifiés en premier).
 */
export function useRecommendedCourses(excludedCourseIds: string[], excludedTrainingIds: string[] = []) {
  const [courses, setCourses] = useState<RecoCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const excludedKey = `${excludedCourseIds.slice().sort().join(",")}|${excludedTrainingIds.slice().sort().join(",")}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [coursesRes, configsRes, formulasRes, sessionsRes] = await Promise.all([
        (supabase as any)
          .from("lms_courses")
          .select(
            "id, title, description, cover_image_url, estimated_duration_minutes, expertise, access_type, formation_config_id, created_at",
          )
          .eq("status", "published")
          .order("created_at", { ascending: true }),
        (supabase as any)
          .from("formation_configs")
          .select("id, formation_name, supertilt_link, prix, format_formation"),
        (supabase as any)
          .from("formation_formulas")
          .select("formation_config_id, woocommerce_product_id, prix, display_order")
          .not("woocommerce_product_id", "is", null)
          .order("display_order", { ascending: true }),
        (supabase.rpc as any)("get_recommended_inter_sessions", { _max_items: 100 }),
      ]);
      if (cancelled) return;

      const configs: Config[] = configsRes.data || [];
      const configById = new Map(configs.map((c) => [c.id, c]));
      const formulaByConfig = new Map<string, { woocommerce_product_id: number; prix: number | null }>();
      for (const f of formulasRes.data || []) {
        if (!formulaByConfig.has(f.formation_config_id)) {
          formulaByConfig.set(f.formation_config_id, {
            woocommerce_product_id: f.woocommerce_product_id,
            prix: f.prix,
          });
        }
      }

      const all: any[] = coursesRes.data || [];
      const excludedSet = new Set(excludedCourseIds);

      // Expertises et fiches catalogue déjà abordées par l'apprenant. Les cours
      // possédés peuvent être intra ou non publiés : on les lit en base.
      const ownedExpertises = new Set<string>();
      const ownedCatalogIds = new Set<string>();
      if (excludedCourseIds.length > 0) {
        const ownedRes = await (supabase as any)
          .from("lms_courses")
          .select("expertise, formation_config_id")
          .in("id", excludedCourseIds);
        if (cancelled) return;
        for (const o of ownedRes.data || []) {
          if (o.expertise) ownedExpertises.add(o.expertise);
          if (o.formation_config_id) ownedCatalogIds.add(o.formation_config_id);
        }
      }

      const isIntra = (c: any) =>
        (c.access_type ?? "gratuit") === "intra" || c.expertise === "intra_clients";
      const isFreePublic = (c: any) =>
        (c.access_type ?? "gratuit") === "gratuit" && !HIDDEN_FREE_COURSE_IDS.has(c.id);

      // Expertise d'une fiche catalogue : celle du cours LMS qui lui est rattaché.
      const expertiseByCatalog = new Map<string, string>();
      for (const c of all) {
        if (c.formation_config_id && c.expertise && !expertiseByCatalog.has(c.formation_config_id)) {
          expertiseByCatalog.set(c.formation_config_id, c.expertise);
        }
      }

      const excludedTrainingSet = new Set(excludedTrainingIds);
      const nextSessionByCatalog = new Map<string, InterSessionRow>();
      for (const r of (sessionsRes?.data || []) as InterSessionRow[]) {
        if (excludedTrainingSet.has(r.session_id) || ownedCatalogIds.has(r.catalog_id)) continue;
        if (!nextSessionByCatalog.has(r.catalog_id)) nextSessionByCatalog.set(r.catalog_id, r);
      }

      const rank = (expertise: string | null, hasCatalog: boolean, hasLink: boolean) => {
        const label = expertiseLabel(expertise);
        const sameExpertise = !!expertise && ownedExpertises.has(expertise);
        // Score : continuité > complémentaire > mise en avant.
        let score = 1;
        let reason = "Sélection Supertilt";
        if (sameExpertise) {
          score = 3;
          reason = label ? `Pour aller plus loin en ${label.toLowerCase()}` : "Dans la continuité de votre parcours";
        } else if (label && ownedExpertises.size > 0) {
          score = 2;
          reason = `Une compétence complémentaire : ${label.toLowerCase()}`;
        } else if (label) {
          reason = label;
        }
        // Bonus de mise en avant : fiche catalogue identifiée et lien boutique.
        if (hasCatalog) score += 0.3;
        if (hasLink) score += 0.2;
        return { score, reason };
      };

      const courseItems = all
        .filter((c) => !excludedSet.has(c.id) && !isIntra(c) && isFreePublic(c))
        .map((c) => {
          const cfg: Config | undefined =
            (c.formation_config_id ? configById.get(c.formation_config_id) : undefined) ??
            configs.find((k) => nameMatches(c.title, k.formation_name));
          const formula = cfg ? formulaByConfig.get(cfg.id) : undefined;
          const boutique_url = resolveBoutiqueUrl(
            cfg?.supertilt_link,
            formula?.woocommerce_product_id,
            c.title,
          );
          const { score, reason } = rank(
            c.expertise ?? null,
            !!cfg,
            !!(cfg?.supertilt_link || formula?.woocommerce_product_id),
          );
          return {
            score,
            course: {
              id: c.id,
              kind: "course",
              session_label: null,
              session_is_full: false,
              title: c.title,
              description: c.description,
              cover_image_url: c.cover_image_url,
              estimated_duration_minutes: c.estimated_duration_minutes,
              boutique_url,
              prix: 0,
              expertise: c.expertise ?? null,
              reason,
            } as RecoCourse,
          };
        });

      const sessionItems = [...nextSessionByCatalog.values()].map((r) => {
        const cfg = configById.get(r.catalog_id);
        const formula = formulaByConfig.get(r.catalog_id);
        const expertise = expertiseByCatalog.get(r.catalog_id) ?? null;
        const supertiltLink = r.supertilt_link ?? cfg?.supertilt_link;
        const boutique_url = resolveBoutiqueUrl(supertiltLink, formula?.woocommerce_product_id, r.formation_name);
        const { score, reason } = rank(expertise, true, !!(supertiltLink || formula?.woocommerce_product_id));
        const city = extractCity(r.city);
        return {
          score,
          course: {
            id: `session:${r.session_id}`,
            kind: "session",
            session_label: `${formatSessionDays(r)}${city ? ` · ${city}` : ""}`,
            session_is_full: r.is_full,
            title: r.formation_name,
            description: null,
            cover_image_url: null,
            estimated_duration_minutes: null,
            boutique_url,
            prix: formula?.prix ?? r.prix ?? cfg?.prix ?? null,
            expertise,
            reason,
          } as RecoCourse,
        };
      });

      const scored = [...sessionItems, ...courseItems]
        .sort((a, b) => b.score - a.score)
        .map((x) => x.course);

      setCourses(scored);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [excludedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { courses, loading };
}
