import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
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
  Save,
  Loader2,
  Plus,
  Trash2,
  Edit2,
  Target,
  TrendingUp,
  Zap,
  Users,
  Calendar,
  ClipboardCheck,
  Settings,
  X,
  Link,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useUpdateOKRObjective,
  useOKRKeyResults,
  useCreateOKRKeyResult,
  useUpdateOKRKeyResult,
  useDeleteOKRKeyResult,
  useOKRInitiatives,
  useCreateOKRInitiative,
  useUpdateOKRInitiative,
  useDeleteOKRInitiative,
  useOKRParticipants,
  useAddOKRParticipant,
  useRemoveOKRParticipant,
  useOKRCheckIns,
  useCreateOKRCheckIn,
} from "@/hooks/useOKR";
import { useMissions, useSearchMissions } from "@/hooks/useMissions";
import {
  OKRObjective,
  OKRKeyResult,
  OKRInitiative,
  OKRTimeTarget,
  OKRCadence,
  OKRStatus,
  okrTimeTargetConfig,
  okrCadenceConfig,
  okrStatusConfig,
  getConfidenceColor,
  getProgressColor,
} from "@/types/okr";

interface OKRDetailDrawerProps {
  objective: OKRObjective | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OKRDetailDrawer = ({ objective, open, onOpenChange }: OKRDetailDrawerProps) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("key-results");

