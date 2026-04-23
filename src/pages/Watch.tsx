import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Layers, CalendarDays, Loader2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import WatchAddDialog from "@/components/watch/WatchAddDialog";
import WatchFilters from "@/components/watch/WatchFilters";
import WatchItemCard from "@/components/watch/WatchItemCard";
import WatchClusterCard from "@/components/watch/WatchClusterCard";
import { useWatchItems, useWatchTags, useWatchClusters, useWatchDigests } from "@/hooks/useWatch";
import type { WatchContentType } from "@/hooks/useWatch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";

const Watch = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [contentType, setContentType] = useState<WatchContentType | "all">("all");
  const [sharedOnly, setSharedOnly] = useState(false);
  const [taggedForMe, setTaggedForMe] = useState(false);

  const {
    data: itemsPages,
    isLoading: itemsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useWatchItems({
    search: search || undefined,
    tags: selectedTag ? [selectedTag] : undefined,
    contentType,
    sharedOnly,
    assignedToUserId: taggedForMe && user ? user.id : undefined,
  });

  const { data: allTags = [] } = useWatchTags();
  const { data: clusters = [] } = useWatchClusters();
  const { data: digests = [] } = useWatchDigests();

  const items = useMemo(
    () => itemsPages?.pages.flatMap((p) => p.items) || [],
    [itemsPages]
  );

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(handleIntersect, { rootMargin: "200px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect]);

  const hasActiveFilters = search !== "" || selectedTag !== "" || contentType !== "all" || sharedOnly || taggedForMe;

  const clearFilters = () => {
    setSearch("");
    setSelectedTag("");
    setContentType("all");
    setSharedOnly(false);
    setTaggedForMe(false);
  };

  // Count clusters with items
  const clusterItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      if (item.cluster_id) {
        counts[item.cluster_id] = (counts[item.cluster_id] || 0) + 1;
      }
    });
    return counts;
  }, [items]);

  if (itemsLoading) {
    return (
      <ModuleLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Spinner size="lg" className="text-primary" />
        </div>
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout>
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <PageHeader
          icon={Eye}
          title="Veille"
          subtitle={`${items.length} contenu${items.length !== 1 ? "s" : ""} · ${clusters.length} cluster${clusters.length !== 1 ? "s" : ""}`}
          actions={<WatchAddDialog allTags={allTags} />}
        />

        <Tabs defaultValue="feed">
          <TabsList>
            <TabsTrigger value="feed" className="gap-1.5">
              <Eye className="h-4 w-4" />
              Fil de veille
            </TabsTrigger>
            <TabsTrigger value="clusters" className="gap-1.5">
              <Layers className="h-4 w-4" />
              Clusters
              {clusters.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{clusters.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="digests" className="gap-1.5">
              <CalendarDays className="h-4 w-4" />
              Digests
            </TabsTrigger>
          </TabsList>

          {/* Feed tab */}
          <TabsContent value="feed" className="space-y-4 mt-4">
            <WatchFilters
              search={search}
              onSearchChange={setSearch}
              selectedTag={selectedTag}
              onTagChange={setSelectedTag}
              contentType={contentType}
              onContentTypeChange={setContentType}
              sharedOnly={sharedOnly}
              onSharedOnlyChange={setSharedOnly}
              taggedForMe={taggedForMe}
              onTaggedForMeChange={setTaggedForMe}
              tags={allTags}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
              totalCount={items.length}
            />

            {items.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Aucun contenu de veille</p>
                <p className="text-xs mt-1">Ajoutez votre premier contenu pour commencer</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {items.map((item) => (
                  <WatchItemCard key={item.id} item={item} />
                ))}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            {hasNextPage && (
              <div ref={sentinelRef} className="flex items-center justify-center py-4">
                {isFetchingNextPage && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
              </div>
            )}
          </TabsContent>

          {/* Clusters tab */}
          <TabsContent value="clusters" className="space-y-4 mt-4">
            {clusters.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Aucun cluster détecté</p>
                <p className="text-xs mt-1">Les clusters apparaissent automatiquement quand 3+ contenus sont liés</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {clusters.map((cluster) => (
                  <WatchClusterCard
                    key={cluster.id}
                    cluster={cluster}
                    itemCount={clusterItemCounts[cluster.id] || 0}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Digests tab */}
          <TabsContent value="digests" className="space-y-4 mt-4">
            {digests.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Aucun digest hebdomadaire</p>
                <p className="text-xs mt-1">Un résumé est généré chaque lundi automatiquement</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {digests.map((digest) => (
                  <Card key={digest.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">
                        Semaine du {new Date(digest.week_start).toLocaleDateString("fr-FR")} au{" "}
                        {new Date(digest.week_end).toLocaleDateString("fr-FR")}
                      </h3>
                      <Badge variant="outline" className="text-[10px]">
                        {digest.item_ids.length} contenu{digest.item_ids.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {digest.summary}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(digest.created_at), { addSuffix: true, locale: fr })}</span>
                      {digest.slack_posted_at && (
                        <Badge variant="outline" className="text-[10px] text-green-600">
                          Envoyé sur Slack
                        </Badge>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </ModuleLayout>
  );
};

export default Watch;
