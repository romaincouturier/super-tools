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

/** Hours-to-days conversion used throughout the dashboard. */
const HOURS_PER_DAY = 6;

// Default profitability settings
interface ProfitabilitySettings {
  targetNetSalary: number; // Salaire net annuel visé
  socialChargesRate: number; // Taux de charges sociales (%)
  fixedChargesMonthly: number; // Charges fixes mensuelles
  variableChargesRate: number; // Taux de charges variables (%)
  targetMarginRate: number; // Marge bénéficiaire cible (%)
  billableDaysPerYear: number; // Jours facturables par an
}

const defaultSettings: ProfitabilitySettings = {
  targetNetSalary: 60000,
  socialChargesRate: 45,
  fixedChargesMonthly: 800,
  variableChargesRate: 10,
  targetMarginRate: 25,
  billableDaysPerYear: 180,
};

const MissionProfitabilityDashboard = () => {
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [isOpen, setIsOpen] = useState(() => window.innerWidth >= 768);

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

  // Calculate profitability indicators.
  //
  // Source of truth: `mission_activities` (not `missions.billed_amount`).
  // We filter on two axes:
  //   - mission.status === 'completed' → "missions terminées"
  //   - activity.is_billed === true   → "activités facturées"
  // All hour durations are converted to days via HOURS_PER_DAY (6h = 1j).
  const indicators = useMemo(() => {
    const s = settings || defaultSettings;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const yearStart = new Date(currentYear, 0, 1);

    // Annual cost + target
    const socialCharges = s.targetNetSalary * (s.socialChargesRate / 100);
    const fixedChargesAnnual = s.fixedChargesMonthly * 12;
    const totalAnnualCosts = s.targetNetSalary + socialCharges + fixedChargesAnnual;
    const totalWithMargin = totalAnnualCosts * (1 + s.targetMarginRate / 100);
    const annualGoal = totalWithMargin;
    const recommendedTJM = Math.ceil(totalWithMargin / s.billableDaysPerYear);

    // Monthly break-even
    const marginRateOnVariableCosts = (100 - s.variableChargesRate) / 100;
    const breakEvenMonthly = Math.ceil(s.fixedChargesMonthly / marginRateOnVariableCosts);

    // Map of completed missions for fast lookup.
    const completedMissionMap = new Map<string, { id: string; title: string }>();
    (missions || []).forEach((m) => {
      if (m.status === "completed") completedMissionMap.set(m.id, { id: m.id, title: m.title });
    });

    // Consider activities that belong to a completed mission AND fall in the
    // current year (by `activity_date`).
    const yearActivities = (allActivities || []).filter((a) => {
      if (!completedMissionMap.has(a.mission_id)) return false;
      if (!a.activity_date) return false;
      const d = new Date(a.activity_date);
      return d >= yearStart && d <= now;
    });

    // Activity → billable days (1j = 6h).
    const activityDays = (durationType: string, duration: number): number => {
      const n = Number(duration) || 0;
      if (n <= 0) return 0;
      return durationType === "hours" ? n / HOURS_PER_DAY : n;
    };

    // Billed: activities marked is_billed === true
    const billedActivities = yearActivities.filter((a) => a.is_billed === true);
    const totalBilledCA = billedActivities.reduce((sum, a) => sum + (Number(a.billable_amount) || 0), 0);
    const totalBilledDays = billedActivities.reduce((sum, a) => sum + activityDays(a.duration_type, a.duration), 0);

    // Worked (all activities of completed missions, billed or not) — informational.
    const totalWorkedDays = yearActivities.reduce((sum, a) => sum + activityDays(a.duration_type, a.duration), 0);

    // Initial budget scope: sum of initial_amount on completed missions.
    const totalInitialBudget = Array.from(completedMissionMap.keys()).reduce((sum, id) => {
      const m = missions?.find((mm) => mm.id === id);
      return sum + (m?.initial_amount || 0);
    }, 0);

    // Average realised TJM
    const actualTJM = totalBilledDays > 0 ? Math.round(totalBilledCA / totalBilledDays) : 0;

    // Progress vs. annual goal
    const progressPercentage = annualGoal > 0
      ? Math.min(100, Math.round((totalBilledCA / annualGoal) * 100))
      : 0;

    // Expected linear progress at this point in the year
    const monthsElapsed = currentMonth + 1;
    const expectedProgress = Math.round((monthsElapsed / 12) * 100);

    // Net margin calc (billed basis)
    const variableCosts = totalBilledCA * (s.variableChargesRate / 100);
    const netProfit = totalBilledCA - variableCosts - (s.fixedChargesMonthly * monthsElapsed);
    const netMarginRate = totalBilledCA > 0 ? Math.round((netProfit / totalBilledCA) * 100) : 0;

    const isOnTrack = progressPercentage >= expectedProgress - 10;
    const tjmIsGood = actualTJM >= recommendedTJM * 0.9;

    return {
      recommendedTJM,
      breakEvenMonthly,
      totalBilledCA,
      totalInitialBudget,
      totalBilledDays,
      totalWorkedDays,
      actualTJM,
      annualGoal,
      progressPercentage,
      expectedProgress,
      netMarginRate,
      netProfit,
      isOnTrack,
      tjmIsGood,
      monthsElapsed,
      activeMissions: (missions || []).filter((m) => m.status === "in_progress").length,
      completedMissions: completedMissionMap.size,
    };
  }, [settings, missions, allActivities]);

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
