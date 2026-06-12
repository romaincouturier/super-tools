import { useParams } from 'react-router-dom';
import ModuleLayout from '@/components/ModuleLayout';
import { PageHeader } from '@/components/PageHeader';
import BookAlbumDetail from '@/components/book/BookAlbumDetail';
import BookProfileWidget from '@/components/book/BookProfileWidget';
import { useBookProfile, useBookAlbums } from '@/hooks/useBook';

export default function BookAlbumPage() {
  const { albumId } = useParams<{ albumId: string }>();
  const { data: profile } = useBookProfile();
  const { data: albums = [] } = useBookAlbums();

  const album = albums.find((a) => a.id === albumId);

  if (!albumId) {
    return (
      <ModuleLayout>
        <div className="p-6 flex items-center justify-center py-24 text-muted-foreground">
          Album introuvable.
        </div>
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout>
      <PageHeader title={album?.title ?? "Album"} />
      <div className="p-6 max-w-7xl mx-auto">
        <BookAlbumDetail
          albumId={albumId}
          albumTitle={album?.title}
          albumDescription={album?.description}
        />
      </div>
      <BookProfileWidget profile={profile ?? null} />
    </ModuleLayout>
  );
}
