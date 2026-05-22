import { useState } from "react";
import { X } from "lucide-react";
import type { ImageHotspotBlockContent } from "@/types/lms-blocks";

interface Props {
  content: ImageHotspotBlockContent;
}

export default function ImageHotspotBlockViewer({ content }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const hotspots = content.hotspots ?? [];

  if (!content.image_url) return null;

  return (
    <div className="relative w-full select-none" style={{ userSelect: "none" }}>
      <img
        src={content.image_url}
        alt=""
        className="w-full rounded-xl block"
        draggable={false}
        onClick={() => setActiveId(null)}
      />
      {hotspots.map((spot, i) => (
        <div
          key={spot.id}
          style={{
            position: "absolute",
            left: `${spot.x_pct}%`,
            top: `${spot.y_pct}%`,
            transform: "translate(-50%, -50%)",
            zIndex: 2,
          }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setActiveId(activeId === spot.id ? null : spot.id); }}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: activeId === spot.id ? "#FFD100" : "#101820",
              color: activeId === spot.id ? "#101820" : "#ffffff",
              border: "2.5px solid white",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "inherit",
            }}
            aria-label={spot.label}
          >
            {i + 1}
          </button>

          {activeId === spot.id && (
            <div
              style={{
                position: "absolute",
                zIndex: 10,
                top: 36,
                left: "50%",
                transform: "translateX(-50%)",
                background: "#ffffff",
                borderRadius: 12,
                padding: "0.75rem 1rem",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                border: "1px solid #e5e7eb",
                minWidth: 180,
                maxWidth: 260,
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-bold text-sm" style={{ color: "#101820" }}>{spot.label}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveId(null); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0, flexShrink: 0 }}
                >
                  <X size={14} />
                </button>
              </div>
              {spot.description_html && (
                <div
                  className="prose prose-xs max-w-none text-xs"
                  dangerouslySetInnerHTML={{ __html: spot.description_html }}
                />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
