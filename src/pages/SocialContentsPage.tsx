import { useMemo, useState } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { Plus, Settings, Share2 } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import CalendarNoteForm, { type NoteFormTarget } from "@/components/social/CalendarNoteForm";
import SocialCalendar, { DAY_DROP_PREFIX, type CalendarView } from "@/components/social/SocialCalendar";
import SocialComposerDialog from "@/components/social/SocialComposerDialog";
import SocialFilterBar from "@/components/social/SocialFilterBar";
import SocialSettingsDialog from "@/components/social/SocialSettingsDialog";
import UndatedColumn from "@/components/social/UndatedColumn";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useKanbanDnd } from "@/hooks/useKanbanDnd";
import {
  useSetSocialGroupDate,
  useSocialCalendarNotes,
  useSocialChannels,
  useSocialGroupsInRange,
  useSocialThemes,
  useUndatedSocialGroups,
  useUpdateSocialNote,
} from "@/hooks/useSocialContents";
import { toastError } from "@/lib/toastError";
import {
  addDays,
  addMonths,
  applySocialFilters,
  buildMonthGrid,
  buildWeekGrid,
  emptySocialFilters,
  moveKeepingTime,
  notesByDay,
  PUBLISHED_NOT_MOVABLE_MESSAGE,
  parisDayKey,
  parisLocalToUtcIso,
  type CalendarCard,
  type SocialCalendarNote,
  type SocialFilters,
} from "@/services/socialContents";

const keyDate = (key: string) => new Date(`${key}T12:00:00Z`);
const monthTitle = (key: string) =>
  new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(keyDate(key));
