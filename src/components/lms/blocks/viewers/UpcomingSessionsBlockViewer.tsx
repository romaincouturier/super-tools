import DOMPurify from "dompurify";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { UpcomingSessionsBlockContent } from "@/types/lms-blocks";
import { extractCity, formatSessionDays, type UpcomingSessionRow } from "@/lib/lmsUpcomingSessions";

interface Props {
  content: UpcomingSessionsBlockContent;
}

// Couleurs de marque SuperTilt imposées par la charte du bloc.
const YELLOW = "#FFD100";
const INK = "#101820";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function useUpcomingSessions(catalogIds: string[], maxItems: number) {
  return useQuery({
    queryKey: ["lms-upcoming-sessions", catalogIds.join(","), maxItems],
    enabled: catalogIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpc = supabase.rpc as any;
      const [{ data, error }, page] = await Promise.all([
        rpc("get_lms_upcoming_sessions", { _catalog_ids: catalogIds, _max_items: maxItems }),
        rpc("get_lms_catalog_page_url", { _catalog_id: catalogIds[0] }),
      ]);
      if (error) throw error;
      return { sessions: (data ?? []) as UpcomingSessionRow[], pageUrl: (page?.data as string | null) ?? null };
    },
  });
}

function SessionsCard({ content }: Props) {
  const ids = (content.catalog_ids ?? []).filter((id) => UUID_RE.test(id));
  const max = Math.min(Math.max(Number(content.max_items) || 4, 1), 20);
  const { data, isLoading, isError } = useUpcomingSessions(ids, max);
  const title = content.title ?? "📍 Prochaines sessions";
  const fallbackUrl = content.fallback_url || data?.pageUrl || null;

  return (
    <div className="rounded-3xl bg-white p-5 sm:p-6 shadow-sm" style={{ color: INK }}>
      {title && <p className="font-bold text-base mb-3">{title}</p>}
      {isLoading && ids.length > 0 ? (
        <p className="text-sm opacity-60">Chargement des dates…</p>
      ) : isError ? (
        <p className="text-sm opacity-60">Dates momentanément indisponibles.</p>
      ) : !data || data.sessions.length === 0 ? (
        <div className="text-sm space-y-1">
          <p>Prochaines dates bientôt annoncées</p>
          {fallbackUrl && (
            <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
              Voir la formation
            </a>
          )}
        </div>
      ) : (
        <ul className="divide-y" style={{ borderColor: "rgba(16,24,32,0.1)" }}>
          {data.sessions.map((s) => (
            <li key={s.session_id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{extractCity(s.city) ?? "Lieu à confirmer"}</p>
                <p className="text-sm opacity-70">{formatSessionDays(s)}</p>
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={s.is_full ? { background: "rgba(16,24,32,0.08)", color: INK } : { background: YELLOW, color: INK }}
              >
                {s.is_full ? "Complet" : "Inscriptions ouvertes"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {content.footer_text && <p className="mt-4 text-xs opacity-60">{content.footer_text}</p>}
    </div>
  );
}

export default function UpcomingSessionsBlockViewer({ content }: Props) {
  if ((content.layout ?? "list") === "list") return <SessionsCard content={content} />;

  const dark = content.theme === "dark";
  const bg = dark ? INK : YELLOW;
  const fg = dark ? "#FFFFFF" : INK;
  const btnBg = dark ? YELLOW : INK;
  const btnFg = dark ? INK : "#FFFFFF";

  return (
    <div className="rounded-[2rem] p-6 sm:p-10" style={{ background: bg, color: fg }}>
      <div className="grid gap-6 md:grid-cols-[1fr_minmax(0,22rem)] md:items-center">
        <div className="space-y-4">
          {content.cta_label && <p className="text-xs font-bold uppercase tracking-wider opacity-80">{content.cta_label}</p>}
          {content.cta_title && <h3 className="text-2xl sm:text-3xl font-extrabold leading-tight">{content.cta_title}</h3>}
          {content.body_html && (
            <div
              className="prose prose-sm max-w-none [&_*]:!text-inherit"
              style={{ color: fg }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content.body_html) }}
            />
          )}
          {(content.button_label && content.button_url) || (content.secondary_label && content.secondary_url) ? (
            <div className="flex flex-wrap items-center gap-4 pt-1">
              {content.button_label && content.button_url && (
                <a
                  href={content.button_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold"
                  style={{ background: btnBg, color: btnFg }}
                >
                  {content.button_label}
                  <ArrowRight className="h-4 w-4" />
                </a>
              )}
              {content.secondary_label && content.secondary_url && (
                <a href={content.secondary_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline underline-offset-4">
                  {content.secondary_label}
                </a>
              )}
            </div>
          ) : null}
        </div>
        <SessionsCard content={content} />
      </div>
    </div>
  );
}
