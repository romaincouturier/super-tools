import { BarChart2, Eye, Video } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBookLinkStats, useBookProductionViewStats } from '@/hooks/useBook';

interface BookAnalyticsDashboardProps {
  albumId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Jamais';
  return format(new Date(dateStr), 'd MMM yyyy HH:mm', { locale: fr });
}

export default function BookAnalyticsDashboard({
  albumId,
  open,
  onOpenChange,
}: BookAnalyticsDashboardProps) {
  const { data: stats = [], isLoading } = useBookLinkStats(albumId);
  const { data: productionStats = [], isLoading: isProdLoading } =
    useBookProductionViewStats(albumId);

  const totalLinks = stats.length;
  const openedLinks = stats.filter((s) => s.total_views > 0).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5" />
            Statistiques
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : stats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun lien créé</p>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-2xl font-bold">{totalLinks}</p>
                  <p className="text-sm text-muted-foreground">Liens créés</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-2xl font-bold">{openedLinks}</p>
                  <p className="text-sm text-muted-foreground">Liens ouverts</p>
                </div>
              </div>

              <Separator />

              {/* Per-link stats */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Par lien</h3>
                {stats.map((stat) => (
                  <div key={stat.link.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{stat.link.prospect_name}</span>
                      <span className="text-sm text-muted-foreground">
                        {stat.total_views} vue{stat.total_views !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Première vue</span>
                      <span className="text-right">{formatDate(stat.first_viewed_at)}</span>
                      <span>Dernière vue</span>
                      <span className="text-right">{formatDate(stat.last_viewed_at)}</span>
                      <span>Productions vues</span>
                      <span className="text-right">{stat.productions_viewed.length}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Per-production stats */}
          {!isProdLoading && productionStats.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Vues par production
                </h3>
                <div className="space-y-2">
                  {productionStats.map((s, idx) => (
                    <div
                      key={s.production.id}
                      className="flex items-center gap-3 rounded-lg border p-2"
                    >
                      <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                        {idx + 1}
                      </span>
                      <div className="w-12 h-12 shrink-0 rounded overflow-hidden bg-muted">
                        {s.production.file_type === 'video' ? (
                          s.production.thumbnail_url ? (
                            <img
                              src={s.production.thumbnail_url}
                              alt={s.production.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-800">
                              <Video className="w-5 h-5 text-gray-400" />
                            </div>
                          )
                        ) : (
                          <img
                            src={s.production.thumbnail_url ?? s.production.file_url}
                            alt={s.production.title}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {s.production.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.unique_links} lien{s.unique_links !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold leading-none">{s.views}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          vue{s.views !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
