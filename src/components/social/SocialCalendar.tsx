import { useDroppable } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, StickyNote } from "lucide-react";
import CalendarNote from "@/components/social/CalendarNote";
import ContentCard, { STATUS_DOT_CLASSES } from "@/components/social/ContentCard";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  DISPLAY_STATUS_LABELS,
  DISPLAY_STATUS_ORDER,
  type CalendarCard,
  type CalendarDay,
  type SocialCalendarNote,
  type SocialChannel,
  type SocialTheme,
} from "@/services/socialContents";

export type CalendarView = "month" | "week";

export const DAY_DROP_PREFIX = "day:";

const WEEKDAYS = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."];

interface SocialCalendarProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  title: string;
  weeks: CalendarDay[][];
  todayKey: string;
  cardsByDay: Map<string, CalendarCard[]>;
  /** Notes par jour : jamais filtrées. */
  notesByDay: Map<string, SocialCalendarNote[]>;
  channelsById: Map<string, SocialChannel>;
  themesById: ReadonlyMap<string, SocialTheme>;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpen: (groupId: string) => void;
  onAddNote: (dayKey: string) => void;
  onOpenNote: (note: SocialCalendarNote) => void;
}

function DayCell({ day, isToday, cards, notes, channelsById, themesById, onOpen, onAddNote, onOpenNote, tall }: {
  day: CalendarDay;
  isToday: boolean;
  cards: CalendarCard[];
  notes: SocialCalendarNote[];
  channelsById: Map<string, SocialChannel>;
  themesById: ReadonlyMap<string, SocialTheme>;
  onOpen: (groupId: string) => void;
  onAddNote: (dayKey: string) => void;
  onOpenNote: (note: SocialCalendarNote) => void;
  tall: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${DAY_DROP_PREFIX}${day.key}` });
  return (
    <div
      ref={setNodeRef}
      data-testid={`day-${day.key}`}
      className={cn(
        "group border-t border-l p-1 space-y-1 min-w-0",
        tall ? "min-h-[16rem]" : "min-h-[6.5rem]",
        !day.inMonth && "bg-muted/40 text-muted-foreground",
        isOver && "bg-primary/10",
      )}
    >
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          aria-label={`Ajouter une note le ${day.key}`}
          title="Ajouter une note"
          onClick={() => onAddNote(day.key)}
          className="mr-auto inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <StickyNote className="h-3 w-3" />
        </button>
        <span
          className={cn(
            "text-xs tabular-nums h-5 min-w-5 px-1 rounded-full inline-flex items-center justify-center",
            isToday && "bg-primary text-primary-foreground font-semibold",
          )}
          aria-current={isToday ? "date" : undefined}
        >
          {Number(day.key.slice(8, 10))}
        </span>
      </div>
      {notes.map((note) => <CalendarNote key={note.id} note={note} onOpen={onOpenNote} />)}
      {cards.map((card) => <ContentCard key={card.group.id} card={card} channelsById={channelsById} themesById={themesById} onOpen={onOpen} />)}
    </div>
  );
}

export default function SocialCalendar({
  view, onViewChange, title, weeks, todayKey, cardsByDay, notesByDay, channelsById, themesById, onPrevious, onNext, onToday, onOpen,
  onAddNote, onOpenNote,
}: SocialCalendarProps) {
  return (
    <section className="flex-1 min-w-0 space-y-2" aria-label="Calendrier">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Précédent" onClick={onPrevious}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" aria-label="Suivant" onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={onToday}>Aujourd'hui</Button>
        <h2 className="text-base font-semibold first-letter:uppercase">{title}</h2>
        <ToggleGroup
          type="single"
          size="sm"
          value={view}
          onValueChange={(v) => { if (v) onViewChange(v as CalendarView); }}
          className="ml-auto"
        >
          <ToggleGroupItem value="month">Mois</ToggleGroupItem>
          <ToggleGroupItem value="week">Semaine</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-label="Légende des statuts">
          {DISPLAY_STATUS_ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={cn("h-2 w-2 rounded-full", STATUS_DOT_CLASSES[s])} />
              {DISPLAY_STATUS_LABELS[s]}
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[44rem] border-r border-b rounded">
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((d) => <div key={d} className="border-l px-1 py-1 text-xs font-medium text-muted-foreground">{d}</div>)}
          </div>
          {weeks.map((week) => (
            <div key={week[0].key} className="grid grid-cols-7">
              {week.map((day) => (
                <DayCell
                  key={day.key}
                  day={day}
                  isToday={day.key === todayKey}
                  cards={cardsByDay.get(day.key) ?? []}
                  notes={notesByDay.get(day.key) ?? []}
                  channelsById={channelsById}
                  themesById={themesById}
                  onOpen={onOpen}
                  onAddNote={onAddNote}
                  onOpenNote={onOpenNote}
                  tall={view === "week"}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
