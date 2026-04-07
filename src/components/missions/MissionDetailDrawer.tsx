import { useState, useEffect, useCallback, useMemo } from "react";
import DetailDrawer from "@/components/shared/DetailDrawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Loader2, X, Plus, Clock, FileText, Settings, ImageIcon, Share2, Check, Sparkles, MapPin, FolderOpen, Package, Calendar, ExternalLink, Briefcase, Bot, Mail } from "lucide-react";
import MissionEmailDrafts from "./MissionEmailDrafts";
import { useNavigate } from "react-router-dom";
import { Mission, MissionStatus, missionStatusConfig } from "@/types/missions";
import { useUpdateMission, useDeleteMission, useCreateMissionActivity } from "@/hooks/useMissions";
import { useToast } from "@/hooks/use-toast";
import MissionActivityTracker from "./MissionActivityTracker";
import MissionScheduledActions from "./MissionScheduledActions";
import MissionPages from "./MissionPages";
import EntityMediaManager from "@/components/media/EntityMediaManager";
import MissionContacts from "./MissionContacts";
import EmojiPickerButton from "@/components/ui/emoji-picker-button";
import { supabase } from "@/integrations/supabase/client";
import LogisticsBookingButtons from "@/components/shared/LogisticsBookingButtons";
import EntityDocumentsManager from "@/components/shared/EntityDocumentsManager";
import SendDeliverablesDialog from "./SendDeliverablesDialog";
import AssignedUserSelector from "@/components/formations/AssignedUserSelector";
import NextActionScheduler from "@/components/shared/NextActionScheduler";
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";
import { getGoogleMapsSearchUrl } from "@/lib/googleMaps";
import { startOfDay, isAfter } from "date-fns";
import { useQuery } from "@tanstack/react-query";

