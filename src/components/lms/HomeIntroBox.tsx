import { Sparkles, CheckCircle2 } from "lucide-react";
import type { CourseHomeConfig } from "@/hooks/useLmsQueries";
import { resolveIntroBox } from "@/lib/lmsCourseHome";

/**
 * Encadré d'introduction de la page d'accueil d'une formation
 * (ST-2026-0254). Rendu partagé entre l'accueil apprenant et l'aperçu de
 * l'écran de réglages, pour que l'aperçu soit fidèle par construction.
 */
export default function HomeIntroBox({ config }: { config?: CourseHomeConfig | null }) {
  const box = resolveIntroBox(config);
  if (!box) return null;
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ background: "#fff", boxShadow: "0 2px 8px rgba(16,24,32,0.06)", border: "1px solid rgba(16,24,32,0.06)" }}
    >
      <div className="flex items-center gap-2.5">
        <Sparkles size={16} className="shrink-0" style={{ color: "#FFD100" }} />
        <p className="text-sm font-bold" style={{ color: "var(--st-ink)" }}>{box.title}</p>
      </div>
      <ul className="space-y-2.5">
        {box.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" style={{ color: "#69C3C4" }} />
            <p className="text-sm leading-snug break-words" style={{ color: "var(--st-ink-muted)" }}>{item}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
