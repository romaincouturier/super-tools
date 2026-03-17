import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  X,
  Loader2,
  Calendar,
  MoreVertical,
  Wand2,
  ChevronDown,
  Trophy,
  XCircle,
  Undo2,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeatureTracking } from "@/hooks/useFeatureTracking";
import type { CardDetailState, CardDetailHandlers } from "./types";

interface Props {
  state: CardDetailState;
  handlers: CardDetailHandlers;
  updatePending: boolean;
}

const CardDetailToolbar = ({ state, handlers, updatePending }: Props) => {
  const { trackFeature } = useFeatureTracking();
  const {
    card: _card, allColumns, columnId, estimatedValue, setEstimatedValue,
    confidenceScore, setConfidenceScore, salesStatus, setShowPricingDialog,
    nextActionSuggesting, setShowSchedulePopover,
  } = state;

  return (
    <div className="mt-4 mb-4 flex items-center gap-2">
      {/* Action menu */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={() => { trackFeature("schedule_action", "crm"); setShowSchedulePopover(true); }}>
            <Calendar className="h-4 w-4 mr-2" />
            Programmer une action
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { trackFeature("ai_suggestion", "crm"); handlers.handleSuggestNextAction(); }} disabled={nextActionSuggesting}>
            {nextActionSuggesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Suggestion IA
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Column selector */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="sm" className="gap-1.5">
            {allColumns.find(c => c.id === columnId)?.name || "Colonne"}
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {allColumns.map((col) => (
            <DropdownMenuItem
              key={col.id}
              onClick={() => handlers.handleColumnChange(col.id, col.name)}
              disabled={updatePending || col.id === columnId}
              className={cn(col.id === columnId && "font-semibold bg-accent")}
            >
              {col.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Estimated value */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-sm font-medium transition-colors cursor-pointer hover:opacity-80 text-green-700 bg-green-50 border-green-200">
            {estimatedValue && parseFloat(estimatedValue) > 0
              ? `${Number(parseFloat(estimatedValue) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`
              : "0 €"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-3" align="start">
          <Label className="text-xs">Valeur estimée (€)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            className="h-8 mt-1"
            autoFocus
          />
        </PopoverContent>
      </Popover>

      {/* Macro pricing */}
      <button
        className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer hover:opacity-80 text-violet-700 bg-violet-50 border-violet-200"
        onClick={() => { trackFeature("macro_pricing", "crm"); setShowPricingDialog(true); }}
        title="Macro chiffrage"
      >
        <Calculator className="h-3.5 w-3.5" />
      </button>

      {/* Confidence score */}
      <Popover>
        <PopoverTrigger asChild>
          <button className={cn(
            "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer hover:opacity-80",
            confidenceScore !== null && confidenceScore >= 70 && "border-green-300 text-green-700 bg-green-50",
            confidenceScore !== null && confidenceScore >= 40 && confidenceScore < 70 && "border-orange-300 text-orange-700 bg-orange-50",
            (confidenceScore === null || confidenceScore < 40) && "border-red-300 text-red-700 bg-red-50",
          )}>
            {confidenceScore !== null ? `${confidenceScore}%` : "—%"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-3" align="start">
          <Label className="text-xs flex items-center justify-between">
            <span>Confiance</span>
            <span className="font-medium">{confidenceScore !== null ? `${confidenceScore}%` : "—"}</span>
          </Label>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={confidenceScore ?? 50}
              onChange={(e) => setConfidenceScore(parseInt(e.target.value))}
              className="flex-1 h-2 accent-primary cursor-pointer"
            />
            {confidenceScore !== null && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs text-muted-foreground"
                onClick={() => setConfidenceScore(null)}
                title="Réinitialiser"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex-1" />

      {/* Won / Lost icons */}
      {(salesStatus === "WON" || salesStatus === "LOST") && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
          onClick={() => handlers.handleSalesStatusChange(salesStatus)}
          disabled={updatePending}
          title="Réouvrir l'opportunité"
        >
          <Undo2 className="h-4 w-4" />
          <span className="text-xs">Réouvrir</span>
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "gap-1 text-green-600 hover:text-green-700 hover:bg-green-50",
          salesStatus === "WON" && "bg-green-100 text-green-700"
        )}
        onClick={() => { trackFeature("mark_won", "crm"); handlers.handleSalesStatusChange("WON"); }}
        disabled={updatePending}
        title="Gagné"
      >
        <Trophy className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "gap-1 text-red-600 hover:text-red-700 hover:bg-red-50",
          salesStatus === "LOST" && "bg-red-100 text-red-700"
        )}
        onClick={() => { trackFeature("mark_lost", "crm"); handlers.handleSalesStatusChange("LOST"); }}
        disabled={updatePending}
        title="Perdu"
      >
        <XCircle className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default CardDetailToolbar;