interface MissionDetailDrawerProps {
  mission: Mission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const colorOptions = [
  "#6b7280", // gray
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
];

const MissionDetailDrawer = ({
  mission,
  open,
  onOpenChange,
}: MissionDetailDrawerProps) => {
  const updateMission = useUpdateMission();
  const deleteMission = useDeleteMission();
  const createActivity = useCreateMissionActivity();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showDeliverables, setShowDeliverables] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);

  const handleShareLink = () => {
    if (!mission) return;
    const url = `${window.location.origin}/mission-info/${mission.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "Lien copié", description: "Le lien de la page résumé a été copié." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateMissionSummary = async () => {
    if (!mission) return;
    setAiSummaryLoading(true);
    setAiSummary(null);
    try {
      const response = await supabase.functions.invoke("generate-mission-summary", {
        body: { action: "summarize_mission", mission_id: mission.id },
      });

      if (response.error) throw new Error(response.error instanceof Error ? response.error.message : "Erreur inconnue");
      setAiSummary(response.data.result);
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Impossible de générer le résumé", variant: "destructive" });
    } finally {
      setAiSummaryLoading(false);
    }
  };

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [status, setStatus] = useState<MissionStatus>("not_started");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [totalDays, setTotalDays] = useState("");
  const [initialAmount, setInitialAmount] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [color, setColor] = useState("#6b7280");
  const [missionEmoji, setMissionEmoji] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [trainBooked, setTrainBooked] = useState(false);
  const [hotelBooked, setHotelBooked] = useState(false);
  const [activeTab, setActiveTab] = useState("pages");
  const [activityPageRequest, setActivityPageRequest] = useState<{ activityId: string; description: string } | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledText, setScheduledText] = useState("");
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  // Fetch linked CRM card (opportunity) for this mission
  const { data: linkedCard } = useQuery({
    queryKey: ["linked-crm-card", mission?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_cards")
        .select("id, title")
        .eq("linked_mission_id", mission!.id)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!mission?.id,
  });

  // Initialize form when a different mission is opened
  const missionId = mission?.id;
  useEffect(() => {
    if (mission) {
      setAiSummary(null);
      setTitle(mission.title);
      setDescription(mission.description || "");
      setClientName(mission.client_name || "");
      setStatus(mission.status);
      setStartDate(mission.start_date || "");
      setEndDate(mission.end_date || "");
      setDailyRate(mission.daily_rate?.toString() || "");
      setTotalDays(mission.total_days?.toString() || "");
      setInitialAmount(mission.initial_amount?.toString() || "");
      setTags(mission.tags || []);
      setColor(mission.color);
      setMissionEmoji(mission.emoji || null);
      setLocation(mission.location || "");
      setTrainBooked(mission.train_booked ?? false);
      setHotelBooked(mission.hotel_booked ?? false);
      setAssignedTo(mission.assigned_to || null);
      setScheduledDate(mission.waiting_next_action_date || "");
      setScheduledText(mission.waiting_next_action_text || "");
      setShowScheduleForm(false);
      resetTracking();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId]);

  // Build form values for auto-save (memoized to avoid JSON.stringify on every keystroke)
  const formValues = useMemo(() => ({
    title: title.trim(),
    description: description.trim() || null,
    client_name: clientName.trim() || null,
    status,
    start_date: startDate || null,
    end_date: endDate || null,
    daily_rate: dailyRate ? parseFloat(dailyRate) : null,
    total_days: totalDays ? parseInt(totalDays) : null,
    initial_amount: initialAmount ? parseFloat(initialAmount) : null,
    tags,
    color,
    emoji: missionEmoji,
    location: location.trim() || null,
    assigned_to: assignedTo,
    waiting_next_action_date: scheduledDate || null,
    waiting_next_action_text: scheduledText.trim() || null,
  }), [title, description, clientName, status, startDate, endDate, dailyRate, totalDays, initialAmount, tags, color, missionEmoji, location, assignedTo, scheduledDate, scheduledText]);

  const handleAutoSave = useCallback(async (values: Record<string, unknown>) => {
    if (!mission) return false;
    try {
      await updateMission.mutateAsync({ id: mission.id, updates: values });
      return true;
    } catch {
      return false;
    }
  }, [mission, updateMission]);

  const { resetTracking, flushAndGetPending } = useAutoSaveForm({
    open,
    formValues,
    onSave: handleAutoSave,
  });

  // Flush pending save when drawer closes
  useEffect(() => {
    if (!open) {
      const pending = flushAndGetPending();
      if (pending && mission) {
        updateMission.mutate({ id: mission.id, updates: pending });
      }
    }
  }, [open, flushAndGetPending, mission, updateMission]);

  const handleDelete = async () => {
    if (!mission) return;
    if (confirm("Supprimer cette mission ?")) {
      await deleteMission.mutateAsync(mission.id);
      onOpenChange(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Calculate total amount
  const calculatedTotal =
    dailyRate && totalDays
      ? (parseFloat(dailyRate) * parseInt(totalDays)).toLocaleString("fr-FR")
      : null;

  if (!mission) return null;

  const headerActions = (
    <>
      {updateMission.isPending && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={handleGenerateMissionSummary}
        disabled={aiSummaryLoading}
        title="Synthèse IA de la mission"
        className={aiSummary ? "border-purple-300 text-purple-700" : ""}
      >
        {aiSummaryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      </Button>
      <Button size="sm" variant="outline" onClick={() => setShowDeliverables(true)} title="Envoyer les livrables">
        <Package className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="outline" onClick={() => setActiveTab("settings")} title="Paramètres">
        <Settings className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="outline" onClick={handleShareLink} title="Copier le lien de partage">
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Share2 className="h-4 w-4" />}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => navigate(`/agent?q=${encodeURIComponent(`Analyse la mission "${mission.title}" : activité récente, heures consommées, état d'avancement et recommandations.`)}`)}
        title="Demander à l'agent"
      >
        <Bot className="h-4 w-4" />
      </Button>
    </>
  );

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mission.title}
      actions={headerActions}
      contentClassName="overflow-y-auto sm:max-w-5xl"
    >
        {/* Linked CRM opportunity */}
        {linkedCard && (
          <a
            href={`/crm/card/${linkedCard.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 hover:bg-blue-100 transition-colors w-fit"
          >
            <Briefcase className="h-4 w-4" />
            Opportunité : {linkedCard.title}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}

        {/* Schedule action button + Next Action Scheduler */}
        <div className="mt-3 flex items-start gap-2">
          {!showScheduleForm && (
            <Button size="sm" variant="outline" onClick={() => setShowScheduleForm(true)} title="Programmer une action">
              <Calendar className="h-4 w-4 mr-1.5" />
              Programmer une action
            </Button>
          )}
        </div>
        <div className="mt-2">
          <NextActionScheduler
            currentAction={{ date: null, text: null }}
            scheduledDate={scheduledDate}
            setScheduledDate={setScheduledDate}
            scheduledText={scheduledText}
            setScheduledText={setScheduledText}
            showForm={showScheduleForm}
            setShowForm={setShowScheduleForm}
            onSchedule={async () => {
              if (!scheduledDate || !scheduledText.trim() || !mission) return;
              const selectedDate = startOfDay(new Date(scheduledDate));
              const today = startOfDay(new Date());
              if (!isAfter(selectedDate, today)) return;
              try {
                await createActivity.mutateAsync({
                  mission_id: mission.id,
                  description: scheduledText.trim(),
                  activity_date: scheduledDate,
                  duration_type: "hours",
                  duration: 0,
                  billable_amount: null,
                  invoice_url: null,
                  invoice_number: null,
                  is_billed: false,
                  notes: null,
                  google_event_id: null,
                  google_event_link: null,
                });
              } catch {
                // Activity creation is best-effort
              }
              // Reset form for next action
              setScheduledDate("");
              setScheduledText("");
            }}
            onClear={() => {
              setScheduledDate("");
              setScheduledText("");
            }}
            saving={updateMission.isPending || createActivity.isPending}
            actionPresets={["Relancer le client", "Appeler", "Préparer les livrables", "RDV physique", "RDV visio", "Envoyer un document"]}
          />
        </div>

        {/* All scheduled actions list */}
        <MissionScheduledActions missionId={mission.id} />

        {/* AI Mission Summary Panel */}
        {aiSummary && (
          <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg text-sm relative">
            <button
              onClick={() => setAiSummary(null)}
              className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded hover:bg-purple-200 text-purple-500"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 text-purple-700 font-medium mb-2">
              <Sparkles className="h-4 w-4" />
              Synthèse IA de la mission
            </div>
            <div className="text-purple-900 whitespace-pre-wrap leading-relaxed pr-6">{aiSummary}</div>
          </div>
        )}

        {/* Logistics booking buttons — visible on all tabs */}
        {location && (
          <div className="mt-3 flex items-center gap-3">
            <a
              href={getGoogleMapsSearchUrl(location)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors underline-offset-2 hover:underline"
            >
              <MapPin className="h-3 w-3" />
              {location}
            </a>
            <LogisticsBookingButtons
              table="missions"
              entityId={mission.id}
              location={location}
              trainBooked={trainBooked}
              hotelBooked={hotelBooked}
              onUpdate={(field, value) => {
                if (field === "train_booked") setTrainBooked(value);
                if (field === "hotel_booked") setHotelBooked(value);
              }}
            />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pages" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Pages
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="gallery" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Galerie
            </TabsTrigger>
            <TabsTrigger value="activities" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Activités
            </TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Emails
            </TabsTrigger>
          </TabsList>

          {/* Activities Tab */}
          <TabsContent value="activities" className="mt-4">
            <MissionActivityTracker
              mission={mission}
              onCreatePageForActivity={(activityId, description) => {
                setActivityPageRequest({ activityId, description });
                setActiveTab("pages");
              }}
            />
          </TabsContent>

          {/* Pages Tab */}
          <TabsContent value="pages" className="mt-4">
            <MissionPages
              mission={mission}
              initialActivityPageRequest={activityPageRequest}
              onActivityPageCreated={() => setActivityPageRequest(null)}
            />
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-4">
            <EntityDocumentsManager
              entityType="mission"
              entityId={mission.id}
              variant="bare"
              title="Documents contractuels"
            />
          </TabsContent>

          {/* Gallery Tab */}
          <TabsContent value="gallery" className="mt-4">
            <EntityMediaManager
              sourceType="mission"
              sourceId={mission.id}
              sourceLabel={mission.title}
              variant="bare"
              enablePaste
            />
          </TabsContent>

          {/* Emails Tab */}
          <TabsContent value="emails" className="mt-4">
            <MissionEmailDrafts missionId={mission.id} />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4 space-y-4">
            {/* Status */}
            <div>
              <Label>Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as MissionStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(missionStatusConfig) as MissionStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: missionStatusConfig[s].color }}
                        />
                        {missionStatusConfig[s].label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div>
              <Label>Titre</Label>
              <div className="flex items-center gap-2">
                <EmojiPickerButton emoji={missionEmoji} onEmojiChange={setMissionEmoji} size="md" />
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1" />
              </div>
            </div>

            {/* Description */}
            <div>
              <Label>Description</Label>
              <VoiceTextarea
                value={description}
                onValueChange={setDescription}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Description de la mission..."
              />
            </div>

            {/* Client info */}
            <div>
              <Label>Entreprise</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nom de l'entreprise"
              />
            </div>

            {/* Location */}
            <div>
              <Label>Lieu</Label>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ville ou adresse (ex: Lyon, Paris...)"
                />
              </div>
            </div>

            {/* Assigned user */}
            <div>
              <Label>Assigné à</Label>
              <AssignedUserSelector value={assignedTo} onChange={setAssignedTo} />
            </div>

            {/* Multi-contact management */}
            <MissionContacts missionId={mission.id} />

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date de début</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Date de fin</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Financials */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <h4 className="font-medium text-sm">Facturation (HT)</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">TJM (€)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={dailyRate}
                    onChange={(e) => setDailyRate(e.target.value)}
                    placeholder="500"
                  />
                </div>
                <div>
                  <Label className="text-xs">Nombre de jours</Label>
                  <Input
                    type="number"
                    min="0"
                    value={totalDays}
                    onChange={(e) => setTotalDays(e.target.value)}
                    placeholder="10"
                  />
                </div>
                <div>
                  <Label className="text-xs">Budget initial (€)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={initialAmount}
                    onChange={(e) => setInitialAmount(e.target.value)}
                    placeholder="5000"
                  />
                </div>
              </div>
              {calculatedTotal && (
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">Total estimé: </span>
                  <span className="font-semibold text-primary">{calculatedTotal} €</span>
                </div>
              )}
            </div>

            {/* Color */}
            <div>
              <Label>Couleur</Label>
              <div className="flex gap-2 mt-2">
                {colorOptions.map((c) => (
                  <button
                    key={c}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      color === c ? "border-primary scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <Label>Tags</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs bg-muted rounded flex items-center gap-1"
                  >
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Ajouter un tag..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                />
                <Button variant="outline" size="sm" onClick={handleAddTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Delete */}
            <div className="pt-4 border-t">
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMission.isPending}
                className="w-full"
              >
                {deleteMission.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Supprimer cette mission
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <SendDeliverablesDialog
          missionId={mission.id}
          missionTitle={mission.title}
          open={showDeliverables}
          onOpenChange={setShowDeliverables}
        />
    </DetailDrawer>
  );
};

export default MissionDetailDrawer;
