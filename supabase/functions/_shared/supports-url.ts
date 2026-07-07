/**
 * Liens supports de formation dans les emails.
 *
 * Le player LMS public identifie l'apprenant par le paramètre ?email= de
 * l'URL (pas de login). Tout lien vers /formation-support/ ou /lms/ envoyé
 * par email DOIT donc être personnalisé par destinataire, sinon le
 * participant obtient "Accès non autorisé" (règle 035 d'IMPROVEMENTS.md).
 *
 * Deux mécanismes complémentaires :
 *  - resolveSupportsUrlBase() + appendEmailParam() pour la variable
 *    {{supports_url}} des templates ;
 *  - personalizeSupportsLinks() en balayage final sur le HTML, qui couvre
 *    aussi les liens collés en dur dans un template personnalisé.
 */

export function appendEmailParam(url: string, email: string | null | undefined): string {
  if (!url || !email) return url;
  if (/[?&]email=/.test(url)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}email=${encodeURIComponent(email)}`;
}

/**
 * Résout l'URL de base des supports d'une formation :
 * - supports_url explicite si renseigné,
 * - sinon /formation-support/<id> si un cours LMS est lié ou si un support
 *   éditeur existe,
 * - sinon "" (pas de lien).
 */
export async function resolveSupportsUrlBase(
  // deno-lint-ignore no-explicit-any
  supabase: { from: (table: string) => any },
  training: { supports_url?: string | null; supports_lms_course_id?: string | null },
  trainingId: string,
  baseUrl: string,
): Promise<string> {
  if (training.supports_url) return training.supports_url;
  if (training.supports_lms_course_id) return `${baseUrl}/formation-support/${trainingId}`;
  const { data: supportRecord } = await supabase
    .from("training_supports")
    .select("id")
    .eq("training_id", trainingId)
    .maybeSingle();
  return supportRecord ? `${baseUrl}/formation-support/${trainingId}` : "";
}

/**
 * Ajoute ?email=<destinataire> à tous les liens internes vers les supports
 * (/formation-support/, /lms/) présents dans un contenu texte ou HTML, s'il
 * manque. Les URLs externes (Drive, Notion, ...) ne sont pas modifiées.
 */
export function personalizeSupportsLinks(
  content: string,
  email: string | null | undefined,
): string {
  if (!content || !email) return content;
  return content.replace(
    /https?:\/\/[^\s"'<>()]+\/(?:formation-support|lms)\/[^\s"'<>()]*/g,
    (match) => {
      // Ne pas absorber la ponctuation de fin de phrase dans l'URL.
      const trailing = match.match(/[.,;:!]+$/)?.[0] ?? "";
      const url = trailing ? match.slice(0, -trailing.length) : match;
      return appendEmailParam(url, email) + trailing;
    },
  );
}
