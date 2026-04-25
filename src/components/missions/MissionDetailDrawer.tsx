import { useState, useEffect, useCallback, useMemo } from "react";
import DetailDrawer from "@/components/shared/DetailDrawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { X, Clock, FileText, Settings, ImageIcon, Share2, Check, Sparkles, MapPin, FolderOpen, Package, Calendar, ExternalLink, Briefcase, Bot } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useNavigate } from "react-router-dom";
import { Mission, MissionStatus } from "@/types/missions";
import { useUpdateMission, useDeleteMission, useCreateMissionActivity, useCreateMissionPage } from "@/hooks/useMissions";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import MissionActivityTracker from "./MissionActivityTracker";
import MissionPages from "./MissionPages";
import MissionSettingsTab from "./MissionSettingsTab";
import EntityMediaManager from "@/components/media/EntityMediaManager";
import { supabase } from "@/integrations/supabase/client";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import LogisticsBookingButtons from "@/components/shared/LogisticsBookingButtons";
import { isRemoteLocation } from "@/lib/missionLocation";
import EntityDocumentsManager, { type EntityDocumentUpload } from "@/components/shared/EntityDocumentsManager";
import SendDeliverablesDialog from "./SendDeliverablesDialog";
import NextActionScheduler from "@/components/shared/NextActionScheduler";
import { useEntityAutoSave } from "@/hooks/useEntityAutoSave";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useConfirm } from "@/hooks/useConfirm";
import { useNextActionScheduling } from "@/hooks/useNextActionScheduling";
import { getGoogleMapsSearchUrl } from "@/lib/googleMaps";
import { todayAsISO } from "@/lib/dateFormatters";
import { useQuery } from "@tanstack/react-query";

interface MissionDetailDrawerProps {
  mission: Mission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
  const { copied, copy } = useCopyToClipboard();
  const { confirm, ConfirmDialog } = useConfirm();
  const [showDeliverables, setShowDeliverables] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const { loading: aiSummaryLoading, invoke: invokeMissionSummary } = useEdgeFunction<string>(
    "generate-mission-summary",
    { errorMessage: "Impossible de générer le résumé" },
  );

  const createMissionPage = useCreateMissionPage();
  const { invoke: invokeTranscribe } = useEdgeFunction<{ transcript?: string }>(
    "transcribe-audio-long",
    { silentOnError: true },
  );
  const { invoke: invokeGenerateTitle } = useEdgeFunction<string>(
    "ai-content-assist",
    { silentOnError: true },
  );

