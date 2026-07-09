import DOMPurify from "dompurify";
import { ArrowRight, Check, Star } from "lucide-react";
import type { CtaBlockContent } from "@/types/lms-blocks";

interface Props {
  content: CtaBlockContent;
}

const INK = "#101820";

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
      <path d="M6 8 C 14 30, 38 36, 54 26" stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M54 26 l-9 -1 m9 1 l-3 -8" stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Rend le titre en surlignant les segments entourés d'astérisques : `*mot*`. */
function renderAccentedTitle(title: string, accent: string) {
  const parts = title.split(/\*([^*]+)\*/g);
  if (parts.length === 1) return title;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} style={{ background: `linear-gradient(transparent 60%, ${accent} 60%)`, padding: "0 0.1em" }}>
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
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
    "inline-flex items-center gap-2 justify-center whitespace-normal text-center font-bold text-[0.9375rem] rounded-full px-7 py-3 transition-all hover:-translate-y-px hover:shadow-lg";
  const primaryButtonStyle: React.CSSProperties = {
    background: INK,
    color: accent,
    boxShadow: "0 4px 14px rgba(16, 24, 32, 0.22)",
  };

  return (
    <div
      className="relative bg-white px-6 py-7 sm:px-9 sm:py-9"
      style={{
        borderRadius: 28,
        border: "1px solid #ECECEF",
        boxShadow: "0 10px 34px rgba(16, 24, 32, 0.07)",
      }}
    >
      {content.badge && !content.image_url && (
        <span
          className="absolute right-5 top-0 -translate-y-1/2 rotate-[-2deg] rounded-full px-3.5 py-1.5 text-xs font-extrabold shadow-sm"
          style={{ background: accent, color: INK }}
        >
          {content.badge}
        </span>
      )}

      <div className={`grid gap-8 items-center ${content.image_url ? "md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]" : ""}`}>
        <div className="min-w-0">
          {content.label && (
            <span className="inline-flex items-center gap-2.5">
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
                style={{ background: accent, color: INK }}
                aria-hidden="true"
              >
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              <span className="relative inline-block text-xs font-bold uppercase tracking-[0.14em] pb-1" style={{ color: INK }}>
                {content.label}
                <HandDrawnUnderline color={accent} />
              </span>
            </span>
          )}

          {content.title && (
            <h3 className="mt-3 text-2xl sm:text-3xl font-extrabold leading-tight break-words" style={{ color: INK }}>
              {renderAccentedTitle(content.title, accent)}
            </h3>
          )}
          {content.subtitle && (
            <p className="mt-1.5 text-base font-bold break-words" style={{ color: INK }}>
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
            <ul className="mt-5 flex flex-wrap gap-2.5" aria-label="Bénéfices">
              {benefits.map((b) => (
                <li
                  key={b}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold"
                  style={{ border: "1px solid #F1F1F4", color: INK, boxShadow: "0 2px 10px rgba(16, 24, 32, 0.08)" }}
                >
                  <span
                    className="grid h-4 w-4 shrink-0 place-items-center rounded-full"
                    style={{ background: accent, color: INK }}
                    aria-hidden="true"
                  >
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
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
                    <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                  </a>
                ) : (
                  <span className={primaryButtonClass} style={primaryButtonStyle}>
                    {content.button_label}
                    <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                  </span>
                )
              )}
              {content.secondary_label && content.secondary_url && (
                <a
                  href={content.secondary_url}
                  {...linkTarget}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4 decoration-2 transition-colors hover:opacity-70"
                  style={{ color: INK, textDecorationColor: accent }}
                >
                  {content.secondary_label}
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </a>
              )}
            </div>
          )}
        </div>

        {content.image_url && (
          <div className="relative mx-auto w-full max-w-[320px]">
            <img
              src={content.image_url}
              alt={content.title ?? "Illustration"}
              className="aspect-[4/3] w-full object-cover"
              style={{
                borderRadius: "42% 58% 52% 48% / 55% 46% 54% 45%",
                boxShadow: "0 6px 22px rgba(16, 24, 32, 0.10)",
              }}
            />
            {content.badge && (
              <span
                className="absolute -right-2 -top-3 grid h-20 w-20 rotate-6 place-items-center rounded-full text-center shadow-md"
                style={{ background: accent, color: INK }}
              >
                <span className="grid place-items-center gap-0.5 px-1.5">
                  <Star className="h-4 w-4" fill="currentColor" strokeWidth={0} aria-hidden="true" />
                  <span className="text-[10px] font-extrabold leading-tight">{content.badge}</span>
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
