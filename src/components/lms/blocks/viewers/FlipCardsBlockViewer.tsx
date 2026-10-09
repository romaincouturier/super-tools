import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FlipCardsBlockContent, FlipCard } from "@/types/lms-blocks";

export default function FlipCardsBlockViewer({ content }: { content: FlipCardsBlockContent }) {
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const cards = content.cards ?? [];
  const height = content.card_height_px ?? 260;
  const twoColumns = cards.length === 2 || cards.length === 4;
  if (!cards.length) return null;
  return (
    <div className="flex min-w-0 flex-wrap justify-center gap-4">
      {cards.map((card) => (
        <Button key={card.id} type="button" variant="ghost"
          aria-label={flipped.has(card.id) ? "Retourner (recto)" : "Retourner (verso)"}
          aria-pressed={flipped.has(card.id)}
          onClick={(e) => {
            e.stopPropagation();
            setFlipped((prev) => {
              const next = new Set(prev);
              next.has(card.id) ? next.delete(card.id) : next.add(card.id);
              return next;
            });
          }}
          className={cn("group block min-w-0 basis-full shrink-0 whitespace-normal p-0 hover:bg-transparent sm:basis-[calc((100%-1rem)/2)] [perspective:1000px]", !twoColumns && "lg:basis-[calc((100%-2rem)/3)]")}
          style={{ height }}>
          <span className="relative block h-full w-full transition-transform duration-500 motion-reduce:transition-none [transform-style:preserve-3d]"
            style={{ transform: flipped.has(card.id) ? "rotateY(180deg)" : "rotateY(0deg)" }}>
            <CardFace card={card} isBack={false} hidden={flipped.has(card.id)} />
            <CardFace card={card} isBack hidden={!flipped.has(card.id)} />
          </span>
        </Button>
      ))}
    </div>
  );
}

function CardFace({ card, isBack, hidden }: { card: FlipCard; isBack: boolean; hidden: boolean }) {
  const image = isBack ? card.back_image_url : card.front_image_url;
  const text = isBack ? card.back_text : card.front_text;
  return (
    <span aria-hidden={hidden} className={cn(
      "absolute inset-0 flex h-full min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-border px-4 py-3 text-card-foreground [backface-visibility:hidden] [-webkit-backface-visibility:hidden] group-hover:border-accent",
      isBack ? "bg-accent/10 [transform:rotateY(180deg)]" : "bg-card",
    )}>
      {image && <img src={image} alt="" className={cn("w-full min-h-0 shrink-0 object-contain", !text ? "h-full" : isBack ? "h-[45%]" : "h-[68%]")} />}
      {text ? <span className={cn("block w-full min-h-0 overflow-y-auto whitespace-pre-line break-words", isBack ? "text-[1.05rem] font-normal leading-relaxed" : "text-xl font-bold leading-snug")}>{text}</span>
        : !image && <span className="text-base text-muted-foreground">{isBack ? "Verso" : "Recto"}</span>}
    </span>
  );
}