  const updateObjective = useUpdateOKRObjective();
  const { data: keyResults, isLoading: loadingKRs } = useOKRKeyResults(objective?.id || null);
  const { data: participants } = useOKRParticipants(objective?.id || null);
  const { data: checkIns } = useOKRCheckIns(objective?.id || null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<OKRStatus>("draft");
  const [timeTarget, setTimeTarget] = useState<OKRTimeTarget>("Q1");
  const [cadence, setCadence] = useState<OKRCadence>("monthly");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [nextReviewAgenda, setNextReviewAgenda] = useState("");

  // Dialog states
  const [showKRDialog, setShowKRDialog] = useState(false);
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const [showParticipantDialog, setShowParticipantDialog] = useState(false);
  const [editingKR, setEditingKR] = useState<OKRKeyResult | null>(null);

  // Initialize form
  useEffect(() => {
    if (objective) {
      setTitle(objective.title);
      setDescription(objective.description || "");
      setStatus(objective.status);
      setTimeTarget(objective.time_target);
      setCadence(objective.cadence);
      setOwnerEmail(objective.owner_email || "");
      setNextReviewAgenda(objective.next_review_agenda || "");
    }
  }, [objective]);

  const handleSave = async () => {
    if (!objective) return;

    try {
      await updateObjective.mutateAsync({
        id: objective.id,
        updates: {
          title: title.trim(),
          description: description.trim() || null,
          status,
          time_target: timeTarget,
          cadence,
          owner_email: ownerEmail.trim() || null,
          next_review_agenda: nextReviewAgenda.trim() || null,
        },
      });
      toast({ title: "Objectif mis à jour" });
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    }
  };

  if (!objective) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" style={{ color: objective.color }} />
              <span className="truncate">{objective.title}</span>
            </div>
            <Button size="sm" onClick={handleSave} disabled={updateObjective.isPending}>
              {updateObjective.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          </SheetTitle>
        </SheetHeader>

        {/* Progress Summary */}
        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-sm text-muted-foreground">Progression globale</span>
              <div className="text-2xl font-bold">{objective.progress_percentage}%</div>
            </div>
            <Badge
              variant="outline"
              className="text-lg px-3 py-1"
              style={{
                borderColor: getConfidenceColor(objective.confidence_level),
                color: getConfidenceColor(objective.confidence_level),
              }}
            >
              Confiance: {objective.confidence_level}%
            </Badge>
          </div>
          <Progress
            value={objective.progress_percentage}
            className="h-3"
            style={
              {
                "--progress-color": getProgressColor(objective.progress_percentage),
              } as React.CSSProperties
            }
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="key-results" className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Résultats</span>
            </TabsTrigger>
            <TabsTrigger value="check-in" className="flex items-center gap-1">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Suivi</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Équipe</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
          </TabsList>

          {/* Key Results Tab */}
          <TabsContent value="key-results" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Résultats Clés ({keyResults?.length || 0})</h3>
              <Button
                size="sm"
                onClick={() => {
                  setEditingKR(null);
                  setShowKRDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            </div>

            {loadingKRs ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : keyResults && keyResults.length > 0 ? (
              <div className="space-y-3">
                {keyResults.map((kr) => (
                  <KeyResultCard
                    key={kr.id}
                    keyResult={kr}
                    objectiveId={objective.id}
                    onEdit={() => {
                      setEditingKR(kr);
                      setShowKRDialog(true);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Aucun résultat clé</p>
                <p className="text-sm">Ajoutez des résultats clés mesurables</p>
              </div>
            )}

            {/* Key Result Dialog */}
            <KeyResultDialog
              open={showKRDialog}
              onOpenChange={setShowKRDialog}
              objectiveId={objective.id}
              editingKR={editingKR}
            />
          </TabsContent>

          {/* Check-in Tab */}
          <TabsContent value="check-in" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Suivi de l'OKR</h3>
                {objective.next_review_date && (
                  <p className="text-sm text-muted-foreground">
                    Prochain suivi: {format(new Date(objective.next_review_date), "d MMMM yyyy", { locale: fr })}
                  </p>
                )}
              </div>
              <Button size="sm" onClick={() => setShowCheckInDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Nouveau suivi
              </Button>
            </div>

            {/* Agenda */}
            <div className="p-4 border rounded-lg">
              <Label className="text-sm font-medium">Ordre du jour du prochain suivi</Label>
              <Textarea
                value={nextReviewAgenda}
                onChange={(e) => setNextReviewAgenda(e.target.value)}
                placeholder="Points à aborder lors du prochain suivi..."
                rows={3}
                className="mt-2"
              />
            </div>

            {/* Check-in History */}
            {checkIns && checkIns.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Historique des suivis</h4>
                {checkIns.map((checkIn) => (
                  <div key={checkIn.id} className="p-3 border rounded-lg text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">
                        {format(new Date(checkIn.check_in_date), "d MMMM yyyy", { locale: fr })}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {checkIn.previous_progress}% → {checkIn.new_progress}%
                        </Badge>
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: getConfidenceColor(checkIn.new_confidence || 50),
                            color: getConfidenceColor(checkIn.new_confidence || 50),
                          }}
                        >
                          Confiance: {checkIn.new_confidence}%
                        </Badge>
                      </div>
                    </div>
                    {checkIn.notes && (
                      <p className="text-muted-foreground">{checkIn.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Check-in Dialog */}
            <CheckInDialog
              open={showCheckInDialog}
              onOpenChange={setShowCheckInDialog}
              objective={objective}
            />
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Participants ({participants?.length || 0})</h3>
              <Button size="sm" onClick={() => setShowParticipantDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            </div>

            {/* Owner */}
            <div className="p-4 border rounded-lg">
              <Label>Responsable de l'OKR</Label>
              <Input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="email@example.com"
                className="mt-2"
              />
            </div>

            {/* Participants List */}
            {participants && participants.length > 0 && (
              <div className="space-y-2">
                {participants.map((p) => (
                  <ParticipantRow
                    key={p.id}
                    participant={p}
                    objectiveId={objective.id}
                  />
                ))}
              </div>
            )}

            {/* Participant Dialog */}
            <ParticipantDialog
              open={showParticipantDialog}
              onOpenChange={setShowParticipantDialog}
              objectiveId={objective.id}
            />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4 space-y-4">
            <div>
              <Label>Titre</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Statut</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as OKRStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(okrStatusConfig) as OKRStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: okrStatusConfig[s].color }}
                          />
                          {okrStatusConfig[s].label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Période cible</Label>
                <Select
                  value={timeTarget}
                  onValueChange={(v) => setTimeTarget(v as OKRTimeTarget)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(okrTimeTargetConfig) as OKRTimeTarget[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {okrTimeTargetConfig[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Cadence de suivi</Label>
              <Select value={cadence} onValueChange={(v) => setCadence(v as OKRCadence)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(okrCadenceConfig) as OKRCadence[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {okrCadenceConfig[c].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Un email de rappel sera envoyé 1 semaine avant chaque suivi
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

// Key Result Card
interface KeyResultCardProps {
  keyResult: OKRKeyResult;
  objectiveId: string;
  onEdit: () => void;
}

const KeyResultCard = ({ keyResult, objectiveId, onEdit }: KeyResultCardProps) => {
  const { toast } = useToast();
  const deleteKR = useDeleteOKRKeyResult();
  const { data: initiatives } = useOKRInitiatives(keyResult.id);
  const [showInitiatives, setShowInitiatives] = useState(false);
  const [showInitiativeDialog, setShowInitiativeDialog] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Supprimer ce résultat clé ?")) return;
    try {
      await deleteKR.mutateAsync({ id: keyResult.id, objectiveId });
      toast({ title: "Résultat clé supprimé" });
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-medium">{keyResult.title}</h4>
          {keyResult.target_value && (
            <p className="text-sm text-muted-foreground">
              {keyResult.current_value} / {keyResult.target_value} {keyResult.unit}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="flex-1">
          <Progress value={keyResult.progress_percentage} className="h-2" />
        </div>
        <span className="text-sm font-medium">{keyResult.progress_percentage}%</span>
        <Badge
          variant="outline"
          style={{
            borderColor: getConfidenceColor(keyResult.confidence_level),
            color: getConfidenceColor(keyResult.confidence_level),
          }}
        >
          {keyResult.confidence_level}%
        </Badge>
      </div>

      {/* Initiatives Section */}
      <div className="mt-3 pt-3 border-t">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowInitiatives(!showInitiatives)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <Zap className="h-4 w-4" />
            Initiatives ({initiatives?.length || 0})
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => setShowInitiativeDialog(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Ajouter
          </Button>
        </div>

        {showInitiatives && initiatives && initiatives.length > 0 && (
          <div className="mt-2 space-y-2">
            {initiatives.map((initiative) => (
              <InitiativeRow key={initiative.id} initiative={initiative} keyResultId={keyResult.id} />
            ))}
          </div>
        )}
      </div>

      {/* Initiative Dialog */}
      <InitiativeDialog
        open={showInitiativeDialog}
        onOpenChange={setShowInitiativeDialog}
        keyResultId={keyResult.id}
        onCreated={() => setShowInitiatives(true)}
      />
    </div>
  );
};

// Initiative Row
const InitiativeRow = ({ initiative, keyResultId }: { initiative: OKRInitiative; keyResultId: string }) => {
  const { toast } = useToast();
  const deleteInitiative = useDeleteOKRInitiative();
  const updateInitiative = useUpdateOKRInitiative();

  const handleDelete = async () => {
    try {
      await deleteInitiative.mutateAsync({ id: initiative.id, keyResultId });
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center gap-2 py-1 px-2 bg-muted/50 rounded text-sm">
      <Zap className="h-3 w-3 text-muted-foreground" />
      <span className="flex-1">{initiative.title}</span>
      {initiative.linked_mission && (
        <Badge variant="outline" className="text-xs">
          <Link className="h-3 w-3 mr-1" />
          Mission
        </Badge>
      )}
      {initiative.linked_training && (
        <Badge variant="outline" className="text-xs">
          <Link className="h-3 w-3 mr-1" />
          Formation
        </Badge>
      )}
      <Badge
        variant="outline"
        style={{
          borderColor: okrStatusConfig[initiative.status].color,
          color: okrStatusConfig[initiative.status].color,
        }}
      >
        {initiative.progress_percentage}%
      </Badge>
      <button onClick={handleDelete} className="text-red-500 hover:text-red-600">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};

// Key Result Dialog
interface KeyResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId: string;
  editingKR: OKRKeyResult | null;
}

const KeyResultDialog = ({ open, onOpenChange, objectiveId, editingKR }: KeyResultDialogProps) => {
  const { toast } = useToast();
  const createKR = useCreateOKRKeyResult();
  const updateKR = useUpdateOKRKeyResult();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [unit, setUnit] = useState("");
  const [progress, setProgress] = useState(0);
  const [confidence, setConfidence] = useState(50);

  useEffect(() => {
    if (editingKR) {
      setTitle(editingKR.title);
      setDescription(editingKR.description || "");
      setTargetValue(editingKR.target_value?.toString() || "");
      setCurrentValue(editingKR.current_value.toString());
      setUnit(editingKR.unit || "");
      setProgress(editingKR.progress_percentage);
      setConfidence(editingKR.confidence_level);
    } else {
      setTitle("");
      setDescription("");
      setTargetValue("");
      setCurrentValue("0");
      setUnit("");
      setProgress(0);
      setConfidence(50);
    }
  }, [editingKR, open]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Erreur", description: "Le titre est requis", variant: "destructive" });
      return;
    }

    try {
      if (editingKR) {
        await updateKR.mutateAsync({
          id: editingKR.id,
          objectiveId,
          updates: {
            title: title.trim(),
            description: description.trim() || null,
            target_value: targetValue ? parseFloat(targetValue) : null,
            current_value: parseFloat(currentValue) || 0,
            unit: unit.trim() || null,
            progress_percentage: progress,
            confidence_level: confidence,
          },
        });
        toast({ title: "Résultat clé mis à jour" });
      } else {
        await createKR.mutateAsync({
          objective_id: objectiveId,
          title: title.trim(),
          description: description.trim() || undefined,
          target_value: targetValue ? parseFloat(targetValue) : undefined,
          unit: unit.trim() || undefined,
        });
        toast({ title: "Résultat clé créé" });
      }
      onOpenChange(false);
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingKR ? "Modifier le résultat clé" : "Nouveau résultat clé"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Titre *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Atteindre 100 nouveaux clients"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Valeur cible</Label>
              <Input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="100"
              />
            </div>
            <div>
              <Label>Valeur actuelle</Label>
              <Input
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Unité</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="clients, €, %"
              />
            </div>
          </div>
          {editingKR && (
            <>
              <div>
                <Label>Progression: {progress}%</Label>
                <Slider
                  value={[progress]}
                  onValueChange={(v) => setProgress(v[0])}
                  max={100}
                  step={5}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Confiance: {confidence}%</Label>
                <Slider
                  value={[confidence]}
                  onValueChange={(v) => setConfidence(v[0])}
                  max={100}
                  step={5}
                  className="mt-2"
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={createKR.isPending || updateKR.isPending}>
            {(createKR.isPending || updateKR.isPending) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {editingKR ? "Mettre à jour" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Initiative Dialog
interface InitiativeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResultId: string;
  onCreated?: () => void;
}

const InitiativeDialog = ({ open, onOpenChange, keyResultId, onCreated }: InitiativeDialogProps) => {
  const { toast } = useToast();
  const createInitiative = useCreateOKRInitiative();
  const { data: missions } = useMissions();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkedMissionId, setLinkedMissionId] = useState("");

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Erreur", description: "Le titre est requis", variant: "destructive" });
      return;
    }

    try {
      await createInitiative.mutateAsync({
        key_result_id: keyResultId,
        title: title.trim(),
        description: description.trim() || undefined,
        linked_mission_id: linkedMissionId || undefined,
      });
      toast({ title: "Initiative créée" });
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setLinkedMissionId("");
      onCreated?.();
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle Initiative</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Titre *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Lancer campagne marketing"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label>Lier à une mission</Label>
            <Select value={linkedMissionId || "none"} onValueChange={(val) => setLinkedMissionId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une mission" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {missions?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={createInitiative.isPending}>
            {createInitiative.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Check-in Dialog
interface CheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objective: OKRObjective;
}

const CheckInDialog = ({ open, onOpenChange, objective }: CheckInDialogProps) => {
  const { toast } = useToast();
  const createCheckIn = useCreateOKRCheckIn();

  const [progress, setProgress] = useState(objective.progress_percentage);
  const [confidence, setConfidence] = useState(objective.confidence_level);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setProgress(objective.progress_percentage);
    setConfidence(objective.confidence_level);
    setNotes("");
  }, [objective, open]);

  const handleSubmit = async () => {
    try {
      await createCheckIn.mutateAsync({
        objective_id: objective.id,
        new_progress: progress,
        new_confidence: confidence,
        notes: notes.trim() || undefined,
      });
      toast({ title: "Suivi enregistré" });
      onOpenChange(false);
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau suivi</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Progression: {progress}%</Label>
            <Slider
              value={[progress]}
              onValueChange={(v) => setProgress(v[0])}
              max={100}
              step={5}
              className="mt-2"
            />
          </div>
          <div>
            <Label>Niveau de confiance: {confidence}%</Label>
            <Slider
              value={[confidence]}
              onValueChange={(v) => setConfidence(v[0])}
              max={100}
              step={5}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Quelle est votre confiance dans l'atteinte de cet objectif ?
            </p>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Commentaires, obstacles rencontrés, prochaines étapes..."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={createCheckIn.isPending}>
            {createCheckIn.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Participant Row
const ParticipantRow = ({ participant, objectiveId }: { participant: { id: string; name: string | null; email: string; role: string }; objectiveId: string }) => {
  const { toast } = useToast();
  const removeParticipant = useRemoveOKRParticipant();

  const handleRemove = async () => {
    try {
      await removeParticipant.mutateAsync({ id: participant.id, objectiveId });
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div>
        <div className="font-medium">{participant.name || participant.email}</div>
        {participant.name && (
          <div className="text-sm text-muted-foreground">{participant.email}</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{participant.role}</Badge>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={handleRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// Participant Dialog
interface ParticipantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId: string;
}

const ParticipantDialog = ({ open, onOpenChange, objectiveId }: ParticipantDialogProps) => {
  const { toast } = useToast();
  const addParticipant = useAddOKRParticipant();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("contributor");

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast({ title: "Erreur", description: "L'email est requis", variant: "destructive" });
      return;
    }

    try {
      await addParticipant.mutateAsync({
        objective_id: objectiveId,
        email: email.trim(),
        name: name.trim() || undefined,
        role,
      });
      toast({ title: "Participant ajouté" });
      onOpenChange(false);
      setEmail("");
      setName("");
      setRole("contributor");
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un participant</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>
          <div>
            <Label>Nom</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prénom Nom"
            />
          </div>
          <div>
            <Label>Rôle</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Responsable</SelectItem>
                <SelectItem value="contributor">Contributeur</SelectItem>
                <SelectItem value="observer">Observateur</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={addParticipant.isPending}>
            {addParticipant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OKRDetailDrawer;
