import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2, ChevronLeft, ChevronRight, Target, TrendingUp, DollarSign, Loader2 } from "lucide-react";
import type { CommercialCoachContext, CrmRevenueTarget } from "@/types/crm";

interface CoachCommercialSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CoachCommercialSettings({ open, onOpenChange }: CoachCommercialSettingsProps) {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  // --- Ambition state ---
  const [ambitionYear, setAmbitionYear] = useState(currentYear);
  const [ambitionContent, setAmbitionContent] = useState("");
  const [ambitionSaving, setAmbitionSaving] = useState(false);
  const [ambitionLoading, setAmbitionLoading] = useState(false);
  const [ambitionHistory, setAmbitionHistory] = useState<CommercialCoachContext[]>([]);

  // --- Acquisition structure state ---
  const [acquisitionYear, setAcquisitionYear] = useState(currentYear);
  const [acquisitionContent, setAcquisitionContent] = useState("");
  const [acquisitionSaving, setAcquisitionSaving] = useState(false);
  const [acquisitionLoading, setAcquisitionLoading] = useState(false);
  const [acquisitionHistory, setAcquisitionHistory] = useState<CommercialCoachContext[]>([]);

  // --- Revenue targets state ---
  const [revenueTargets, setRevenueTargets] = useState<CrmRevenueTarget[]>([]);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [newTargetType, setNewTargetType] = useState<"monthly" | "quarterly" | "annual">("monthly");
  const [newTargetStart, setNewTargetStart] = useState("");
  const [newTargetAmount, setNewTargetAmount] = useState("");
  const [addingTarget, setAddingTarget] = useState(false);

  // --- Load ambition for a given year ---
  const loadAmbition = useCallback(async (year: number) => {
    setAmbitionLoading(true);
    const { data } = await (supabase as any)
      .from("commercial_coach_contexts")
      .select("*")
      .eq("context_type", "ambition")
      .eq("year", year)
      .maybeSingle();
    setAmbitionContent(data?.content || "");
    setAmbitionLoading(false);
  }, []);

  // --- Load acquisition for a given year ---
  const loadAcquisition = useCallback(async (year: number) => {
    setAcquisitionLoading(true);
    const { data } = await (supabase as any)
      .from("commercial_coach_contexts")
      .select("*")
      .eq("context_type", "acquisition_structure")
      .eq("year", year)
      .maybeSingle();
    setAcquisitionContent(data?.content || "");
    setAcquisitionLoading(false);
  }, []);

  // --- Load all history ---
  const loadHistory = useCallback(async () => {
    const { data: ambitions } = await (supabase as any)
      .from("commercial_coach_contexts")
      .select("*")
      .eq("context_type", "ambition")
      .order("year", { ascending: false });
    setAmbitionHistory(ambitions || []);

    const { data: acquisitions } = await (supabase as any)
      .from("commercial_coach_contexts")
      .select("*")
      .eq("context_type", "acquisition_structure")
      .order("year", { ascending: false });
    setAcquisitionHistory(acquisitions || []);
  }, []);

  // --- Load revenue targets ---
  const loadRevenueTargets = useCallback(async () => {
    setRevenueLoading(true);
    const { data } = await (supabase as any)
      .from("crm_revenue_targets")
      .select("*")
      .order("period_start", { ascending: false });
    setRevenueTargets((data || []) as CrmRevenueTarget[]);
    setRevenueLoading(false);
  }, []);

  // Load all data when drawer opens
  useEffect(() => {
    if (open) {
      loadAmbition(ambitionYear);
      loadAcquisition(acquisitionYear);
      loadHistory();
      loadRevenueTargets();
    }
  }, [open, ambitionYear, acquisitionYear, loadAmbition, loadAcquisition, loadHistory, loadRevenueTargets]);

