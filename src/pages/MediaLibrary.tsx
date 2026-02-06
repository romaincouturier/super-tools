import { useState, useMemo } from "react";
import AppHeader from "@/components/AppHeader";
import { useMediaLibrary, MediaItemWithMission } from "@/hooks/useMediaLibrary";
import { useMissions } from "@/hooks/useMissions";
import MediaFilters from "@/components/media/MediaFilters";
import MediaGrid from "@/components/media/MediaGrid";
import MediaLightbox from "@/components/media/MediaLightbox";
import MediaUploadDialog from "@/components/media/MediaUploadDialog";
import { Loader2, ImageIcon, Video } from "lucide-react";

const MediaLibrary = () => {
  const { data: allMedia = [], isLoading: mediaLoading } = useMediaLibrary();
  const { data: missions = [], isLoading: missionsLoading } = useMissions();

  const [search, setSearch] = useState("");
  const [selectedMission, setSelectedMission] = useState("all");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [lightboxItem, setLightboxItem] = useState<MediaItemWithMission | null>(null);

  // Extract unique missions that have media
  const missionsWithMedia = useMemo(() => {
    const ids = new Set(allMedia.map((m) => m.mission_id));
    return missions
      .filter((m) => ids.has(m.id))
      .map((m) => ({ id: m.id, title: m.title, emoji: m.emoji || null }));
  }, [allMedia, missions]);

  // Extract unique tags across all missions that have media
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    allMedia.forEach((item) => {
      item.mission_tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [allMedia]);

  // Filter media
  const filteredMedia = useMemo(() => {
    return allMedia.filter((item) => {
      if (search && !item.file_name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (selectedMission !== "all" && item.mission_id !== selectedMission) {
        return false;
      }
      if (selectedTag && !item.mission_tags.includes(selectedTag)) {
        return false;
      }
      if (selectedType !== "all" && item.file_type !== selectedType) {
        return false;
      }
      return true;
    });
  }, [allMedia, search, selectedMission, selectedTag, selectedType]);

  const hasActiveFilters = search !== "" || selectedMission !== "all" || selectedTag !== "" || selectedType !== "all";

  const clearFilters = () => {
    setSearch("");
    setSelectedMission("all");
    setSelectedTag("");
    setSelectedType("all");
  };

  // Stats
  const imageCount = filteredMedia.filter((m) => m.file_type === "image").length;
  const videoCount = filteredMedia.filter((m) => m.file_type === "video").length;

  const isLoading = mediaLoading || missionsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Médiathèque</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <ImageIcon className="h-3.5 w-3.5" /> {imageCount} image{imageCount !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1">
                <Video className="h-3.5 w-3.5" /> {videoCount} vidéo{videoCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <MediaUploadDialog missions={missions} />
        </div>

        {/* Filters */}
        <MediaFilters
          search={search}
          onSearchChange={setSearch}
          selectedMission={selectedMission}
          onMissionChange={setSelectedMission}
          selectedTag={selectedTag}
          onTagChange={setSelectedTag}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          missions={missionsWithMedia}
          tags={allTags}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />

        {/* Grid */}
        <MediaGrid items={filteredMedia} onOpenLightbox={setLightboxItem} />

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
    </div>
  );
};

export default MediaLibrary;