const shortDay = (key: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(keyDate(key));

export default function SocialContentsPage() {
  const { toast } = useToast();
  const { sensors } = useKanbanDnd();
  const todayKey = parisDayKey(new Date().toISOString());
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(todayKey);
  const [filters, setFilters] = useState<SocialFilters>(emptySocialFilters);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [noteForm, setNoteForm] = useState<NoteFormTarget | null>(null);
  const [composer, setComposer] = useState<{ open: boolean; groupId: string | null }>({ open: false, groupId: null });

  const weeks = useMemo(() => (view === "month" ? buildMonthGrid(anchor) : [buildWeekGrid(anchor)]), [view, anchor]);
  const firstDay = weeks[0][0].key;
  const lastDay = weeks[weeks.length - 1][6].key;
  const fromIso = parisLocalToUtcIso(firstDay, "00:00");
  const toIso = parisLocalToUtcIso(addDays(lastDay, 1), "00:00");

  const channelsQuery = useSocialChannels();
  const datedQuery = useSocialGroupsInRange(fromIso, toIso);
  const undatedQuery = useUndatedSocialGroups();
  const notesQuery = useSocialCalendarNotes(firstDay, lastDay);
  const { data: themes = [] } = useSocialThemes();
  const { data: channels = [] } = channelsQuery;
  const { data: dated = [] } = datedQuery;
  const { data: undatedGroups = [] } = undatedQuery;
  const setDate = useSetSocialGroupDate();
  const moveNote = useUpdateSocialNote();
  const notesOfDay = useMemo(
    () => notesByDay(notesQuery.isError ? [] : (notesQuery.data ?? [])),
    [notesQuery.isError, notesQuery.data],
  );

  const channelsById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  const themesById = useMemo(() => new Map(themes.map((t) => [t.id, t])), [themes]);
  const { undated, byDay } = useMemo(
    () => applySocialFilters(
      [...dated, ...undatedGroups], filters, channels, new Set(themesById.keys()), { fromIso, toIso }, channelsById,
    ),
    [dated, undatedGroups, filters, themesById, channels, fromIso, toIso, channelsById],
  );

  const title = view === "month"
    ? monthTitle(anchor)
    : `Semaine du ${shortDay(firstDay)} au ${shortDay(lastDay)} ${lastDay.slice(0, 4)}`;

  const openComposer = (groupId: string | null) => setComposer({ open: true, groupId });

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const overId = over ? String(over.id) : "";
    const note = active.data.current?.note as SocialCalendarNote | undefined;
    if (note) {
      if (!overId.startsWith(DAY_DROP_PREFIX)) return;
      const day = overId.slice(DAY_DROP_PREFIX.length);
      if (day === note.day) return;
      moveNote.mutate({ id: note.id, day }, { onError: (e) => toastError(toast, e) });
      return;
    }
    const card = active.data.current?.card as CalendarCard | undefined;
    if (!card || !overId.startsWith(DAY_DROP_PREFIX)) return;
    if (card.group.posts.every((p) => p.publication_status === "published")) {
      toastError(toast, PUBLISHED_NOT_MOVABLE_MESSAGE);
      return;
    }
    const scheduledAt = moveKeepingTime(card.scheduledAt, overId.slice(DAY_DROP_PREFIX.length));
    if (card.scheduledAt && Date.parse(scheduledAt) === Date.parse(card.scheduledAt)) return;
    setDate.mutate(
      { groupId: card.group.id, scheduledAt },
      { onError: (e) => toastError(toast, e) },
    );
  };

  /** Une note enregistrée hors de la grille affichée disparaît : on dit où elle est partie. */
  const handleNoteSaved = (day: string) => {
    if (day >= firstDay && day <= lastDay) return;
    toast({ title: `Note déplacée au ${day.slice(8, 10)}/${day.slice(5, 7)}` });
  };

  const navigate = (step: number) => setAnchor((a) => (view === "month" ? addMonths(a, step) : addDays(a, 7 * step)));
  const queries = [channelsQuery, datedQuery, undatedQuery];
  const loading = queries.some((q) => q.isLoading);
  const failed = queries.some((q) => q.isError);
  const retry = () => queries.forEach((q) => { if (q.isError) q.refetch(); });

  return (
    <ModuleLayout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        <PageHeader
          icon={Share2}
          title="Contenus sociaux"
          subtitle="Rédigez un contenu une fois et déclinez-le sur plusieurs canaux."
          actions={(
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setSettingsOpen(true)}><Settings className="h-4 w-4 mr-1" /> Réglages</Button>
              <Button onClick={() => openComposer(null)}><Plus className="h-4 w-4 mr-1" /> Nouveau contenu</Button>
            </div>
          )}
        />
        <Tabs value="calendar">
          <TabsList>
            <TabsTrigger value="calendar">Calendrier</TabsTrigger>
            <TabsTrigger value="list" disabled>Liste</TabsTrigger>
            <TabsTrigger value="previews" disabled>Aperçus</TabsTrigger>
          </TabsList>
        </Tabs>
        <SocialFilterBar themes={themes} channels={channels} filters={filters} onChange={setFilters} />
        {failed ? (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground" role="alert">
            <p>Impossible de charger le calendrier.</p>
            <Button variant="outline" onClick={retry}>Réessayer</Button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            {notesQuery.isError && (
              <div className="mb-2 flex items-center gap-2 rounded border border-dashed px-3 py-1.5 text-xs text-muted-foreground" role="status">
                <span>Notes indisponibles</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => notesQuery.refetch()}>Réessayer</Button>
              </div>
            )}
            <div className="flex flex-col lg:flex-row gap-4">
              <UndatedColumn cards={undated} channelsById={channelsById} themesById={themesById} onOpen={openComposer} />
              <SocialCalendar
                view={view}
                onViewChange={setView}
                title={title}
                weeks={weeks}
                todayKey={todayKey}
                cardsByDay={byDay}
                notesByDay={notesOfDay}
                channelsById={channelsById}
                themesById={themesById}
                onPrevious={() => navigate(-1)}
                onNext={() => navigate(1)}
                onToday={() => setAnchor(todayKey)}
                onOpen={openComposer}
                onAddNote={(day) => setNoteForm({ day, note: null })}
                onOpenNote={(note) => setNoteForm({ day: note.day, note })}
              />
            </div>
          </DndContext>
        )}
      </div>
      <SocialComposerDialog
        open={composer.open}
        onOpenChange={(open) => setComposer((c) => ({ ...c, open }))}
        groupId={composer.groupId}
      />
      <SocialSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <CalendarNoteForm target={noteForm} onClose={() => setNoteForm(null)} onSaved={handleNoteSaved} />
    </ModuleLayout>
  );
}
