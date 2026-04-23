import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Share2, UserCheck } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import type { WatchContentType } from "@/hooks/useWatch";

interface WatchFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  selectedTag: string;
  onTagChange: (v: string) => void;
  contentType: WatchContentType | "all";
  onContentTypeChange: (v: WatchContentType | "all") => void;
  sharedOnly: boolean;
  onSharedOnlyChange: (v: boolean) => void;
  taggedForMe: boolean;
  onTaggedForMeChange: (v: boolean) => void;
  tags: string[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  totalCount: number;
}

const WatchFilters = ({
  search,
  onSearchChange,
  selectedTag,
  onTagChange,
  contentType,
  onContentTypeChange,
  sharedOnly,
  onSharedOnlyChange,
  taggedForMe,
  onTaggedForMeChange,
  tags,
  hasActiveFilters,
  onClearFilters,
  totalCount,
}: WatchFiltersProps) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher par titre, contenu, tags..."
          className="pl-9"
        />
      </div>

      {/* Content type filter */}
      <Select value={contentType} onValueChange={(v) => onContentTypeChange(v as WatchContentType | "all")}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les types</SelectItem>
          <SelectItem value="text">Texte</SelectItem>
          <SelectItem value="url">URL</SelectItem>
          <SelectItem value="image">Image</SelectItem>
          <SelectItem value="audio">Audio</SelectItem>
        </SelectContent>
      </Select>

      {/* Tag filter */}
      <Select value={selectedTag || "_all"} onValueChange={(v) => onTagChange(v === "_all" ? "" : v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Tag" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Tous les tags</SelectItem>
          {tags.map((tag) => (
            <SelectItem key={tag} value={tag}>{tag}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Shared toggle */}
      <Toggle
        pressed={sharedOnly}
        onPressedChange={onSharedOnlyChange}
        size="sm"
        className="gap-1.5"
        aria-label="À partager seulement"
      >
        <Share2 className="h-3.5 w-3.5" />
        À partager
      </Toggle>

      {/* Tagged-for-me toggle */}
      <Toggle
        pressed={taggedForMe}
        onPressedChange={onTaggedForMeChange}
        size="sm"
        className="gap-1.5"
        aria-label="Taguées pour moi"
      >
        <UserCheck className="h-3.5 w-3.5" />
        Taguées pour moi
      </Toggle>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="gap-1">
          <X className="h-3.5 w-3.5" />
          Effacer
        </Button>
      )}

      {/* Count */}
      <Badge variant="outline" className="text-muted-foreground">
        {totalCount} contenu{totalCount !== 1 ? "s" : ""}
      </Badge>
    </div>
  );
};

export default WatchFilters;
