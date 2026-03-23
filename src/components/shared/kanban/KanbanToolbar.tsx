import { useState } from "react";
import { Search, X, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface KanbanToolbarProps {
  /** Placeholder text for search input */
  searchPlaceholder?: string;
  /** Current search value (controlled) */
  search: string;
  /** Callback when search value changes */
  onSearchChange: (value: string) => void;
  /** Slot for filter controls (Select, Button groups, etc.) */
  filters?: ReactNode;
  /** Slot for action buttons (Create, Export, etc.) */
  actions?: ReactNode;
  /** Whether to show the stats button */
  showStatsButton?: boolean;
  /** Callback when stats button is clicked */
  onStatsClick?: () => void;
}

export default function KanbanToolbar({
  searchPlaceholder = "Rechercher...",
  search,
  onSearchChange,
  filters,
  actions,
  showStatsButton = false,
  onStatsClick,
}: KanbanToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-3">
      {/* Search */}
      <div className="relative w-56 sm:w-64">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filters slot */}
      {filters}

      {/* Stats button */}
      {showStatsButton && onStatsClick && (
        <Button variant="outline" size="sm" className="h-9" onClick={onStatsClick} title="Statistiques du tableau">
          <BarChart3 className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Statistiques</span>
        </Button>
      )}

      {/* Actions slot */}
      {actions}
    </div>
  );
}
