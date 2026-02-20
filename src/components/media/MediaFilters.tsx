import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ImageIcon, Video, X, Filter, Briefcase, GraduationCap, CalendarDays, HandCoins } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SourceOption {
  id: string;
  label: string;
  emoji: string | null;
  sourceType: string;
}

interface MediaFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedSource: string;
  onSourceChange: (value: string) => void;
  selectedSourceType: string;
  onSourceTypeChange: (value: string) => void;
  selectedTag: string;
  onTagChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  sources: SourceOption[];
  tags: string[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const MediaFilters = ({
  search,
  onSearchChange,
  selectedSource,
  onSourceChange,
  selectedSourceType,
  onSourceTypeChange,
  selectedTag,
  onTagChange,
  selectedType,
  onTypeChange,
  sources,
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

        {/* Source type filter */}
        <Select value={selectedSourceType} onValueChange={onSourceTypeChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Toutes les sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les sources</SelectItem>
            <SelectItem value="mission">
              <span className="flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5" /> Missions
              </span>
            </SelectItem>
            <SelectItem value="training">
              <span className="flex items-center gap-2">
                <GraduationCap className="h-3.5 w-3.5" /> Formations
              </span>
            </SelectItem>
            <SelectItem value="event">
              <span className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" /> Événements
              </span>
            </SelectItem>
            <SelectItem value="crm">
              <span className="flex items-center gap-2">
                <HandCoins className="h-3.5 w-3.5" /> Opportunités
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Entity filter */}
        <Select value={selectedSource} onValueChange={onSourceChange}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Toutes les entités" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les entités</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.emoji ? `${s.emoji} ` : ""}{s.label}
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
