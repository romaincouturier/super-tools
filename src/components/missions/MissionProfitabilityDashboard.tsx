import { useState, useMemo } from "react";
import { TrendingUp, Calculator, Euro, Calendar, Settings, Target, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useUserPreference } from "@/hooks/useUserPreferences";
import { useMissions, useAllMissionActivities } from "@/hooks/useMissions";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  computeProfitabilityIndicators,
  defaultProfitabilitySettings as defaultSettings,
  HOURS_PER_DAY,
  type ProfitabilitySettings,
} from "@/lib/missionProfitability";

const MissionProfitabilityDashboard = () => {
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Load settings from user preferences
  const {
    value: settings,
    loading: settingsLoading,
    save: saveSettings,
  } = useUserPreference<ProfitabilitySettings>("profitability_settings", defaultSettings);

  // Get missions + every activity (needed for accurate profitability math
  // based on the activity table rather than the cached mission aggregates).
  const { data: missions, isLoading: missionsLoading } = useMissions();
  const { data: allActivities, isLoading: activitiesLoading } = useAllMissionActivities();

  // Local settings state for dialog
  const [localSettings, setLocalSettings] = useState<ProfitabilitySettings>(defaultSettings);

  // Open settings dialog
  const handleOpenSettings = () => {
    setLocalSettings(settings || defaultSettings);
    setShowSettings(true);
  };

  // Save settings
  const handleSaveSettings = async () => {
    try {
      await saveSettings(localSettings);
      toast({ title: "Paramètres sauvegardés" });
      setShowSettings(false);
    } catch (error: unknown) {
      toastError(toast, error instanceof Error ? error : "Erreur inconnue");
    }
  };

  // Profitability indicators — pure calculation extracted to
  // src/lib/missionProfitability.ts (tested there).
  const indicators = useMemo(
    () => computeProfitabilityIndicators(settings || defaultSettings, missions || [], allActivities || []),
    [settings, missions, allActivities],
  );

  if (settingsLoading || missionsLoading || activitiesLoading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between mb-2">
            <span className="font-medium">Tableau de bord rentabilité</span>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
      <div className="space-y-4">
        {/* Main Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* TJM Recommandé */}
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    TJM Recommandé
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Tarif journalier minimum pour atteindre vos objectifs de revenus, basé sur vos charges et le nombre de jours facturables.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold text-blue-600">
                    {indicators.recommendedTJM.toLocaleString("fr-FR")} €
                  </p>
                </div>
                <Calculator className="h-8 w-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>

          {/* TJM Réel */}
          <Card className={`border-l-4 ${indicators.tjmIsGood ? 'border-l-green-500' : 'border-l-orange-500'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    TJM Réel
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Moyenne réelle = CA facturé ÷ jours facturés, sur les missions terminées cette année (1j = {HOURS_PER_DAY}h).</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className={`text-xl font-bold ${indicators.tjmIsGood ? 'text-green-600' : 'text-orange-600'}`}>
                    {indicators.actualTJM > 0 ? `${indicators.actualTJM.toLocaleString("fr-FR")} €` : '-'}
                  </p>
                </div>
                {indicators.tjmIsGood ? (
                  <CheckCircle className="h-8 w-8 text-green-500/30" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-orange-500/30" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Seuil de Rentabilité */}
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Seuil Mensuel
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>CA minimum mensuel pour couvrir vos charges fixes. En dessous, vous perdez de l'argent.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold text-purple-600">
                    {indicators.breakEvenMonthly.toLocaleString("fr-FR")} €
                  </p>
                </div>
                <Target className="h-8 w-8 text-purple-500/30" />
              </div>
            </CardContent>
          </Card>

          {/* CA Facturé */}
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    CA Facturé {new Date().getFullYear()}
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Somme des montants des activités marquées "facturées" sur les missions terminées, dans l'année en cours.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold text-green-600">
                    {indicators.totalBilledCA.toLocaleString("fr-FR")} €
                  </p>
                </div>
                <Euro className="h-8 w-8 text-green-500/30" />
              </div>
            </CardContent>
          </Card>

          {/* Jours Facturés */}
          <Card className="border-l-4 border-l-teal-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Jours facturés
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Somme des durées des activités facturées (missions terminées). Les heures sont converties en jours sur la base de {HOURS_PER_DAY}h/jour.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold text-teal-600">
                    {Math.round(indicators.totalBilledDays * 10) / 10}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{(settings || defaultSettings).billableDaysPerYear}
                    </span>
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-teal-500/30" />
              </div>
            </CardContent>
          </Card>

          {/* Marge Nette */}
          <Card className={`border-l-4 ${indicators.netMarginRate >= 40 ? 'border-l-green-500' : indicators.netMarginRate >= 20 ? 'border-l-yellow-500' : 'border-l-red-500'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Marge Nette
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Pourcentage de bénéfice après déduction des charges. Cible: 40-60%.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className={`text-xl font-bold ${indicators.netMarginRate >= 40 ? 'text-green-600' : indicators.netMarginRate >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {indicators.netMarginRate}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>

          {/* Reste à facturer */}
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Reste à facturer
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Montant total non encore facturé sur l'ensemble des missions non annulées (budget initial - activités déjà facturées).</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold text-amber-600">
                    {indicators.totalRemainingToBill.toLocaleString("fr-FR")} €
                  </p>
                </div>
                <Euro className="h-8 w-8 text-amber-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardContent className="px-4 py-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Objectif annuel</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${indicators.isOnTrack ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {indicators.isOnTrack ? 'En bonne voie' : 'En retard'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  {indicators.totalBilledCA.toLocaleString("fr-FR")} € / {indicators.annualGoal.toLocaleString("fr-FR")} €
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleOpenSettings}>
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <Progress value={indicators.progressPercentage} className="h-2" />
              {/* Expected progress marker */}
              <div
                className="absolute top-0 w-0.5 h-2 bg-gray-400"
                style={{ left: `${indicators.expectedProgress}%` }}
                title={`Progression attendue: ${indicators.expectedProgress}%`}
              />
            </div>
            <div className="flex justify-between mt-0.5 text-xs text-muted-foreground">
              <span>{indicators.progressPercentage}% réalisé</span>
              <span>Attendu: {indicators.expectedProgress}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Settings Dialog */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="w-full sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Paramètres de rentabilité</DialogTitle>
              <DialogDescription>
                Configurez vos objectifs et charges pour calculer les indicateurs.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Salaire net annuel visé (€)</Label>
                <Input
                  type="number"
                  value={localSettings.targetNetSalary}
                  onChange={(e) => setLocalSettings({
                    ...localSettings,
                    targetNetSalary: parseInt(e.target.value) || 0,
                  })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Charges sociales (%)</Label>
                  <Input
                    type="number"
                    value={localSettings.socialChargesRate}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      socialChargesRate: parseInt(e.target.value) || 0,
                    })}
                  />
                </div>
                <div>
                  <Label>Marge cible (%)</Label>
                  <Input
                    type="number"
                    value={localSettings.targetMarginRate}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      targetMarginRate: parseInt(e.target.value) || 0,
                    })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Charges fixes mensuelles (€)</Label>
                  <Input
                    type="number"
                    value={localSettings.fixedChargesMonthly}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      fixedChargesMonthly: parseInt(e.target.value) || 0,
                    })}
                  />
                </div>
                <div>
                  <Label>Charges variables (%)</Label>
                  <Input
                    type="number"
                    value={localSettings.variableChargesRate}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      variableChargesRate: parseInt(e.target.value) || 0,
                    })}
                  />
                </div>
              </div>
              <div>
                <Label>Jours facturables par an</Label>
                <Input
                  type="number"
                  value={localSettings.billableDaysPerYear}
                  onChange={(e) => setLocalSettings({
                    ...localSettings,
                    billableDaysPerYear: parseInt(e.target.value) || 0,
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Généralement entre 180 et 220 jours (12-18 jours/mois)
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveSettings}>
                Sauvegarder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
        </CollapsibleContent>
      </Collapsible>
    </TooltipProvider>
  );
};

export default MissionProfitabilityDashboard;
