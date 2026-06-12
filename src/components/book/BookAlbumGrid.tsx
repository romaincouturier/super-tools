import BookAlbumCard from './BookAlbumCard';
import type { BookAlbum } from '@/types/book';

interface BookAlbumGridProps {
  albums: BookAlbum[];
  onAlbumClick: (id: string) => void;
  onShare: (album: BookAlbum) => void;
  onEdit: (album: BookAlbum) => void;
  onDelete: (album: BookAlbum) => void;
}

export default function BookAlbumGrid({
  albums,
  onAlbumClick,
  onShare,
  onEdit,
  onDelete,
}: BookAlbumGridProps) {
  if (albums.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p className="text-lg">Aucun album — créez votre premier</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {albums.map((album) => (
        <BookAlbumCard
          key={album.id}
          album={album}
          onClick={() => onAlbumClick(album.id)}
          onShare={() => onShare(album)}
          onEdit={() => onEdit(album)}
          onDelete={() => onDelete(album)}
        />
      ))}
    </div>
  );
}
