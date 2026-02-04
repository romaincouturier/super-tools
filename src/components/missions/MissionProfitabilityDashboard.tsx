import { useState, useMemo } from "react";
import {
  TrendingUp,
  Calculator,
  Euro,
  Calendar,
  Settings,
  Target,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
} from "lucide-react";
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
import { useUserPreference } from "@/hooks/useUserPreferences";
import { useMissions, useMissionActivities } from "@/hooks/useMissions";
import { useToast } from "@/hooks/use-toast";

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

  // Load settings from user preferences
  const {
    value: settings,
    loading: settingsLoading,
    save: saveSettings,
  } = useUserPreference<ProfitabilitySettings>("profitability_settings", defaultSettings);

  // Get missions data
  const { data: missions, isLoading: missionsLoading } = useMissions();

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
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  // Calculate profitability indicators
  const indicators = useMemo(() => {
    const s = settings || defaultSettings;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    // Total annual costs
    const socialCharges = s.targetNetSalary * (s.socialChargesRate / 100);
    const fixedChargesAnnual = s.fixedChargesMonthly * 12;
    const totalAnnualCosts = s.targetNetSalary + socialCharges + fixedChargesAnnual;

    // Add target margin
    const totalWithMargin = totalAnnualCosts * (1 + s.targetMarginRate / 100);

    // Recommended TJM
    const recommendedTJM = Math.ceil(totalWithMargin / s.billableDaysPerYear);

    // Break-even point (monthly)
    const marginRateOnVariableCosts = (100 - s.variableChargesRate) / 100;
    const breakEvenMonthly = Math.ceil(s.fixedChargesMonthly / marginRateOnVariableCosts);

    // Calculate actual CA from missions this year
    const yearMissions = missions?.filter(m => {
      const startYear = m.start_date ? new Date(m.start_date).getFullYear() : null;
      return startYear === currentYear;
    }) || [];

    // Sum of billed amounts from missions
    const totalBilledCA = yearMissions.reduce((sum, m) => sum + (m.billed_amount || 0), 0);
    const totalConsumedCA = yearMissions.reduce((sum, m) => sum + (m.consumed_amount || 0), 0);
    const totalInitialBudget = yearMissions.reduce((sum, m) => sum + (m.initial_amount || 0), 0);

    // Count billed days from missions (using total_days for completed missions)
    const totalBilledDays = yearMissions
      .filter(m => m.status === 'completed')
      .reduce((sum, m) => sum + (m.total_days || 0), 0);

    // Estimated days in progress
    const inProgressDays = yearMissions
      .filter(m => m.status === 'in_progress')
      .reduce((sum, m) => sum + (m.total_days || 0), 0);

    // Calculate average actual TJM
    const actualTJM = totalBilledDays > 0
      ? Math.round(totalBilledCA / totalBilledDays)
      : 0;

    // Progress towards annual goal
    const annualGoal = totalWithMargin;
    const progressPercentage = Math.min(100, Math.round((totalBilledCA / annualGoal) * 100));

    // Expected progress at this point in the year
    const monthsElapsed = currentMonth + 1;
    const expectedProgress = Math.round((monthsElapsed / 12) * 100);

    // Net margin calculation
    const variableCosts = totalBilledCA * (s.variableChargesRate / 100);
    const netProfit = totalBilledCA - variableCosts - (s.fixedChargesMonthly * monthsElapsed);
    const netMarginRate = totalBilledCA > 0
      ? Math.round((netProfit / totalBilledCA) * 100)
      : 0;

    // Status indicators
    const isOnTrack = progressPercentage >= expectedProgress - 10;
    const tjmIsGood = actualTJM >= recommendedTJM * 0.9;

    return {
      recommendedTJM,
      breakEvenMonthly,
      totalBilledCA,
      totalConsumedCA,
      totalInitialBudget,
      totalBilledDays,
      inProgressDays,
      actualTJM,
      annualGoal,
      progressPercentage,
      expectedProgress,
      netMarginRate,
      netProfit,
      isOnTrack,
      tjmIsGood,
      monthsElapsed,
      activeMissions: yearMissions.filter(m => m.status === 'in_progress').length,
      completedMissions: yearMissions.filter(m => m.status === 'completed').length,
    };
  }, [settings, missions]);

  if (settingsLoading || missionsLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4 mb-6">
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
                        <p>Moyenne de votre tarif journalier réel basé sur les missions facturées cette année.</p>
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
                  <p className="text-xs text-muted-foreground">CA Facturé {new Date().getFullYear()}</p>
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
                  <p className="text-xs text-muted-foreground">Jours facturés</p>
                  <p className="text-xl font-bold text-teal-600">
                    {indicators.totalBilledDays}
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
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Objectif annuel</span>
                <span className={`text-xs px-2 py-0.5 rounded ${indicators.isOnTrack ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {indicators.isOnTrack ? 'En bonne voie' : 'En retard'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  {indicators.totalBilledCA.toLocaleString("fr-FR")} € / {indicators.annualGoal.toLocaleString("fr-FR")} €
                </span>
                <Button variant="ghost" size="sm" onClick={handleOpenSettings}>
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <Progress value={indicators.progressPercentage} className="h-3" />
              {/* Expected progress marker */}
              <div
                className="absolute top-0 w-0.5 h-3 bg-gray-400"
                style={{ left: `${indicators.expectedProgress}%` }}
                title={`Progression attendue: ${indicators.expectedProgress}%`}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>{indicators.progressPercentage}% réalisé</span>
              <span>Attendu à ce jour: {indicators.expectedProgress}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Settings Dialog */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="max-w-md">
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
    </TooltipProvider>
  );
};

export default MissionProfitabilityDashboard;
