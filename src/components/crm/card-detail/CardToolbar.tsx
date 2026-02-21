import {
  Calendar,
  ChevronDown,
  MoreVertical,
  Trophy,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CrmColumn, SalesStatus } from "@/types/crm";

interface CardToolbarProps {
  columnId: string;
  allColumns: CrmColumn[];
  estimatedValue: string;
  confidenceScore: number | null;
  salesStatus: SalesStatus;
  isPending: boolean;
  onColumnChange: (columnId: string, columnName: string) => void;
  onSalesStatusChange: (status: SalesStatus) => void;
  onShowSchedule: () => void;
}

const CardToolbar = ({
  columnId,
  allColumns,
  estimatedValue,
  confidenceScore,
  salesStatus,
  isPending,
  onColumnChange,
  onSalesStatusChange,
  onShowSchedule,
}: CardToolbarProps) => {
  return (
    <div className="mt-4 mb-4 flex items-center gap-2">
      {/* Action menu (left) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={onShowSchedule}>
            <Calendar className="h-4 w-4 mr-2" />
            Programmer une action
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Column selector (center) */}
      <DropdownMenu>
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
              onClick={() => onColumnChange(col.id, col.name)}
              disabled={isPending || col.id === columnId}
              className={cn(col.id === columnId && "font-semibold bg-accent")}
            >
              {col.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Estimated value */}
      {estimatedValue && parseFloat(estimatedValue) > 0 && (
        <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200 text-sm font-medium">
          {Number(parseFloat(estimatedValue) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €
        </Badge>
      )}

      {/* Confidence score badge */}
      {confidenceScore !== null && (
        <Badge
          variant="outline"
          className={cn(
            "text-xs font-medium",
            confidenceScore >= 70 && "border-green-300 text-green-700 bg-green-50",
            confidenceScore >= 40 && confidenceScore < 70 && "border-orange-300 text-orange-700 bg-orange-50",
            confidenceScore < 40 && "border-red-300 text-red-700 bg-red-50",
          )}
        >
          {confidenceScore}% confiance
        </Badge>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Won / Lost icons */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "gap-1 text-green-600 hover:text-green-700 hover:bg-green-50",
          salesStatus === "WON" && "bg-green-100 text-green-700"
        )}
        onClick={() => onSalesStatusChange("WON")}
        disabled={isPending}
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
        onClick={() => onSalesStatusChange("LOST")}
        disabled={isPending}
        title="Perdu"
      >
        <XCircle className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default CardToolbar;
