import { useState, useEffect } from "react";
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
import { Save, Trash2, Loader2, X, Plus, Clock, FileText, Settings, ImageIcon, Share2, Copy, Check } from "lucide-react";
import { Mission, MissionStatus, missionStatusConfig } from "@/types/missions";
import { useUpdateMission, useDeleteMission } from "@/hooks/useMissions";
import { useToast } from "@/hooks/use-toast";
import MissionActivityTracker from "./MissionActivityTracker";
import MissionPages from "./MissionPages";
import MissionGallery from "./MissionGallery";
import EmojiPickerButton from "@/components/ui/emoji-picker-button";

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

  const handleShareLink = () => {
    if (!mission) return;
    const url = `${window.location.origin}/mission-info/${mission.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "Lien copié", description: "Le lien de la page résumé a été copié." });
    setTimeout(() => setCopied(false), 2000);
  };

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [billingContactName, setBillingContactName] = useState("");
  const [billingContactEmail, setBillingContactEmail] = useState("");
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
  const [activeTab, setActiveTab] = useState("activities");

  // Initialize form when mission changes
  useEffect(() => {
    if (mission) {
      setTitle(mission.title);
      setDescription(mission.description || "");
      setClientName(mission.client_name || "");
      setClientContact(mission.client_contact || "");
      setClientFirstName(mission.client_first_name || "");
      setClientLastName(mission.client_last_name || "");
      setClientEmail(mission.client_email || "");
      setBillingContactName(mission.billing_contact_name || "");
      setBillingContactEmail(mission.billing_contact_email || "");
      setStatus(mission.status);
      setStartDate(mission.start_date || "");
      setEndDate(mission.end_date || "");
      setDailyRate(mission.daily_rate?.toString() || "");
      setTotalDays(mission.total_days?.toString() || "");
      setInitialAmount(mission.initial_amount?.toString() || "");
      setTags(mission.tags || []);
      setColor(mission.color);
      setMissionEmoji(mission.emoji || null);
    }
  }, [mission]);

  const handleSave = async () => {
    if (!mission) return;

    await updateMission.mutateAsync({
      id: mission.id,
      updates: {
        title: title.trim(),
        description: description.trim() || null,
        client_name: clientName.trim() || null,
        client_contact: clientContact.trim() || null,
        client_first_name: clientFirstName.trim() || null,
        client_last_name: clientLastName.trim() || null,
        client_email: clientEmail.trim() || null,
        billing_contact_name: billingContactName.trim() || null,
        billing_contact_email: billingContactEmail.trim() || null,
        status,
        start_date: startDate || null,
        end_date: endDate || null,
        daily_rate: dailyRate ? parseFloat(dailyRate) : null,
        total_days: totalDays ? parseInt(totalDays) : null,
        initial_amount: initialAmount ? parseFloat(initialAmount) : null,
        tags,
        color,
        emoji: missionEmoji,
      },
    });
  };

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
      <SheetContent className="overflow-y-auto w-full sm:max-w-5xl">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-2">
            <span className="truncate flex-1">{mission.title}</span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={handleShareLink} title="Copier le lien de partage">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Share2 className="h-4 w-4" />}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateMission.isPending}>
                {updateMission.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="activities" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Activités
            </TabsTrigger>
            <TabsTrigger value="pages" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Pages
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
            <MissionActivityTracker mission={mission} />
          </TabsContent>

          {/* Pages Tab */}
          <TabsContent value="pages" className="mt-4">
            <MissionPages mission={mission} />
          </TabsContent>

          {/* Gallery Tab */}
          <TabsContent value="gallery" className="mt-4">
            <MissionGallery mission={mission} />
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
                rows={4}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prénom du contact</Label>
                <Input
                  value={clientFirstName}
                  onChange={(e) => setClientFirstName(e.target.value)}
                  placeholder="Prénom"
                />
              </div>
              <div>
                <Label>Nom du contact</Label>
                <Input
                  value={clientLastName}
                  onChange={(e) => setClientLastName(e.target.value)}
                  placeholder="Nom"
                />
              </div>
            </div>
            <div>
              <Label>Email du contact</Label>
              <Input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="email@exemple.com"
              />
            </div>

            {/* Billing contact */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <h4 className="font-medium text-sm">Contact de facturation</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nom</Label>
                  <Input
                    value={billingContactName}
                    onChange={(e) => setBillingContactName(e.target.value)}
                    placeholder="Nom du contact facturation"
                  />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={billingContactEmail}
                    onChange={(e) => setBillingContactEmail(e.target.value)}
                    placeholder="facturation@exemple.com"
                  />
                </div>
              </div>
            </div>

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
              <h4 className="font-medium text-sm">Facturation</h4>
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
      </SheetContent>
    </Sheet>
  );
};

export default MissionDetailDrawer;
