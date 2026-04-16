/**
 * Settings tab content for MissionDetailDrawer.
 * Receives form state and setters from the parent drawer — stateless by
 * itself so the drawer remains the single source of truth for auto-save.
 */
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
import { Trash2, MapPin } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { TagsInput } from "@/components/ui/tags-input";
import EmojiPickerButton from "@/components/ui/emoji-picker-button";
import AssignedUserSelector from "@/components/formations/AssignedUserSelector";
import MissionContacts from "./MissionContacts";
import { MissionStatus, missionStatusConfig } from "@/types/missions";

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

interface MissionSettingsTabProps {
  missionId: string;
  status: MissionStatus;
  setStatus: (v: MissionStatus) => void;
  title: string;
  setTitle: (v: string) => void;
  missionEmoji: string | null;
  setMissionEmoji: (v: string | null) => void;
  description: string;
  setDescription: (v: string) => void;
  clientName: string;
  setClientName: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  assignedTo: string | null;
  setAssignedTo: (v: string | null) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  dailyRate: string;
  setDailyRate: (v: string) => void;
  totalDays: string;
  setTotalDays: (v: string) => void;
  initialAmount: string;
  setInitialAmount: (v: string) => void;
  calculatedTotal: string | null;
  color: string;
  setColor: (v: string) => void;
  tags: string[];
  setTags: (tags: string[]) => void;
  onDelete: () => void;
  deletePending: boolean;
}

const MissionSettingsTab = ({
  missionId,
  status,
  setStatus,
  title,
  setTitle,
  missionEmoji,
  setMissionEmoji,
  description,
  setDescription,
  clientName,
  setClientName,
  location,
  setLocation,
  assignedTo,
  setAssignedTo,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  dailyRate,
  setDailyRate,
  totalDays,
  setTotalDays,
  initialAmount,
  setInitialAmount,
  calculatedTotal,
  color,
  setColor,
  tags,
  setTags,
  onDelete,
  deletePending,
}: MissionSettingsTabProps) => {
  return (
    <>
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
      <MissionContacts missionId={missionId} />

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
        <TagsInput value={tags} onChange={setTags} variant="pill" className="mt-2" />
      </div>

      {/* Delete */}
      <div className="pt-4 border-t">
        <Button
          variant="destructive"
          onClick={onDelete}
          disabled={deletePending}
          className="w-full"
        >
          {deletePending ? (
            <Spinner className="mr-2" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          Supprimer cette mission
        </Button>
      </div>
    </>
  );
};

export default MissionSettingsTab;
