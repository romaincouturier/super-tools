import { Video, Edit2, Trash2, Star, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { BookProduction } from '@/types/book';

interface BookProductionCardProps {
  production: BookProduction;
  isCover?: boolean;
  onClick: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onSetCover?: () => void;
}

export default function BookProductionCard({
  production,
  isCover,
  onClick,
  onDelete,
  onEdit,
  onSetCover,
}: BookProductionCardProps) {
  const visibleTags = production.tags.slice(0, 2);
  const extraTagCount = production.tags.length - visibleTags.length;
  const hasDimensions = production.exif_width != null && production.exif_height != null;

  return (
    <div
      className="group relative rounded-lg overflow-hidden cursor-pointer bg-gray-100 aspect-square"
      onClick={onClick}
    >
      {production.file_type === 'video' ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          {production.thumbnail_url ? (
            <img
              src={production.thumbnail_url}
              alt={production.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <Video className="w-12 h-12 text-gray-400" />
          )}
        </div>
      ) : (
        <img
          src={production.thumbnail_url ?? production.file_url}
          alt={production.title}
          className="w-full h-full object-cover"
        />
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
        <div className="flex justify-end gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-7 w-7 bg-white/90 hover:bg-white"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-7 w-7 bg-white/90 hover:bg-white text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium text-white truncate">{production.title}</p>
          {visibleTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {visibleTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs h-5 px-1.5">
                  {tag}
                </Badge>
              ))}
              {extraTagCount > 0 && (
                <Badge variant="secondary" className="text-xs h-5 px-1.5">
                  +{extraTagCount}
                </Badge>
              )}
            </div>
          )}
          {hasDimensions && (
            <p className="text-xs text-white/70">
              {production.exif_width} x {production.exif_height}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