  /**
   * Audio document → automatic transcription → new mission page.
   * Fired (fire-and-forget) by EntityDocumentsManager after each successful upload.
   * Each audio produces one page, with an AI-suggested title and the transcript
   * as the page body. Non-audio files are ignored.
   */
  const handleDocumentUploaded = useCallback(async (uploaded: EntityDocumentUpload) => {
    if (!mission || uploaded.file_type !== "audio") return;
    sonnerToast.info(`Transcription de ${uploaded.file_name}…`, { duration: 4000 });
    try {
      const transcribeResult = await invokeTranscribe({ audio_url: uploaded.file_url });
      const transcript = transcribeResult?.transcript;
      if (!transcript || transcript === "[inaudible]") {
        sonnerToast.error(`Transcription impossible pour ${uploaded.file_name}`);
        return;
      }
      const titleResult = await invokeGenerateTitle({
        action: "generate_title",
        content: transcript.slice(0, 4000),
      });
      const cleanTitle = (titleResult || "")
        .trim()
        .replace(/^["'«»]|["'«»]$/g, "")
        .replace(/[.!?]+$/, "")
        .slice(0, 200);
      const fallbackTitle = uploaded.file_name.replace(/\.[^.]+$/, "");
      const finalTitle = cleanTitle || fallbackTitle;
      const htmlContent = transcript
        .split(/\n\n+/)
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");
      await createMissionPage.mutateAsync({
        mission_id: mission.id,
        title: finalTitle,
        content: htmlContent,
        icon: "🎙️",
      });
      sonnerToast.success(`Page créée : ${finalTitle}`);
    } catch (err) {
      console.error("[audio-to-page] failed:", err);
      sonnerToast.error(`Échec du traitement audio pour ${uploaded.file_name}`);
    }
  }, [mission, invokeTranscribe, invokeGenerateTitle, createMissionPage]);

  const handleShareLink = () => {
    if (!mission) return;
    const url = `${window.location.origin}/mission-info/${mission.id}`;
    copy(url, { description: "Le lien de la page résumé a été copié." });
  };

  const handleGenerateMissionSummary = async () => {
    if (!mission) return;
    setAiSummary(null);
    const result = await invokeMissionSummary({
      action: "summarize_mission",
      mission_id: mission.id,
    });
    if (result) setAiSummary(result);
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
  const [color, setColor] = useState("#6b7280");
  const [missionEmoji, setMissionEmoji] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [trainBooked, setTrainBooked] = useState(false);
  const [hotelBooked, setHotelBooked] = useState(false);
  const [activeTab, setActiveTab] = useState("pages");
  const [activityPageRequest, setActivityPageRequest] = useState<{ activityId: string; description: string } | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);

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
  }), [title, description, clientName, status, startDate, endDate, dailyRate, totalDays, initialAmount, tags, color, missionEmoji, location, assignedTo]);

  // Auto-save lifecycle: hydrate from mission on open, debounced save while
  // the drawer is open, flush on close.
  useEntityAutoSave({
    entity: mission,
    open,
    formValues,
    setFromEntity: (m) => {
      setAiSummary(null);
      setTitle(m.title);
      setDescription(m.description || "");
      setClientName(m.client_name || "");
      setStatus(m.status);
      setStartDate(m.start_date || "");
      setEndDate(m.end_date || "");
      setDailyRate(m.daily_rate?.toString() || "");
      setTotalDays(m.total_days?.toString() || "");
      setInitialAmount(m.initial_amount?.toString() || "");
      setTags(m.tags || []);
      setColor(m.color);
      setMissionEmoji(m.emoji || null);
      setLocation(m.location || "");
      setTrainBooked(m.train_booked ?? false);
      setHotelBooked(m.hotel_booked ?? false);
      setAssignedTo(m.assigned_to || null);
    },
    onSave: async (id, values) => {
      await updateMission.mutateAsync({ id, updates: values });
    },
  });

  // Scheduling (shared with CRM via NextActionScheduler)
  const {
    scheduledDate, setScheduledDate,
    scheduledText, setScheduledText,
    showForm: showScheduleForm, setShowForm: setShowScheduleForm,
    handleSchedule, handleClear: handleClearSchedule, handleMarkDone,
  } = useNextActionScheduling({
    entityKey: mission?.id,
    currentDate: mission?.waiting_next_action_date ?? null,
    currentText: mission?.waiting_next_action_text ?? null,
    save: async ({ date, text }) => {
      if (!mission) return;
      await updateMission.mutateAsync({
        id: mission.id,
        updates: { waiting_next_action_date: date, waiting_next_action_text: text },
      });
    },
    clear: async () => {
      if (!mission) return;
      await updateMission.mutateAsync({
        id: mission.id,
        updates: { waiting_next_action_date: null, waiting_next_action_text: null },
      });
    },
    markDone: async (currentText) => {
      if (!mission) return;
      // Log the completed action into the activity feed
      await createActivity.mutateAsync({
        mission_id: mission.id,
        description: currentText,
        activity_date: todayAsISO(),
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
      // Then clear the scheduling fields (same semantics as CRM unschedule)
      await updateMission.mutateAsync({
        id: mission.id,
        updates: { waiting_next_action_date: null, waiting_next_action_text: null },
      });
    },
    markDoneSuccessToast: {
      title: "Action marquée comme faite",
      description: "Ajoutée aux activités de la mission.",
    },
  });

  const handleDelete = async () => {
    if (!mission) return;
    const ok = await confirm({
      title: "Supprimer cette mission ?",
      description: "Cette action est irréversible.",
      confirmText: "Supprimer",
    });
    if (ok) {
      await deleteMission.mutateAsync(mission.id);
      onOpenChange(false);
    }
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
        <Spinner className="text-muted-foreground" />
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={handleGenerateMissionSummary}
        disabled={aiSummaryLoading}
        title="Synthèse IA de la mission"
        className={aiSummary ? "border-purple-300 text-purple-700" : ""}
      >
        {aiSummaryLoading ? <Spinner /> : <Sparkles className="h-4 w-4" />}
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

        {/* Schedule action button + Next Action Scheduler (same UX as CRM) */}
        <div className="mt-3 flex items-start gap-2">
          {!showScheduleForm && !mission.waiting_next_action_date && (
            <Button size="sm" variant="outline" onClick={() => setShowScheduleForm(true)} title="Programmer une action">
              <Calendar className="h-4 w-4 mr-1.5" />
              Programmer une action
            </Button>
          )}
        </div>
        <div className="mt-2">
          <NextActionScheduler
            currentAction={{ date: mission.waiting_next_action_date, text: mission.waiting_next_action_text }}
            scheduledDate={scheduledDate}
            setScheduledDate={setScheduledDate}
            scheduledText={scheduledText}
            setScheduledText={setScheduledText}
            showForm={showScheduleForm}
            setShowForm={setShowScheduleForm}
            onSchedule={handleSchedule}
            onClear={handleClearSchedule}
            onMarkDone={handleMarkDone}
            saving={updateMission.isPending || createActivity.isPending}
            actionPresets={["Relancer le client", "Appeler", "Préparer les livrables", "RDV physique", "RDV visio", "Envoyer un document"]}
          />
        </div>

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

        {/* Logistics booking buttons — visible on all tabs.
            Skipped entirely when the location is remote (no train/hotel
            needed) and the Maps link is replaced by a small "Distanciel"
            badge instead of an external map URL. */}
        {location && (
          <div className="mt-3 flex items-center gap-3">
            {isRemoteLocation(location) ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Distanciel
              </span>
            ) : (
              <>
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
              </>
            )}
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
              onUploadComplete={handleDocumentUploaded}
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

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4 space-y-4">
            <MissionSettingsTab
              missionId={mission.id}
              status={status} setStatus={setStatus}
              title={title} setTitle={setTitle}
              missionEmoji={missionEmoji} setMissionEmoji={setMissionEmoji}
              description={description} setDescription={setDescription}
              clientName={clientName} setClientName={setClientName}
              location={location} setLocation={setLocation}
              assignedTo={assignedTo} setAssignedTo={setAssignedTo}
              startDate={startDate} setStartDate={setStartDate}
              endDate={endDate} setEndDate={setEndDate}
              dailyRate={dailyRate} setDailyRate={setDailyRate}
              totalDays={totalDays} setTotalDays={setTotalDays}
              initialAmount={initialAmount} setInitialAmount={setInitialAmount}
              calculatedTotal={calculatedTotal}
              color={color} setColor={setColor}
              tags={tags} setTags={setTags}
              onDelete={handleDelete} deletePending={deleteMission.isPending}
            />
          </TabsContent>
        </Tabs>

        <SendDeliverablesDialog
          missionId={mission.id}
          missionTitle={mission.title}
          open={showDeliverables}
          onOpenChange={setShowDeliverables}
        />
        <ConfirmDialog />
    </DetailDrawer>
  );
};

export default MissionDetailDrawer;
