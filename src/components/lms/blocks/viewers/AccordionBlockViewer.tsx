import DOMPurify from "dompurify";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AccordionBlockContent } from "@/types/lms-blocks";

/** Les liens de la réponse s'ouvrent dans un nouvel onglet pour ne pas
 * interrompre le cours (ST-2026-0229) — y compris le HTML historique
 * saisi à la main sans attribut target. */
function sanitizeAnswerHtml(html: string): string {
  const doc = new DOMParser().parseFromString(DOMPurify.sanitize(html), "text/html");
  for (const a of doc.querySelectorAll("a[href]")) {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  }
  return doc.body.innerHTML;
}

interface Props {
  content: AccordionBlockContent;
}

export default function AccordionBlockViewer({ content }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const items = content.items ?? [];
  if (items.length === 0) return null;

  return (
    <div className="max-w-[800px] w-full space-y-2">
      {content.title && (
        <p className="font-bold text-base mb-3" style={{ color: "hsl(var(--ink))" }}>{content.title}</p>
      )}
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div
            key={item.id}
            style={{
              borderRadius: 12,
              border: `1.5px solid ${isOpen ? "hsl(var(--yellow-brand) / 0.5)" : "hsl(var(--border))"}`,
              overflow: "hidden",
              transition: "border-color 0.15s",
            }}
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
              style={{ background: isOpen ? "hsl(var(--feedback-warning-surface))" : "hsl(var(--white))", fontFamily: "inherit" }}
            >
              <span className="font-semibold text-sm" style={{ color: "hsl(var(--ink))" }}>{item.question}</span>
              <ChevronDown
                size={16}
                style={{
                  color: "hsl(var(--ink))",
                  flexShrink: 0,
                  transition: "transform 0.2s",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>
            {isOpen && (
              <div
                className="px-4 pb-4 pt-2"
                style={{ background: "hsl(var(--white))", borderTop: "1px solid hsl(var(--yellow-brand) / 0.25)" }}
              >
                <div
                  className="prose prose-sm max-w-none [&_a]:text-primary [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: sanitizeAnswerHtml(item.answer_html) }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
