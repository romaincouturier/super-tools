import { Calendar, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ScheduleActionPanelProps {
  scheduledDate: string;
  scheduledText: string;
  onDateChange: (date: string) => void;
  onTextChange: (text: string) => void;
  onSchedule: () => void;
  onClearSchedule: () => void;
  onClose: () => void;
  existingDate: string | null;
  existingText: string | null;
  isPending: boolean;
  minDate: string;
}

const ScheduleActionPanel = ({
  scheduledDate,
  scheduledText,
  onDateChange,
  onTextChange,
  onSchedule,
  onClearSchedule,
  onClose,
  existingDate,
  existingText,
  isPending,
  minDate,
}: ScheduleActionPanelProps) => {
  return (
    <div className="mb-4 p-4 bg-blue-50 rounded-lg space-y-3 border border-blue-200">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Programmer une action
        </h4>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {existingDate && (
        <div className="text-sm text-blue-700 flex items-center justify-between">
          <span>
            Action programmée le {format(new Date(existingDate), "d MMMM yyyy", { locale: fr })}
            {existingText && ` : ${existingText}`}
          </span>
          <Button variant="ghost" size="sm" onClick={onClearSchedule}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => onTextChange("Envoyer un devis")}>
          Envoyer un devis
        </Button>
        <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => onTextChange("Faire un retour après consultation interne")}>
          Retour après consultation
        </Button>
        <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => onTextChange("Relancer le client")}>
          Relancer le client
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Action</Label>
          <Input
            value={scheduledText}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Relancer le client"
          />
        </div>
        <div>
          <Label className="text-xs">Date (à partir de demain)</Label>
          <Input
            type="date"
            min={minDate}
            value={scheduledDate}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => { onSchedule(); onClose(); }}
        disabled={!scheduledDate || !scheduledText.trim() || isPending}
        className="w-full"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Calendar className="h-4 w-4 mr-2" />
        )}
        Programmer
      </Button>
    </div>
  );
};

export default ScheduleActionPanel;
