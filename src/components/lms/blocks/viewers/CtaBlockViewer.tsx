import DOMPurify from "dompurify";
import type { CtaBlockContent } from "@/types/lms-blocks";

interface Props {
  content: CtaBlockContent;
}

export default function CtaBlockViewer({ content }: Props) {
  if (!content.title && !content.body_html && !content.image_url && !content.button_label) return null;

  const accent = content.accent_color ?? "#FFD100";
  const hasUrl = !!content.button_url;
  const newTab = content.open_in_new_tab !== false;

  const buttonClass =
    "inline-flex items-center justify-center whitespace-normal text-center font-bold transition-all hover:-translate-y-px hover:shadow-lg";
  const buttonStyle: React.CSSProperties = {
    background: "#101820",
    color: "#FFD100",
    borderRadius: 999,
    padding: "0.75rem 1.75rem",
    fontSize: "0.9375rem",
    boxShadow: "0 4px 12px rgba(16, 24, 32, 0.25)",
  };

  return (
    <div
      className="bg-white px-6 py-6 sm:px-8"
      style={{ border: `6px solid ${accent}`, borderRadius: 28 }}
    >
      {content.title && (
        <h3 className="text-center text-2xl font-extrabold break-words" style={{ color: "#101820" }}>
          {content.title}
        </h3>
      )}
      {content.subtitle && (
        <p className="text-center text-base font-bold mt-2 break-words" style={{ color: "#101820" }}>
          {content.subtitle}
        </p>
      )}

      {(content.image_url || content.body_html) && (
        <div className={`mt-5 grid gap-6 items-center ${content.image_url && content.body_html ? "sm:grid-cols-2" : ""}`}>
          {content.image_url && (
            <img
              src={content.image_url}
              alt={content.title ?? "Illustration"}
              className="w-full rounded-2xl object-cover"
            />
          )}
          {content.body_html && (
            <div
              className="prose max-w-none break-words"
              style={{ color: "#101820" }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content.body_html) }}
            />
          )}
        </div>
      )}

      {content.button_label && (
        <div className="mt-6 flex justify-end">
          {hasUrl ? (
            <a
              href={content.button_url}
              target={newTab ? "_blank" : undefined}
              rel={newTab ? "noopener noreferrer" : undefined}
              className={buttonClass}
              style={buttonStyle}
            >
              {content.button_label}
            </a>
          ) : (
            <span className={buttonClass} style={buttonStyle}>{content.button_label}</span>
          )}
        </div>
      )}
    </div>
  );
}
