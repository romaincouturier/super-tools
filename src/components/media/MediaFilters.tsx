import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ImageIcon, Video, X, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Mission {
  id: string;
  title: string;
  emoji: string | null;
}

interface MediaFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedMission: string;
  onMissionChange: (value: string) => void;
  selectedTag: string;
  onTagChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  missions: Mission[];
  tags: string[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const MediaFilters = ({
  search,
  onSearchChange,
  selectedMission,
  onMissionChange,
  selectedTag,
  onTagChange,
  selectedType,
  onTypeChange,
  missions,
  tags,
  hasActiveFilters,
  onClearFilters,
}: MediaFiltersProps) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom de fichier..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Mission filter */}
        <Select value={selectedMission} onValueChange={onMissionChange}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Toutes les missions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les missions</SelectItem>
            {missions.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.emoji ? `${m.emoji} ` : ""}{m.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type filter */}
        <Select value={selectedType} onValueChange={onTypeChange}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="image">
              <span className="flex items-center gap-2">
                <ImageIcon className="h-3.5 w-3.5" /> Images
              </span>
            </SelectItem>
            <SelectItem value="video">
              <span className="flex items-center gap-2">
                <Video className="h-3.5 w-3.5" /> Vidéos
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTag === tag ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => onTagChange(selectedTag === tag ? "" : tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="text-muted-foreground"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Réinitialiser les filtres
        </Button>
      )}
    </div>
  );
};

export default MediaFilters;
