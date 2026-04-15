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
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Plus, Target, TrendingUp, Users, ClipboardCheck, Settings } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  useUpdateOKRObjective,
  useOKRKeyResults,
  useOKRParticipants,
  useOKRCheckIns,
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
import { KeyResultCard, KeyResultDialog } from "./OKRKeyResultCard";
import { OKRCheckInDialog } from "./OKRCheckInDialog";
import { OKRParticipantRow, OKRParticipantDialog } from "./OKRParticipantSection";

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
      toastError(toast, error instanceof Error ? error : "Erreur inconnue");
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
              {updateObjective.isPending ? <Spinner /> : <Save className="h-4 w-4" />}
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
            style={{ "--progress-color": getProgressColor(objective.progress_percentage) } as React.CSSProperties}
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
              <Button size="sm" onClick={() => { setEditingKR(null); setShowKRDialog(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter
              </Button>
            </div>

            {loadingKRs ? (
              <div className="flex justify-center py-4"><Spinner size="md" /></div>
            ) : keyResults && keyResults.length > 0 ? (
              <div className="space-y-3">
                {keyResults.map((kr) => (
                  <KeyResultCard
                    key={kr.id}
                    keyResult={kr}
                    objectiveId={objective.id}
                    onEdit={() => { setEditingKR(kr); setShowKRDialog(true); }}
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

            <KeyResultDialog open={showKRDialog} onOpenChange={setShowKRDialog} objectiveId={objective.id} editingKR={editingKR} />
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
                <Plus className="h-4 w-4 mr-1" /> Nouveau suivi
              </Button>
            </div>

            <div className="p-4 border rounded-lg">
              <Label className="text-sm font-medium">Ordre du jour du prochain suivi</Label>
              <VoiceTextarea
                value={nextReviewAgenda}
                onValueChange={setNextReviewAgenda}
                onChange={(e) => setNextReviewAgenda(e.target.value)}
                placeholder="Points à aborder lors du prochain suivi..."
                rows={3}
                className="mt-2"
              />
            </div>

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
                        <Badge variant="outline">{checkIn.previous_progress}% → {checkIn.new_progress}%</Badge>
                        <Badge variant="outline" style={{ borderColor: getConfidenceColor(checkIn.new_confidence || 50), color: getConfidenceColor(checkIn.new_confidence || 50) }}>
                          Confiance: {checkIn.new_confidence}%
                        </Badge>
                      </div>
                    </div>
                    {checkIn.notes && <p className="text-muted-foreground">{checkIn.notes}</p>}
                  </div>
                ))}
              </div>
            )}

            <OKRCheckInDialog open={showCheckInDialog} onOpenChange={setShowCheckInDialog} objective={objective} />
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Participants ({participants?.length || 0})</h3>
              <Button size="sm" onClick={() => setShowParticipantDialog(true)}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter
              </Button>
            </div>

            <div className="p-4 border rounded-lg">
              <Label>Responsable de l'OKR</Label>
              <Input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="email@example.com" className="mt-2" />
            </div>

            {participants && participants.length > 0 && (
              <div className="space-y-2">
                {participants.map((p) => (
                  <OKRParticipantRow key={p.id} participant={p} objectiveId={objective.id} />
                ))}
              </div>
            )}

            <OKRParticipantDialog open={showParticipantDialog} onOpenChange={setShowParticipantDialog} objectiveId={objective.id} />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4 space-y-4">
            <div>
              <Label>Titre</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <VoiceTextarea value={description} onValueChange={setDescription} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Statut</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as OKRStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(okrStatusConfig) as OKRStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: okrStatusConfig[s].color }} />
                          {okrStatusConfig[s].label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Période cible</Label>
                <Select value={timeTarget} onValueChange={(v) => setTimeTarget(v as OKRTimeTarget)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(okrTimeTargetConfig) as OKRTimeTarget[]).map((t) => (
                      <SelectItem key={t} value={t}>{okrTimeTargetConfig[t].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Cadence de suivi</Label>
              <Select value={cadence} onValueChange={(v) => setCadence(v as OKRCadence)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(okrCadenceConfig) as OKRCadence[]).map((c) => (
                    <SelectItem key={c} value={c}>{okrCadenceConfig[c].label}</SelectItem>
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

export default OKRDetailDrawer;
