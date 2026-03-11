/**
 * Shared "Next Action" scheduler component.
 * Used by both CRM cards and Missions to schedule future actions.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, Calendar, Pencil } from "lucide-react";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";

export interface NextActionData {
  date: string | null;
  text: string | null;
}

interface NextActionSchedulerProps {
  /** Current scheduled action */
  currentAction: NextActionData;
  /** Controlled state for form inputs */
  scheduledDate: string;
  setScheduledDate: (v: string) => void;
  scheduledText: string;
  setScheduledText: (v: string) => void;
  /** Whether the popover/form is open */
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  /** Save handler */
  onSchedule: () => void | Promise<void>;
  /** Clear handler */
  onClear: () => void | Promise<void>;
  /** Is saving in progress */
  saving?: boolean;
  /** Action presets (chips) */
  actionPresets?: string[];
}

const DEFAULT_ACTION_PRESETS = [
  "Relancer le client",
  "Envoyer un devis",
  "Appeler",
  "RDV physique",
  "RDV visio",
  "Préparer les livrables",
];

const NextActionScheduler = ({
  currentAction,
  scheduledDate,
  setScheduledDate,
  scheduledText,
  setScheduledText,
  showForm,
  setShowForm,
  onSchedule,
  onClear,
  saving = false,
  actionPresets = DEFAULT_ACTION_PRESETS,
}: NextActionSchedulerProps) => {
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  // Use local state when it differs from server (optimistic display)
  const displayDate = scheduledDate || currentAction.date;
  const displayText = scheduledText || currentAction.text;

  return (
    <>
      {/* Banner showing current scheduled action */}
      {displayDate && !showForm && (
        <div className="mb-3 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-blue-700 min-w-0">
            <Calendar className="h-4 w-4 shrink-0" />
            <span className="truncate">
              <span className="font-medium">
                {format(new Date(displayDate), "d MMM yyyy", { locale: fr })}
              </span>
              {displayText && (
                <span> — {displayText}</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-blue-700 hover:text-blue-900" onClick={() => setShowForm(true)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-500 hover:text-blue-700" onClick={() => onClear()}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Schedule form */}
      {showForm && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg space-y-3 border border-blue-200">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Programmer une action
            </h4>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {currentAction.date && currentAction.date !== scheduledDate && (
            <div className="text-sm text-blue-700 flex items-center justify-between">
              <span>
                Action actuelle : {format(new Date(currentAction.date), "d MMMM yyyy", { locale: fr })}
                {currentAction.text && ` — ${currentAction.text}`}
              </span>
              <Button variant="ghost" size="sm" onClick={() => onClear()}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {/* Action presets */}
          <div>
            <Label className="text-xs mb-1.5 block">Action</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {actionPresets.map((action) => (
                <Button
                  key={action}
                  type="button"
                  variant={scheduledText === action ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setScheduledText(action)}
                >
                  {action}
                </Button>
              ))}
            </div>
            <Input
              value={scheduledText}
              onChange={(e) => setScheduledText(e.target.value)}
              placeholder="Action personnalisée..."
              className="h-8"
            />
          </div>
          {/* Date presets */}
          <div>
            <Label className="text-xs mb-1.5 block">Quand</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {[
                { label: "Demain", businessDays: 1 },
                { label: "Après-demain", businessDays: 2 },
                { label: "J+3", businessDays: 3 },
                { label: "J+5", businessDays: 5 },
                { label: "J+10", businessDays: 10 },
              ].map(({ label, businessDays }) => {
                let d = new Date();
                let remaining = businessDays;
                while (remaining > 0) {
                  d = addDays(d, 1);
                  if (d.getDay() !== 0 && d.getDay() !== 6) remaining--;
                }
                const targetDate = format(d, "yyyy-MM-dd");
                return (
                  <Button
                    key={label}
                    type="button"
                    variant={scheduledDate === targetDate ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setScheduledDate(targetDate)}
                  >
                    {label}
                  </Button>
                );
              })}
              <Input
                type="date"
                min={tomorrow}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="h-7 w-36 text-xs"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={async () => { try { await onSchedule(); } finally { setShowForm(false); } }}
            disabled={!scheduledDate || !scheduledText.trim() || saving}
            className="w-full"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4 mr-2" />
            )}
            Programmer
          </Button>
        </div>
      )}
    </>
  );
};

export default NextActionScheduler;
