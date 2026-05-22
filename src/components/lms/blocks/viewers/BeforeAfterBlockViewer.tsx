import { useState, useRef, useCallback } from "react";
import { ArrowLeftRight } from "lucide-react";
import type { BeforeAfterBlockContent } from "@/types/lms-blocks";

interface Props {
  content: BeforeAfterBlockContent;
}

export default function BeforeAfterBlockViewer({ content }: Props) {
  const [splitPct, setSplitPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  if (!content.before_image_url && !content.after_image_url) return null;

  const updateSplit = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    setSplitPct(Math.max(3, Math.min(97, ((clientX - left) / width) * 100)));
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMove = (ev: MouseEvent) => { if (dragging.current) updateSplit(ev.clientX); };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const onMove = (ev: TouchEvent) => updateSplit(ev.touches[0].clientX);
    const onEnd = () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
  };

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl"
        style={{ aspectRatio: "16/9", userSelect: "none", cursor: "col-resize" }}
      >
        {/* After image — full width, underneath */}
        {content.after_image_url && (
          <img
            src={content.after_image_url}
            alt={content.after_label ?? "Après"}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            draggable={false}
          />
        )}
        {/* Before image — clipped from the right */}
        {content.before_image_url && (
          <img
            src={content.before_image_url}
            alt={content.before_label ?? "Avant"}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              clipPath: `inset(0 ${100 - splitPct}% 0 0)`,
            }}
            draggable={false}
          />
        )}

        {/* Divider handle */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${splitPct}%`,
            transform: "translateX(-50%)",
            width: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "col-resize",
            zIndex: 5,
          }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        >
          <div style={{ width: 3, height: "100%", background: "#FFD100", position: "absolute" }} />
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#FFD100",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              position: "relative",
            }}
          >
            <ArrowLeftRight size={16} style={{ color: "#101820" }} />
          </div>
        </div>

        {/* Labels */}
        {content.before_label && (
          <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: "0.75rem", fontWeight: 600, pointerEvents: "none" }}>
            {content.before_label}
          </div>
        )}
        {content.after_label && (
          <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: "0.75rem", fontWeight: 600, pointerEvents: "none" }}>
            {content.after_label}
          </div>
        )}
      </div>
      {content.caption && (
        <p className="text-xs text-center" style={{ color: "rgba(16,24,32,0.5)" }}>{content.caption}</p>
      )}
    </div>
  );
}
