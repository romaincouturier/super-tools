import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Car } from "lucide-react";
import { useTravelExpenses } from "@/hooks/useTravelExpenses";
import {
  TravelSettingsPanel,
  FavoritesPills,
  DestinationsList,
} from "@/components/travel/TravelExpenseShared";
import { formatEur } from "@/lib/travelExpenseUtils";

// Re-export types for backward compatibility
export type {
  TravelSettings,
  TravelDestination,
} from "@/lib/travelExpenseUtils";

interface TravelExpenseCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    total: number,
    destinations: import("@/lib/travelExpenseUtils").TravelDestination[],
    settings: import("@/lib/travelExpenseUtils").TravelSettings
  ) => void;
  initialDestinations?: import("@/lib/travelExpenseUtils").TravelDestination[];
  initialSettings?: import("@/lib/travelExpenseUtils").TravelSettings;
}

const TravelExpenseCalculator = ({
  open,
  onOpenChange,
  onConfirm,
  initialDestinations,
  initialSettings,
}: TravelExpenseCalculatorProps) => {
  const travel = useTravelExpenses();

  // Re-initialize when dialog opens
  useEffect(() => {
    if (open) {
      travel.reinitialize(initialSettings, initialDestinations);
    }
  }, [open, initialDestinations, initialSettings]);

  const handleConfirm = () => {
    onConfirm(travel.grandTotal, travel.destinations, travel.settings);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Calculateur de frais de déplacement
          </DialogTitle>
          <DialogDescription>
            Configurez vos paramètres et ajoutez des destinations pour estimer les frais de déplacement.
          </DialogDescription>
        </DialogHeader>

        <TravelSettingsPanel
          settings={travel.settings}
          settingsOpen={travel.settingsOpen}
          onSettingsOpenChange={travel.setSettingsOpen}
          onUpdateSetting={travel.updateSetting}
        />

        <FavoritesPills
          favorites={travel.favorites}
          onApply={travel.applyFavorite}
          onRemove={travel.removeFavorite}
        />

        <DestinationsList
          destinations={travel.destinations}
          destCosts={travel.destCosts}
          ikRate={travel.ikRate}
          favorites={travel.favorites}
          onUpdate={travel.updateDest}
          onRemove={travel.removeDestination}
          onAdd={travel.addDestination}
          onCitySelect={travel.handleCitySelect}
          onModeChange={travel.handleModeChange}
          onAddFavorite={travel.addFavorite}
        />

        {/* Total */}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total frais de déplacement</span>
            <span className="text-lg font-bold text-green-700">{formatEur(travel.grandTotal)} €</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleConfirm}>Appliquer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TravelExpenseCalculator;
