import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Car, ArrowRight, SkipForward, MapPin } from "lucide-react";
import { useTravelExpenses } from "@/hooks/useTravelExpenses";
import { useAppSetting } from "@/hooks/useAppSetting";
import {
  TravelSettingsPanel,
  FavoritesPills,
  DestinationsList,
} from "@/components/travel/TravelExpenseShared";
import { formatEur, type TravelDestination, type TravelSettings } from "@/lib/travelExpenseUtils";

// ---------------------------------------------------------------------------
// Google Maps Embed (unique to this step)
// ---------------------------------------------------------------------------

function GoogleMapsEmbed({
  departure,
  destinations,
}: {
  departure: { lat: number | null; lon: number | null; address: string };
  destinations: TravelDestination[];
}) {
  const apiKey = useAppSetting("google_maps_api_key", "AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8");
  const validDests = destinations.filter((d) => d.lat != null && d.lon != null);
  if (!departure.lat || !departure.lon || validDests.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 h-[250px] flex items-center justify-center text-sm text-muted-foreground">
        <MapPin className="w-4 h-4 mr-2" />
        Sélectionnez un départ et une destination pour afficher la carte
      </div>
    );
  }

  const origin = `${departure.lat},${departure.lon}`;
  const destination = `${validDests[validDests.length - 1].lat},${validDests[validDests.length - 1].lon}`;
  const waypoints = validDests
    .slice(0, -1)
    .map((d) => `${d.lat},${d.lon}`)
    .join("|");

  const params = new URLSearchParams({
    origin,
    destination,
    ...(waypoints ? { waypoints } : {}),
  });

  const embedUrl = `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&${params.toString()}&mode=driving`;

  return (
    <div className="rounded-lg border overflow-hidden h-[250px]">
      <iframe
        src={embedUrl}
        className="w-full h-full border-0"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Carte du trajet"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  onContinue: (travelTotal: number, destinations: TravelDestination[], settings: TravelSettings | null) => void;
  initialTotal?: number;
  initialDestinations?: TravelDestination[];
  initialSettings?: TravelSettings | null;
}

export default function StepTravelExpenses({
  onContinue,
  initialTotal = 0,
  initialDestinations,
  initialSettings,
}: Props) {
  const travel = useTravelExpenses({
    initialSettings,
    initialDestinations,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            Frais de déplacement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Car className="w-4 h-4" />
            <AlertDescription>
              Estimez les frais de déplacement pour cette prestation. Ils pourront être intégrés au devis.
            </AlertDescription>
          </Alert>

          <GoogleMapsEmbed
            departure={{
              lat: travel.settings.departureLat,
              lon: travel.settings.departureLon,
              address: travel.settings.departureAddress,
            }}
            destinations={travel.destinations}
          />

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
              <span className="text-lg font-bold text-primary">{formatEur(travel.grandTotal)} €</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="ghost"
          onClick={() => onContinue(0, [], null)}
          className="gap-2 text-muted-foreground"
        >
          <SkipForward className="w-4 h-4" />
          Passer cette étape
        </Button>
        <Button
          onClick={() => onContinue(travel.grandTotal, travel.destinations, travel.settings)}
          size="lg"
          className="gap-2"
        >
          Continuer vers le client
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
