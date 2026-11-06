import { useMemo, useState } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { Plus, Share2 } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import ChannelFilterBar from "@/components/social/ChannelFilterBar";
import SocialCalendar, { DAY_DROP_PREFIX, type CalendarView } from "@/components/social/SocialCalendar";
import SocialComposerDialog from "@/components/social/SocialComposerDialog";
import UndatedColumn from "@/components/social/UndatedColumn";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useKanbanDnd } from "@/hooks/useKanbanDnd";
import {
  useSetSocialGroupDate,
  useSocialChannels,
  useSocialGroupsInRange,
  useUndatedSocialGroups,
} from "@/hooks/useSocialContents";
import { toastError } from "@/lib/toastError";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  buildWeekGrid,
  moveKeepingTime,
  parisDayKey,
  parisLocalToUtcIso,
  placeGroups,
  type CalendarCard,
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
  const [hiddenChannelIds, setHiddenChannelIds] = useState<Set<string>>(new Set());
  const [composer, setComposer] = useState<{ open: boolean; groupId: string | null }>({ open: false, groupId: null });

  const weeks = useMemo(() => (view === "month" ? buildMonthGrid(anchor) : [buildWeekGrid(anchor)]), [view, anchor]);
  const firstDay = weeks[0][0].key;
  const lastDay = weeks[weeks.length - 1][6].key;
  const fromIso = parisLocalToUtcIso(firstDay, "00:00");
  const toIso = parisLocalToUtcIso(addDays(lastDay, 1), "00:00");

  const channelsQuery = useSocialChannels();
  const datedQuery = useSocialGroupsInRange(fromIso, toIso);
  const undatedQuery = useUndatedSocialGroups();
  const { data: channels = [] } = channelsQuery;
  const { data: dated = [] } = datedQuery;
  const { data: undatedGroups = [] } = undatedQuery;
  const setDate = useSetSocialGroupDate();

  const channelsById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  const visibleChannelIds = useMemo(
    () => new Set(channels.filter((c) => !hiddenChannelIds.has(c.id)).map((c) => c.id)),
    [channels, hiddenChannelIds],
  );
  const { undated, byDay } = useMemo(
    () => placeGroups([...dated, ...undatedGroups], visibleChannelIds, { fromIso, toIso }, channelsById),
    [dated, undatedGroups, visibleChannelIds, fromIso, toIso, channelsById],
  );

  const title = view === "month"
    ? monthTitle(anchor)
    : `Semaine du ${shortDay(firstDay)} au ${shortDay(lastDay)} ${lastDay.slice(0, 4)}`;

  const toggleChannel = (id: string) => setHiddenChannelIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const openComposer = (groupId: string | null) => setComposer({ open: true, groupId });

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const overId = over ? String(over.id) : "";
    const card = active.data.current?.card as CalendarCard | undefined;
    if (!card || !overId.startsWith(DAY_DROP_PREFIX)) return;
    const scheduledAt = moveKeepingTime(card.scheduledAt, overId.slice(DAY_DROP_PREFIX.length));
    if (card.scheduledAt && Date.parse(scheduledAt) === Date.parse(card.scheduledAt)) return;
    setDate.mutate(
      { groupId: card.group.id, scheduledAt },
      { onError: (e) => toastError(toast, e) },
    );
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
          actions={<Button onClick={() => openComposer(null)}><Plus className="h-4 w-4 mr-1" /> Nouveau contenu</Button>}
        />
        <Tabs value="calendar">
          <TabsList>
            <TabsTrigger value="calendar">Calendrier</TabsTrigger>
            <TabsTrigger value="list" disabled>Liste</TabsTrigger>
            <TabsTrigger value="previews" disabled>Aperçus</TabsTrigger>
          </TabsList>
        </Tabs>
        <ChannelFilterBar channels={channels} hiddenChannelIds={hiddenChannelIds} onToggle={toggleChannel} />
        {failed ? (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground" role="alert">
            <p>Impossible de charger le calendrier.</p>
            <Button variant="outline" onClick={retry}>Réessayer</Button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex flex-col lg:flex-row gap-4">
              <UndatedColumn cards={undated} channelsById={channelsById} onOpen={openComposer} />
              <SocialCalendar
                view={view}
                onViewChange={setView}
                title={title}
                weeks={weeks}
                todayKey={todayKey}
                cardsByDay={byDay}
                channelsById={channelsById}
                onPrevious={() => navigate(-1)}
                onNext={() => navigate(1)}
                onToday={() => setAnchor(todayKey)}
                onOpen={openComposer}
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
    </ModuleLayout>
  );
}
