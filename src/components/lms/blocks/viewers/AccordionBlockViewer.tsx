import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AccordionBlockContent } from "@/types/lms-blocks";

interface Props {
  content: AccordionBlockContent;
}

export default function AccordionBlockViewer({ content }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const items = content.items ?? [];
  if (items.length === 0) return null;

  return (
    <div className="max-w-2xl mx-auto w-full space-y-2">
      {content.title && (
        <p className="font-bold text-base mb-3" style={{ color: "#101820" }}>{content.title}</p>
      )}
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div
            key={item.id}
            style={{
              borderRadius: 12,
              border: `1.5px solid ${isOpen ? "rgba(255,209,0,0.5)" : "#e5e7eb"}`,
              overflow: "hidden",
              transition: "border-color 0.15s",
            }}
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
              style={{ background: isOpen ? "#FFFBEA" : "#ffffff", fontFamily: "inherit" }}
            >
              <span className="font-semibold text-sm" style={{ color: "#101820" }}>{item.question}</span>
              <ChevronDown
                size={16}
                style={{
                  color: "#101820",
                  flexShrink: 0,
                  transition: "transform 0.2s",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>
            {isOpen && (
              <div
                className="px-4 pb-4 pt-2"
                style={{ background: "#ffffff", borderTop: "1px solid rgba(255,209,0,0.25)" }}
              >
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: item.answer_html }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
