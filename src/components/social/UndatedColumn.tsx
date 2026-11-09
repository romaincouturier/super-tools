import ContentCard from "@/components/social/ContentCard";
import type { CalendarCard, SocialChannel, SocialTheme } from "@/services/socialContents";

interface UndatedColumnProps {
  cards: CalendarCard[];
  channelsById: Map<string, SocialChannel>;
  themesById: ReadonlyMap<string, SocialTheme>;
  onOpen: (groupId: string) => void;
}

export default function UndatedColumn({ cards, channelsById, themesById, onOpen }: UndatedColumnProps) {
  return (
    <aside className="w-full lg:w-60 shrink-0 rounded-lg bg-muted/30 p-2 space-y-2" aria-label="Non planifiés">
      <h2 className="text-sm font-semibold px-1">Non planifiés · {cards.length}</h2>
      {cards.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1">Aucun brouillon sans date.</p>
      ) : (
        <div className="space-y-1.5">
          {cards.map((card) => <ContentCard key={card.group.id} card={card} channelsById={channelsById} themesById={themesById} onOpen={onOpen} />)}
        </div>
      )}
    </aside>
  );
}
