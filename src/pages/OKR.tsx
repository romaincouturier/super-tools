import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Target,
  Plus,
  Star,
  StarOff,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  Edit2,
  Calendar,
  Users,
  TrendingUp,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useOKRObjectives,
  useCreateOKRObjective,
  useUpdateOKRObjective,
  useDeleteOKRObjective,
  useToggleOKRFavorite,
  useOKRKeyResults,
  useCreateOKRKeyResult,
  useUpdateOKRKeyResult,
  useDeleteOKRKeyResult,
} from "@/hooks/useOKR";
import {
  OKRObjective,
  OKRKeyResult,
  OKRTimeTarget,
  OKRCadence,
  OKRStatus,
  okrTimeTargetConfig,
  okrCadenceConfig,
  okrStatusConfig,
  getConfidenceColor,
  getProgressColor,
} from "@/types/okr";
import OKRDetailDrawer from "@/components/okr/OKRDetailDrawer";
import OKRRiskAlerts from "@/components/okr/OKRRiskAlerts";
import OKRExecutiveSnapshot from "@/components/okr/OKRExecutiveSnapshot";
import OKRAIChat from "@/components/okr/OKRAIChat";
import { useOKRInsights } from "@/hooks/useOKRInsights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, ShieldAlert } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";

const OKR = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [selectedObjective, setSelectedObjective] = useState<OKRObjective | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeView, setActiveView] = useState("objectives");

  const { data: objectives, isLoading, isError } = useOKRObjectives({ year: selectedYear });
  const { data: insights } = useOKRInsights(selectedYear);
  const createObjective = useCreateOKRObjective();
  const updateObjective = useUpdateOKRObjective();
  const deleteObjective = useDeleteOKRObjective();
  const toggleFavorite = useToggleOKRFavorite();

  // Form state for new objective
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTimeTarget, setNewTimeTarget] = useState<OKRTimeTarget>("Q1");
  const [newCadence, setNewCadence] = useState<OKRCadence>("monthly");
  const [newColor, setNewColor] = useState("#3b82f6");

  const colorOptions = [
    "#3b82f6", // blue
    "#22c55e", // green
    "#eab308", // yellow
    "#f97316", // orange
    "#ef4444", // red
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#14b8a6", // teal
  ];

  const resetForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewTimeTarget("Q1");
    setNewCadence("monthly");
    setNewColor("#3b82f6");
  };

  const handleCreateObjective = async () => {
    if (!newTitle.trim()) {
      toast({ title: "Erreur", description: "Le titre est requis", variant: "destructive" });
      return;
    }

    try {
      await createObjective.mutateAsync({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        time_target: newTimeTarget,
        target_year: selectedYear,
        cadence: newCadence,
        color: newColor,
      });
      toast({ title: "Objectif créé" });
      setShowCreateDialog(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleFavorite = async (objective: OKRObjective) => {
    try {
      await toggleFavorite.mutateAsync({
        id: objective.id,
        isFavorite: !objective.is_favorite,
      });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteObjective = async (objective: OKRObjective) => {
    if (!confirm("Supprimer cet objectif et tous ses résultats clés ?")) return;

    try {
      await deleteObjective.mutateAsync(objective.id);
      toast({ title: "Objectif supprimé" });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const toggleExpanded = (objectiveId: string) => {
    const newExpanded = new Set(expandedObjectives);
    if (newExpanded.has(objectiveId)) {
      newExpanded.delete(objectiveId);
    } else {
      newExpanded.add(objectiveId);
    }
    setExpandedObjectives(newExpanded);
  };

  const openDrawer = (objective: OKRObjective) => {
    setSelectedObjective(objective);
    setDrawerOpen(true);
  };

  // Group objectives by time target
  const groupedObjectives = (objectives || []).reduce((acc, obj) => {
    if (!acc[obj.time_target]) {
      acc[obj.time_target] = [];
    }
    acc[obj.time_target].push(obj);
    return acc;
  }, {} as Record<OKRTimeTarget, OKRObjective[]>);

  const favoriteObjectives = (objectives || []).filter((o) => o.is_favorite);

  return (
    <ModuleLayout>
      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">OKR</h1>
                <p className="text-muted-foreground text-sm">Objectifs et Résultats Clés</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvel objectif
            </Button>
          </div>
        </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList>
          <TabsTrigger value="objectives" className="flex items-center gap-1.5">
            <Target className="h-4 w-4" />
            Objectifs
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" />
            AI Mode
          </TabsTrigger>
        </TabsList>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4 mt-4">
          {insights ? (
            <>
              <OKRExecutiveSnapshot snapshot={insights.snapshot} momentum={insights.momentum} />
              <OKRRiskAlerts
                alerts={insights.alerts}
                onClickObjective={(id) => {
                  const obj = objectives?.find((o) => o.id === id);
                  if (obj) openDrawer(obj);
                }}
              />
            </>
          ) : (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
        </TabsContent>

        {/* AI Mode Tab */}
        <TabsContent value="ai" className="mt-4">
          <OKRAIChat year={selectedYear} />
        </TabsContent>

        {/* Objectives Tab */}
        <TabsContent value="objectives" className="space-y-6 mt-4">

      {/* Risk alerts banner on objectives view */}
      {insights && insights.alerts.filter((a) => a.severity === "critical").length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-red-200 bg-red-50 text-sm">
          <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
          <span className="text-red-800">
            {insights.alerts.filter((a) => a.severity === "critical").length} alerte(s) critique(s) détectée(s).
          </span>
          <Button variant="link" size="sm" className="text-red-700 p-0 h-auto" onClick={() => setActiveView("insights")}>
            Voir les détails
          </Button>
        </div>
      )}

      {/* Favorite OKRs */}
      {favoriteObjectives.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {favoriteObjectives.slice(0, 3).map((objective) => (
            <Card
              key={objective.id}
              className="border-2 cursor-pointer hover:shadow-lg transition-shadow"
              style={{ borderColor: objective.color }}
              onClick={() => openDrawer(objective)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <Badge variant="outline">
                      {okrTimeTargetConfig[objective.time_target].shortLabel}
                    </Badge>
                  </div>
                  <Badge
                    style={{
                      backgroundColor: okrStatusConfig[objective.status].color,
                      color: "white",
                    }}
                  >
                    {okrStatusConfig[objective.status].label}
                  </Badge>
                </div>
                <CardTitle className="text-lg mt-2">{objective.title}</CardTitle>
                {objective.next_review_date && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    Prochain suivi : {format(new Date(objective.next_review_date), "d MMM yyyy", { locale: fr })}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progression</span>
                      <span>{objective.progress_percentage}%</span>
                    </div>
                    <Progress
                      value={objective.progress_percentage}
                      className="h-2"
                      style={
                        {
                          "--progress-color": getProgressColor(objective.progress_percentage),
                        } as React.CSSProperties
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Confiance</span>
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: getConfidenceColor(objective.confidence_level),
                        color: getConfidenceColor(objective.confidence_level),
                      }}
                    >
                      {objective.confidence_level}%
                    </Badge>
                  </div>
                  {objective.next_review_date && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Prochain suivi:{" "}
                      {format(new Date(objective.next_review_date), "d MMM", { locale: fr })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Objectives List */}
      {isLoading && !isError ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium mb-1">Module OKR</p>
          <p className="text-sm">Les tables OKR n'ont pas encore été créées. Appliquez la migration pour activer ce module.</p>
        </div>
      ) : objectives && objectives.length > 0 ? (
        <div className="space-y-6">
          {(Object.keys(okrTimeTargetConfig) as OKRTimeTarget[]).map((timeTarget) => {
            const objectivesForTarget = groupedObjectives[timeTarget] || [];
            if (objectivesForTarget.length === 0) return null;

            return (
              <div key={timeTarget}>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {okrTimeTargetConfig[timeTarget].label}
                  <Badge variant="secondary">{objectivesForTarget.length}</Badge>
                </h2>
                <div className="space-y-2">
                  {objectivesForTarget.map((objective) => (
                    <ObjectiveCard
                      key={objective.id}
                      objective={objective}
                      isExpanded={expandedObjectives.has(objective.id)}
                      onToggleExpand={() => toggleExpanded(objective.id)}
                      onToggleFavorite={() => handleToggleFavorite(objective)}
                      onDelete={() => handleDeleteObjective(objective)}
                      onOpenDetail={() => openDrawer(objective)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="py-12">
          <CardContent className="text-center">
            <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">Aucun objectif pour {selectedYear}</h3>
            <p className="text-muted-foreground mb-4">
              Commencez par créer votre premier objectif OKR
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Créer un objectif
            </Button>
          </CardContent>
        </Card>
      )}

        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel Objectif</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titre *</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Augmenter le chiffre d'affaires de 20%"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Décrivez l'objectif..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Période cible</Label>
                <Select
                  value={newTimeTarget}
                  onValueChange={(v) => setNewTimeTarget(v as OKRTimeTarget)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(okrTimeTargetConfig) as OKRTimeTarget[]).map((target) => (
                      <SelectItem key={target} value={target}>
                        {okrTimeTargetConfig[target].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cadence de suivi</Label>
                <Select
                  value={newCadence}
                  onValueChange={(v) => setNewCadence(v as OKRCadence)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(okrCadenceConfig) as OKRCadence[]).map((cadence) => (
                      <SelectItem key={cadence} value={cadence}>
                        {okrCadenceConfig[cadence].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Couleur</Label>
              <div className="flex gap-2 mt-2">
                {colorOptions.map((c) => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      newColor === c ? "border-primary scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateObjective} disabled={createObjective.isPending}>
              {createObjective.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Drawer */}
      <OKRDetailDrawer
        objective={selectedObjective}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
      </main>
    </ModuleLayout>
  );
};

// Objective Card Component
interface ObjectiveCardProps {
  objective: OKRObjective;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onOpenDetail: () => void;
}

const ObjectiveCard = ({
  objective,
  isExpanded,
  onToggleExpand,
  onToggleFavorite,
  onDelete,
  onOpenDetail,
}: ObjectiveCardProps) => {
  const { data: keyResults } = useOKRKeyResults(isExpanded ? objective.id : null);

  return (
    <div
      className="border rounded-lg overflow-hidden"
      style={{ borderLeftWidth: "4px", borderLeftColor: objective.color }}
    >
      <div className="p-4 bg-card">
        <div className="flex items-center gap-3">
          <button onClick={onToggleExpand} className="p-1 hover:bg-muted rounded">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </button>

          <div className="flex-1 cursor-pointer" onClick={onOpenDetail}>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium">{objective.title}</h3>
              <Badge
                variant="outline"
                style={{
                  borderColor: okrStatusConfig[objective.status].color,
                  color: okrStatusConfig[objective.status].color,
                }}
              >
                {okrStatusConfig[objective.status].label}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{okrCadenceConfig[objective.cadence].label}</span>
              {objective.next_review_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(objective.next_review_date), "d MMM", { locale: fr })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium">{objective.progress_percentage}%</div>
              <Progress value={objective.progress_percentage} className="w-24 h-2" />
            </div>
            <Badge
              variant="outline"
              style={{
                borderColor: getConfidenceColor(objective.confidence_level),
                color: getConfidenceColor(objective.confidence_level),
              }}
            >
              {objective.confidence_level}%
            </Badge>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className="p-1 hover:bg-muted rounded"
            >
              {objective.is_favorite ? (
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              ) : (
                <StarOff className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onOpenDetail}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Modifier
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Key Results */}
      {isExpanded && (
        <div className="border-t bg-muted/30 p-4 pl-12">
          {keyResults && keyResults.length > 0 ? (
            <div className="space-y-2">
              {keyResults.map((kr) => (
                <KeyResultRow key={kr.id} keyResult={kr} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun résultat clé. Ouvrez l'objectif pour en ajouter.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// Key Result Row Component
const KeyResultRow = ({ keyResult }: { keyResult: OKRKeyResult }) => {
  return (
    <div className="flex items-center gap-4 py-2 px-3 bg-card rounded border">
      <TrendingUp className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-sm font-medium">{keyResult.title}</div>
        {keyResult.target_value && (
          <div className="text-xs text-muted-foreground">
            {keyResult.current_value} / {keyResult.target_value} {keyResult.unit}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Progress value={keyResult.progress_percentage} className="w-20 h-2" />
        <span className="text-sm w-10 text-right">{keyResult.progress_percentage}%</span>
      </div>
    </div>
  );
};

export default OKR;
