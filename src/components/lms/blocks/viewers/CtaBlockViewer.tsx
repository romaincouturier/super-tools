import DOMPurify from "dompurify";
import type { CtaBlockContent } from "@/types/lms-blocks";

interface Props {
  content: CtaBlockContent;
}

/** Trait souligné dessiné à la main, sous le petit label. */
function HandDrawnUnderline({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 10" className="absolute -bottom-1.5 left-0 w-full h-2.5" preserveAspectRatio="none" aria-hidden="true">
      <path d="M3 7 C 28 2, 62 9, 117 4" stroke={color} strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Petite flèche courbe dessinée à la main, pointant vers le bouton. */
function HandDrawnArrow() {
  return (
    <svg viewBox="0 0 64 40" className="hidden sm:block h-9 w-14 shrink-0 opacity-30" aria-hidden="true">
      <path d="M6 8 C 14 30, 38 36, 54 26" stroke="#101820" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M54 26 l-9 -1 m9 1 l-3 -8" stroke="#101820" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function CtaBlockViewer({ content }: Props) {
  if (!content.label && !content.title && !content.body_html && !content.image_url && !content.button_label) return null;

  const accent = content.accent_color ?? "#FFD100";
  const hasUrl = !!content.button_url;
  const newTab = content.open_in_new_tab !== false;
  const benefits = (content.benefits ?? []).filter(Boolean).slice(0, 3);
  const linkTarget = newTab ? { target: "_blank", rel: "noopener noreferrer" } : {};

  const primaryButtonClass =
    "inline-flex items-center justify-center whitespace-normal text-center font-bold text-[0.9375rem] rounded-full px-7 py-3 transition-all hover:-translate-y-px hover:shadow-lg";
  const primaryButtonStyle: React.CSSProperties = {
    background: "#101820",
    color: accent,
    boxShadow: "0 4px 14px rgba(16, 24, 32, 0.22)",
  };

  return (
    <div
      className="relative bg-white px-6 py-7 sm:px-9 sm:py-8"
      style={{
        borderRadius: 28,
        border: "1px solid #ECECEF",
        boxShadow: "0 10px 34px rgba(16, 24, 32, 0.07)",
      }}
    >
      {content.badge && (
        <span
          className="absolute right-5 top-0 -translate-y-1/2 rotate-[-2deg] rounded-full px-3.5 py-1.5 text-xs font-extrabold shadow-sm"
          style={{ background: accent, color: "#101820" }}
        >
          {content.badge}
        </span>
      )}

      <div className={`grid gap-7 items-center ${content.image_url ? "md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]" : ""}`}>
        <div className="min-w-0">
          {content.label && (
            <span className="relative inline-block text-xs font-bold uppercase tracking-[0.14em] pb-1" style={{ color: "#101820" }}>
              {content.label}
              <HandDrawnUnderline color={accent} />
            </span>
          )}

          {content.title && (
            <h3 className="mt-3 text-2xl sm:text-[1.75rem] font-extrabold leading-tight break-words" style={{ color: "#101820" }}>
              {content.title}
            </h3>
          )}
          {content.subtitle && (
            <p className="mt-1.5 text-base font-bold break-words" style={{ color: "#101820" }}>
              {content.subtitle}
            </p>
          )}

          {content.body_html && (
            <div
              className="prose max-w-none mt-3 break-words text-[0.9375rem] leading-relaxed"
              style={{ color: "#3F4753" }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content.body_html) }}
            />
          )}

          {benefits.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Bénéfices">
              {benefits.map((b) => (
                <li
                  key={b}
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
                  style={{ background: "#F7F7F8", border: "1px solid #ECECEF", color: "#101820" }}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: accent }} aria-hidden="true" />
                  {b}
                </li>
              ))}
            </ul>
          )}

          {(content.button_label || content.secondary_label) && (
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
              <HandDrawnArrow />
              {content.button_label && (
                hasUrl ? (
                  <a href={content.button_url} {...linkTarget} className={primaryButtonClass} style={primaryButtonStyle}>
                    {content.button_label}
                  </a>
                ) : (
                  <span className={primaryButtonClass} style={primaryButtonStyle}>{content.button_label}</span>
                )
              )}
              {content.secondary_label && content.secondary_url && (
                <a
                  href={content.secondary_url}
                  {...linkTarget}
                  className="text-sm font-semibold underline underline-offset-4 decoration-2 transition-colors hover:opacity-70"
                  style={{ color: "#101820", textDecorationColor: accent }}
                >
                  {content.secondary_label} →
                </a>
              )}
            </div>
          )}
        </div>

        {content.image_url && (
          <img
            src={content.image_url}
            alt={content.title ?? "Illustration"}
            className="w-full rounded-2xl object-cover md:aspect-[4/3]"
            style={{ boxShadow: "0 6px 22px rgba(16, 24, 32, 0.10)" }}
          />
        )}
      </div>
    </div>
  );
}
