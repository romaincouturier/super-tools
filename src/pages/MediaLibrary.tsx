import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ModuleLayout from "@/components/ModuleLayout";
import { useMediaLibrary, MediaItem } from "@/hooks/useMedia";
import { useMissions } from "@/hooks/useMissions";
import { useEvents } from "@/hooks/useEvents";
import { supabase } from "@/integrations/supabase/client";
import MediaFilters from "@/components/media/MediaFilters";
import MediaGrid from "@/components/media/MediaGrid";
import MediaLightbox from "@/components/media/MediaLightbox";
import MediaUploadDialog from "@/components/media/MediaUploadDialog";
import { Loader2, ImageIcon } from "lucide-react";
import PageHeader from "@/components/PageHeader";

// Fetch trainings for the upload dialog
const useTrainingsList = () => {
  return useQuery({
    queryKey: ["trainings-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainings")
        .select("id, training_name")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data || []) as { id: string; training_name: string }[];
    },
  });
};

// Fetch CRM cards for the upload dialog
const useCrmCardsList = () => {
  return useQuery({
    queryKey: ["crm-cards-list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("crm_cards")
        .select("id, title, emoji")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as { id: string; title: string; emoji: string | null }[];
    },
  });
};

const MediaLibrary = () => {
  const { data: allMedia = [], isLoading: mediaLoading } = useMediaLibrary();
  const { data: missions = [], isLoading: missionsLoading } = useMissions();
  const { data: events = [] } = useEvents();
  const { data: trainings = [] } = useTrainingsList();
  const { data: crmCards = [] } = useCrmCardsList();

  const [search, setSearch] = useState("");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedSourceType, setSelectedSourceType] = useState("all");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);

  // Exclude video_link items from library display (they are just URL references)
  const displayMedia = useMemo(() => {
    return allMedia.filter((m) => m.file_type !== "video_link");
  }, [allMedia]);

  // Extract unique sources that have media
  const sourcesWithMedia = useMemo(() => {
    const ids = new Set(displayMedia.map((m) => m.source_id));
    const result: { id: string; label: string; emoji: string | null; sourceType: string }[] = [];
    const seen = new Set<string>();

    displayMedia.forEach((m) => {
      if (!seen.has(m.source_id) && ids.has(m.source_id)) {
        seen.add(m.source_id);
        result.push({
          id: m.source_id,
          label: m.source_label,
          emoji: m.source_emoji,
          sourceType: m.source_type,
        });
      }
    });

    return result;
  }, [displayMedia]);

  // Filter sources by selected source type
  const filteredSources = useMemo(() => {
    if (selectedSourceType === "all") return sourcesWithMedia;
    return sourcesWithMedia.filter((s) => s.sourceType === selectedSourceType);
  }, [sourcesWithMedia, selectedSourceType]);

  // Extract unique media-level tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    displayMedia.forEach((item) => {
      (item.tags || []).forEach((tag: string) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [displayMedia]);

  // Filter media
  const filteredMedia = useMemo(() => {
    return displayMedia.filter((item) => {
      if (search) {
        const q = search.toLowerCase();
        const matchesName = item.file_name.toLowerCase().includes(q);
        const matchesTags = (item.tags || []).some((t: string) => t.toLowerCase().includes(q));
        const matchesSource = item.source_label.toLowerCase().includes(q);
        if (!matchesName && !matchesTags && !matchesSource) return false;
      }
      if (selectedSourceType !== "all" && item.source_type !== selectedSourceType) {
        return false;
      }
      if (selectedSource !== "all" && item.source_id !== selectedSource) {
        return false;
      }
      if (selectedTag && !(item.tags || []).includes(selectedTag)) {
        return false;
      }
      if (selectedType !== "all" && item.file_type !== selectedType) {
        return false;
      }
      return true;
    });
  }, [displayMedia, search, selectedSource, selectedSourceType, selectedTag, selectedType]);

  const hasActiveFilters =
    search !== "" || selectedSource !== "all" || selectedSourceType !== "all" || selectedTag !== "" || selectedType !== "all";

  const clearFilters = () => {
    setSearch("");
    setSelectedSource("all");
    setSelectedSourceType("all");
    setSelectedTag("");
    setSelectedType("all");
  };

  // Stats
  const imageCount = filteredMedia.filter((m) => m.file_type === "image").length;
  const videoCount = filteredMedia.filter((m) => m.file_type === "video").length;

  const isLoading = mediaLoading || missionsLoading;

  // Build entity options for upload dialog
  const missionOptions = missions.map((m) => ({ id: m.id, label: m.title, emoji: m.emoji }));
  const trainingOptions = trainings.map((t) => ({ id: t.id, label: t.training_name }));
  const eventOptions = events.map((e) => ({ id: e.id, label: e.title }));
  const crmOptions = crmCards.map((c) => ({ id: c.id, label: c.title, emoji: c.emoji }));

  if (isLoading) {
    return (
      <ModuleLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout>
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <PageHeader
          icon={ImageIcon}
          title="Médiathèque"
          subtitle={`${imageCount} image${imageCount !== 1 ? "s" : ""} · ${videoCount} vidéo${videoCount !== 1 ? "s" : ""}`}
          actions={
            <MediaUploadDialog
              missions={missionOptions}
              trainings={trainingOptions}
              events={eventOptions}
              crmCards={crmOptions}
            />
          }
        />

        {/* Filters */}
        <MediaFilters
          search={search}
          onSearchChange={setSearch}
          selectedSource={selectedSource}
          onSourceChange={setSelectedSource}
          selectedSourceType={selectedSourceType}
          onSourceTypeChange={(v) => { setSelectedSourceType(v); setSelectedSource("all"); }}
          selectedTag={selectedTag}
          onTagChange={setSelectedTag}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          sources={filteredSources}
          tags={allTags}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />

        {/* Grid */}
        <MediaGrid items={filteredMedia} onOpenLightbox={setLightboxItem} allTags={allTags} />

        {/* Lightbox */}
        {lightboxItem && (
          <MediaLightbox
            item={lightboxItem}
            items={filteredMedia}
            onClose={() => setLightboxItem(null)}
            onNavigate={setLightboxItem}
          />
        )}
      </main>
    </ModuleLayout>
  );
};

export default MediaLibrary;
