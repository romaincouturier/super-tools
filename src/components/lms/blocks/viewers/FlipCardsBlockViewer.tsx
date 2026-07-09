import { useState } from "react";
import type { FlipCardsBlockContent, FlipCard } from "@/types/lms-blocks";

interface Props {
  content: FlipCardsBlockContent;
}

const GRID_COLS = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"];

function textFontSize(text: string): string {
  if (text.length > 220) return "0.75rem";
  if (text.length > 110) return "0.8125rem";
  return "0.875rem";
}

export default function FlipCardsBlockViewer({ content }: Props) {
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const cards = content.cards ?? [];
  const height = content.card_height_px ?? 180;
  if (cards.length === 0) return null;

  const gridClass = GRID_COLS[Math.min(cards.length, 4) - 1];

  const toggle = (id: string) =>
    setFlipped((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className={`grid gap-4 ${gridClass}`}>
      {cards.map((card) => (
        <FlipCardItem
          key={card.id}
          card={card}
          height={height}
          isFlipped={flipped.has(card.id)}
          onFlip={() => toggle(card.id)}
        />
      ))}
    </div>
  );
}

function FlipCardItem({
  card,
  height,
  isFlipped,
  onFlip,
}: {
  card: FlipCard;
  height: number;
  isFlipped: boolean;
  onFlip: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onFlip}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer select-none"
      style={{ perspective: "1000px", minHeight: height }}
      aria-label={isFlipped ? "Retourner (recto)" : "Retourner (verso)"}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" || e.key === " " ? onFlip() : undefined}
    >
      {/* Inner — rotates */}
      <div
        style={{
          position: "relative",
          width: "100%",
          minHeight: height,
          transformStyle: "preserve-3d",
          transition: "transform 0.55s cubic-bezier(0.4,0.2,0.2,1)",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front */}
        <CardFace
          text={card.front_text}
          imageUrl={card.front_image_url}
          height={height}
          highlighted={hovered && !isFlipped}
          transform="rotateY(0deg)"
        />
        {/* Back */}
        <CardFace
          text={card.back_text}
          imageUrl={card.back_image_url}
          height={height}
          highlighted={hovered && isFlipped}
          transform="rotateY(180deg)"
          isBack
        />
      </div>
    </div>
  );
}

function CardFace({
  text,
  imageUrl,
  height,
  highlighted,
  transform,
  isBack = false,
}: {
  text?: string | null;
  imageUrl?: string | null;
  height: number;
  highlighted: boolean;
  transform: string;
  isBack?: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        minHeight: height,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform,
        borderRadius: 16,
        border: `2px solid ${highlighted ? "#FFD100" : "#e5e7eb"}`,
        backgroundColor: isBack ? "#fffef5" : "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem 1rem",
        gap: 8,
        transition: "border-color 0.15s",
        boxSizing: "border-box",
      }}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          style={{ maxWidth: "100%", maxHeight: 80, objectFit: "contain", borderRadius: 8, flexShrink: 0 }}
        />
      )}
      {text && (
        <div style={{ width: "100%", minHeight: 0, overflowY: "auto" }}>
          <p
            style={{
              margin: 0,
              textAlign: "center",
              fontSize: textFontSize(text),
              fontWeight: isBack ? 400 : 600,
              color: "#101820",
              lineHeight: 1.4,
              whiteSpace: "pre-line",
              overflowWrap: "break-word",
            }}
          >
            {text}
          </p>
        </div>
      )}
      {!text && !imageUrl && (
        <p style={{ margin: 0, color: "#9ca3af", fontSize: "0.75rem" }}>
          {isBack ? "Verso" : "Recto"}
        </p>
      )}
    </div>
  );
}
