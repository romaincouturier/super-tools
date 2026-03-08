import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, Calendar, Pencil } from "lucide-react";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import type { CardDetailState, CardDetailHandlers } from "./types";

interface Props {
  state: CardDetailState;
  handlers: CardDetailHandlers;
  updatePending: boolean;
}

const CardDetailSchedule = ({ state, handlers, updatePending }: Props) => {
  const {
    card, scheduledDate, setScheduledDate, scheduledText, setScheduledText,
    showSchedulePopover, setShowSchedulePopover,
  } = state;

  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  return (
    <>
      {/* Next scheduled action banner */}
      {card?.waiting_next_action_date && !showSchedulePopover && (
        <div className="mb-3 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-blue-700 min-w-0">
            <Calendar className="h-4 w-4 shrink-0" />
            <span className="truncate">
              <span className="font-medium">
                {format(new Date(card.waiting_next_action_date), "d MMM yyyy", { locale: fr })}
              </span>
              {card.waiting_next_action_text && (
                <span> — {card.waiting_next_action_text}</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-blue-700 hover:text-blue-900" onClick={() => setShowSchedulePopover(true)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-500 hover:text-blue-700" onClick={handlers.handleClearSchedule}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Schedule action popover */}
      {showSchedulePopover && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg space-y-3 border border-blue-200">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Programmer une action
            </h4>
            <Button variant="ghost" size="sm" onClick={() => setShowSchedulePopover(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {card?.waiting_next_action_date && (
            <div className="text-sm text-blue-700 flex items-center justify-between">
              <span>
                Action programmée le {format(new Date(card.waiting_next_action_date), "d MMMM yyyy", { locale: fr })}
                {card.waiting_next_action_text && ` : ${card.waiting_next_action_text}`}
              </span>
              <Button variant="ghost" size="sm" onClick={handlers.handleClearSchedule}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {/* Action presets */}
          <div>
            <Label className="text-xs mb-1.5 block">Action</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {["Relancer le client", "Envoyer un devis", "Retour après consultation", "Appeler", "RDV physique", "RDV visio"].map((action) => (
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
            onClick={() => { handlers.handleScheduleAction(); setShowSchedulePopover(false); }}
            disabled={!scheduledDate || !scheduledText.trim() || updatePending}
            className="w-full"
          >
            {updatePending ? (
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

export default CardDetailSchedule;
