import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Loader2, X, Plus, Clock, FileText, Settings, ImageIcon, Share2, Check, Sparkles, MapPin, FolderOpen, CheckCircle2, Package } from "lucide-react";
import { Mission, MissionStatus, missionStatusConfig } from "@/types/missions";
import { useUpdateMission, useDeleteMission } from "@/hooks/useMissions";
import { useToast } from "@/hooks/use-toast";
import MissionActivityTracker from "./MissionActivityTracker";
import MissionPages from "./MissionPages";
import EntityMediaManager from "@/components/media/EntityMediaManager";
import MissionContacts from "./MissionContacts";
import EmojiPickerButton from "@/components/ui/emoji-picker-button";
import { supabase } from "@/integrations/supabase/client";
import LogisticsBookingButtons from "@/components/shared/LogisticsBookingButtons";
import EntityDocumentsManager from "@/components/shared/EntityDocumentsManager";
import MissionActionsManager from "./MissionActionsManager";
import SendDeliverablesDialog from "./SendDeliverablesDialog";

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
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showDeliverables, setShowDeliverables] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const skipNextSaveRef = useRef(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = useRef<{ id: string; updates: Record<string, unknown> } | null>(null);

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

      if (response.error) throw new Error(response.error.message);
      setAiSummary(response.data.result);
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message || "Impossible de générer le résumé", variant: "destructive" });
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
  const [activeTab, setActiveTab] = useState("activities");
  const [activityPageRequest, setActivityPageRequest] = useState<{ activityId: string; description: string } | null>(null);

  // Initialize form when mission changes
  useEffect(() => {
    if (mission) {
      skipNextSaveRef.current = true;
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
    }
  }, [mission]);

  // Flush any pending save immediately
  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (pendingUpdatesRef.current) {
      updateMission.mutate(pendingUpdatesRef.current);
      pendingUpdatesRef.current = null;
    }
  }, [updateMission]);

  // Flush pending save when drawer closes
  useEffect(() => {
    if (!open) flushSave();
  }, [open, flushSave]);

  // Auto-save settings with debounce
  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (!mission) return;

    const payload = {
      id: mission.id,
      updates: {
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
      },
    };

    pendingUpdatesRef.current = payload;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateMission.mutate(payload);
      pendingUpdatesRef.current = null;
      saveTimeoutRef.current = null;
    }, 800);

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [title, description, clientName, status, startDate, endDate, dailyRate, totalDays, initialAmount, tags, color, missionEmoji, location]);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-5xl" hideCloseButton>
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-2">
            <span className="truncate flex-1">{mission.title}</span>
            <div className="flex items-center gap-1">
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
              <Button size="sm" variant="outline" onClick={handleShareLink} title="Copier le lien de partage">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Share2 className="h-4 w-4" />}
              </Button>
            </div>
          </SheetTitle>
        </SheetHeader>

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
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {location}
            </span>
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="activities" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Activités
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Actions
            </TabsTrigger>
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
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Paramètres
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

          {/* Actions Tab */}
          <TabsContent value="actions" className="mt-4">
            <MissionActionsManager missionId={mission.id} />
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
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
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
              <Textarea
                value={description}
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
      </SheetContent>
    </Sheet>
  );
};

export default MissionDetailDrawer;
