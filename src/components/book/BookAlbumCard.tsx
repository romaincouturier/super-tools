import { BookImage, Share2, Edit2, Trash2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { BookAlbum } from '@/types/book';

interface BookAlbumCardProps {
  album: BookAlbum;
  onClick: () => void;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function BookAlbumCard({
  album,
  onClick,
  onShare,
  onEdit,
  onDelete,
}: BookAlbumCardProps) {
  return (
    <Card
      className="group relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      {/* Cover */}
      <div className="relative aspect-video bg-gray-100">
        {album.cover_url ? (
          <img
            src={album.cover_url}
            alt={album.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <BookImage className="w-12 h-12 text-gray-300" />
          </div>
        )}

        {/* Hover actions overlay */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-white/90 hover:bg-white"
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
          >
            <Share2 className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-white/90 hover:bg-white"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-white/90 hover:bg-white text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-medium leading-tight line-clamp-1">{album.title}</h3>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {album.production_count ?? 0}
          </Badge>
        </div>

        {album.description && (
          <p className="text-sm text-muted-foreground line-clamp-1">{album.description}</p>
        )}

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          <span>{format(new Date(album.created_at), 'MMM yyyy', { locale: fr })}</span>
        </div>
      </div>
    </Card>
  );
}