  // --- Save ambition ---
  const saveAmbition = async () => {
    setAmbitionSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await (supabase as any)
      .from("commercial_coach_contexts")
      .upsert(
        {
          context_type: "ambition",
          year: ambitionYear,
          content: ambitionContent,
          updated_at: new Date().toISOString(),
          created_by: session?.user?.id || null,
        },
        { onConflict: "context_type,year" }
      );
    if (error) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    } else {
      toast({ title: "Ambition sauvegardée" });
      loadHistory();
    }
    setAmbitionSaving(false);
  };

  // --- Save acquisition structure ---
  const saveAcquisition = async () => {
    setAcquisitionSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await (supabase as any)
      .from("commercial_coach_contexts")
      .upsert(
        {
          context_type: "acquisition_structure",
          year: acquisitionYear,
          content: acquisitionContent,
          updated_at: new Date().toISOString(),
          created_by: session?.user?.id || null,
        },
        { onConflict: "context_type,year" }
      );
    if (error) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    } else {
      toast({ title: "Structure d'acquisition sauvegardée" });
      loadHistory();
    }
    setAcquisitionSaving(false);
  };

  // --- Add revenue target ---
  const addRevenueTarget = async () => {
    if (!newTargetStart || !newTargetAmount) return;
    setAddingTarget(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await (supabase as any)
      .from("crm_revenue_targets")
      .insert({
        period_type: newTargetType,
        period_start: newTargetStart,
        target_amount: parseFloat(newTargetAmount),
        created_by: session?.user?.id || null,
      });
    if (error) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    } else {
      toast({ title: "Objectif ajouté" });
      setShowAddTarget(false);
      setNewTargetStart("");
      setNewTargetAmount("");
      loadRevenueTargets();
    }
    setAddingTarget(false);
  };

  // --- Delete revenue target ---
  const deleteRevenueTarget = async (id: string) => {
    const { error } = await (supabase as any)
      .from("crm_revenue_targets")
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    } else {
      toast({ title: "Objectif supprimé" });
      loadRevenueTargets();
    }
  };

  const formatEuro = (v: number) => `${v.toLocaleString("fr-FR")} €`;

  const periodLabel = (target: CrmRevenueTarget) => {
    const d = new Date(target.period_start);
    if (target.period_type === "monthly") {
      return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    }
    if (target.period_type === "quarterly") {
      const q = Math.ceil((d.getMonth() + 1) / 3);
      return `T${q} ${d.getFullYear()}`;
    }
    return `Année ${d.getFullYear()}`;
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Paramètres du Coach Commercial</SheetTitle>
          <SheetDescription>
            Configurez les informations que le coach utilisera pour ses analyses et recommandations.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="ambition" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ambition" className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm px-1 sm:px-3">
              <Target className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Ambition</span>
            </TabsTrigger>
            <TabsTrigger value="acquisition" className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm px-1 sm:px-3">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Acquisition</span>
            </TabsTrigger>
            <TabsTrigger value="objectifs" className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm px-1 sm:px-3">
              <DollarSign className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Objectifs</span>
            </TabsTrigger>
          </TabsList>

          {/* ===================== AMBITION TAB ===================== */}
          <TabsContent value="ambition" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ambition annuelle</CardTitle>
                <CardDescription>
                  Décrivez votre vision et ambition commerciale pour l'année. Le coach utilisera ce texte pour cadrer ses recommandations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Year selector */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setAmbitionYear((y) => y - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Badge variant="outline" className="text-sm px-3 py-1">
                    {ambitionYear}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setAmbitionYear((y) => y + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {ambitionYear !== currentYear && (
                    <Button
                      variant="link"
                      size="sm"
                      className="text-xs"
                      onClick={() => setAmbitionYear(currentYear)}
                    >
                      Année en cours
                    </Button>
                  )}
                </div>

                {/* Content */}
                {ambitionLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Textarea
                    value={ambitionContent}
                    onChange={(e) => setAmbitionContent(e.target.value)}
                    rows={8}
                    placeholder={`Décrivez votre ambition pour ${ambitionYear}...\n\nExemple :\n- Atteindre 200k€ de CA dont 60% en missions\n- Développer 3 nouveaux clients grands comptes\n- Lancer une offre de facilitation graphique\n- Doubler le nombre de formations en catalogue`}
                    className="resize-y"
                  />
                )}

                <Button
                  onClick={saveAmbition}
                  disabled={ambitionSaving}
                  className="w-full"
                >
                  {ambitionSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Sauvegarder
                </Button>
              </CardContent>
            </Card>

            {/* History */}
            {ambitionHistory.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">Historique des ambitions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {ambitionHistory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setAmbitionYear(item.year)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        item.year === ambitionYear
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant={item.year === currentYear ? "default" : "secondary"} className="text-xs">
                          {item.year}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Mis à jour le {new Date(item.updated_at).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.content}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===================== ACQUISITION TAB ===================== */}
          <TabsContent value="acquisition" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Structure d'acquisition clients</CardTitle>
                <CardDescription>
                  Décrivez comment vous acquérez vos clients, vos canaux, votre stratégie. Le coach utilisera ce contexte pour ses analyses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Year selector */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setAcquisitionYear((y) => y - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Badge variant="outline" className="text-sm px-3 py-1">
                    {acquisitionYear}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setAcquisitionYear((y) => y + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {acquisitionYear !== currentYear && (
                    <Button
                      variant="link"
                      size="sm"
                      className="text-xs"
                      onClick={() => setAcquisitionYear(currentYear)}
                    >
                      Année en cours
                    </Button>
                  )}
                </div>

                {/* Content */}
                {acquisitionLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Textarea
                    value={acquisitionContent}
                    onChange={(e) => setAcquisitionContent(e.target.value)}
                    rows={8}
                    placeholder={`Décrivez votre structure d'acquisition pour ${acquisitionYear}...\n\nExemple :\n- 70% du CA vient de recommandations (bouche à oreille)\n- LinkedIn génère 20% des leads formation\n- Les missions arrivent principalement via réseau professionnel\n- Pas encore de stratégie d'acquisition digitale structurée\n- 3 clients représentent 50% du CA récurrent`}
                    className="resize-y"
                  />
                )}

                <Button
                  onClick={saveAcquisition}
                  disabled={acquisitionSaving}
                  className="w-full"
                >
                  {acquisitionSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Sauvegarder
                </Button>
              </CardContent>
            </Card>

            {/* History */}
            {acquisitionHistory.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">Historique</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {acquisitionHistory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setAcquisitionYear(item.year)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        item.year === acquisitionYear
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant={item.year === currentYear ? "default" : "secondary"} className="text-xs">
                          {item.year}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Mis à jour le {new Date(item.updated_at).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.content}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===================== REVENUE TARGETS TAB ===================== */}
          <TabsContent value="objectifs" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Objectifs de chiffre d'affaires</CardTitle>
                    <CardDescription>
                      Définissez vos objectifs CA par période. Le coach comparera ces objectifs au CA réalisé.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddTarget(!showAddTarget)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add form */}
                {showAddTarget && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 sm:p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Type de période</Label>
                        <Select value={newTargetType} onValueChange={(v) => setNewTargetType(v as typeof newTargetType)}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Mensuel</SelectItem>
                            <SelectItem value="quarterly">Trimestriel</SelectItem>
                            <SelectItem value="annual">Annuel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Début de période</Label>
                        <Input
                          type="date"
                          value={newTargetStart}
                          onChange={(e) => setNewTargetStart(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Objectif (€)</Label>
                        <Input
                          type="number"
                          value={newTargetAmount}
                          onChange={(e) => setNewTargetAmount(e.target.value)}
                          placeholder="50000"
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setShowAddTarget(false)}>
                        Annuler
                      </Button>
                      <Button
                        size="sm"
                        onClick={addRevenueTarget}
                        disabled={!newTargetStart || !newTargetAmount || addingTarget}
                      >
                        {addingTarget ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ajouter"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Target list */}
                {revenueLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : revenueTargets.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Aucun objectif défini. Ajoutez vos objectifs CA mensuels, trimestriels ou annuels.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {revenueTargets.map((target) => {
                      const now = new Date();
                      const start = new Date(target.period_start);
                      let end = new Date(start);
                      if (target.period_type === "monthly") end.setMonth(end.getMonth() + 1);
                      else if (target.period_type === "quarterly") end.setMonth(end.getMonth() + 3);
                      else end.setFullYear(end.getFullYear() + 1);
                      const isCurrent = now >= start && now < end;
                      const isPast = now >= end;

                      return (
                        <div
                          key={target.id}
                          className={`flex items-center justify-between rounded-lg border p-3 ${
                            isCurrent ? "border-primary bg-primary/5" : isPast ? "opacity-60" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant={
                              target.period_type === "annual" ? "default" :
                              target.period_type === "quarterly" ? "secondary" : "outline"
                            } className="text-xs">
                              {target.period_type === "monthly" ? "Mois" :
                               target.period_type === "quarterly" ? "Trim." : "Année"}
                            </Badge>
                            <div>
                              <p className="text-sm font-medium">{periodLabel(target)}</p>
                              <p className="text-xs text-muted-foreground">
                                Objectif : {formatEuro(target.target_amount)}
                                {isCurrent && " — en cours"}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteRevenueTarget(target.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
