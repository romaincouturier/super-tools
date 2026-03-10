import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Car, ArrowRight, SkipForward } from "lucide-react";
import TravelExpenseCalculator, {
  type TravelDestination,
  type TravelSettings,
} from "@/components/crm/TravelExpenseCalculator";

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
  const [showCalc, setShowCalc] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const [destinations, setDestinations] = useState<TravelDestination[]>(initialDestinations || []);
  const [settings, setSettings] = useState<TravelSettings | null>(initialSettings || null);
  const [confirmed, setConfirmed] = useState(initialTotal > 0);

  const handleConfirm = (t: number, d: TravelDestination[], s: TravelSettings) => {
    setTotal(t);
    setDestinations(d);
    setSettings(s);
    setConfirmed(true);
    setShowCalc(false);
  };

  const formatEur = (n: number) =>
    n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

          {confirmed && total > 0 ? (
            <div className="p-4 border rounded-md bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total estimé</span>
                <span className="text-lg font-bold text-primary">{formatEur(total)} €</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {destinations.length} destination{destinations.length > 1 ? "s" : ""} configurée{destinations.length > 1 ? "s" : ""}
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowCalc(true)} className="gap-2">
                <Car className="w-4 h-4" />
                Modifier le calcul
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowCalc(true)} className="gap-2 w-full py-8 text-base">
              <Car className="w-5 h-5" />
              Ouvrir le calculateur de frais
            </Button>
          )}
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
          onClick={() => onContinue(total, destinations, settings)}
          size="lg"
          className="gap-2"
        >
          Continuer
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      <TravelExpenseCalculator
        open={showCalc}
        onOpenChange={setShowCalc}
        onConfirm={handleConfirm}
        initialDestinations={destinations.length > 0 ? destinations : undefined}
        initialSettings={settings || undefined}
      />
    </div>
  );
}
