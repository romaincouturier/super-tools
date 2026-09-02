import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { expertiseLabel } from "@/lib/lmsCourseMeta";

export type RecoCourse = {
  id: string;
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

type Config = {
  id: string;
  formation_name: string;
  supertilt_link: string | null;
  prix: number | null;
  format_formation: string | null;
};

/**
 * Formations à proposer à l'apprenant, hors formations déjà possédées.
 *
 * Priorités (ST) : 1) même expertise que les formations suivies,
 * 2) expertise complémentaire, 3) à défaut, le reste du catalogue mis en
 * avant (payant et rattaché à une fiche catalogue en premier).
 * Les formations intra / clients ne sont jamais recommandées.
 */
export function useRecommendedCourses(excludedCourseIds: string[]) {
  const [courses, setCourses] = useState<RecoCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const excludedKey = excludedCourseIds.slice().sort().join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [coursesRes, configsRes, formulasRes] = await Promise.all([
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

      // Expertises déjà abordées par l'apprenant : sert à distinguer
      // « continuité du parcours » et « expertise complémentaire ».
      const ownedExpertises = new Set(
        all.filter((c) => excludedSet.has(c.id)).map((c) => c.expertise).filter(Boolean),
      );
      if (excludedCourseIds.length > 0 && ownedExpertises.size === 0) {
        // Les formations possédées peuvent être intra ou non publiées : on
        // complète depuis la base pour ne pas perdre le signal d'expertise.
        const ownedRes = await (supabase as any)
          .from("lms_courses")
          .select("expertise")
          .in("id", excludedCourseIds);
        if (cancelled) return;
        for (const o of ownedRes.data || []) if (o.expertise) ownedExpertises.add(o.expertise);
      }

      const isIntra = (c: any) =>
        (c.access_type ?? "gratuit") === "intra" || c.expertise === "intra_clients";

      const scored = all
        .filter((c) => !excludedSet.has(c.id) && !isIntra(c))
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
          const sameExpertise = !!c.expertise && ownedExpertises.has(c.expertise);
          const label = expertiseLabel(c.expertise);

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
          // Bonus de mise en avant : fiche catalogue identifiée et offre payante.
          if (cfg) score += 0.3;
          if (cfg?.supertilt_link || formula?.woocommerce_product_id) score += 0.2;
          if ((c.access_type ?? "gratuit") === "payant") score += 0.1;

          return {
            score,
            course: {
              id: c.id,
              title: c.title,
              description: c.description,
              cover_image_url: c.cover_image_url,
              estimated_duration_minutes: c.estimated_duration_minutes,
              boutique_url,
              prix: formula?.prix ?? cfg?.prix ?? null,
              expertise: c.expertise ?? null,
              reason,
            } as RecoCourse,
          };
        })
        .sort((a, b) => b.score - a.score)
        .map((x) => x.course);

      setCourses(scored);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [excludedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { courses, loading };
}
