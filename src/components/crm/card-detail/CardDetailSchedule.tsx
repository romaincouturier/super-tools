import NextActionScheduler from "@/components/shared/NextActionScheduler";
import type { CardDetailState, CardDetailHandlers } from "./types";

const CRM_ACTION_PRESETS = [
  "Relancer le client",
  "Envoyer un devis",
  "Retour après consultation",
  "Appeler",
  "RDV physique",
  "RDV visio",
];

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

  return (
    <NextActionScheduler
      currentAction={{
        date: card?.waiting_next_action_date ?? null,
        text: card?.waiting_next_action_text ?? null,
      }}
      scheduledDate={scheduledDate}
      setScheduledDate={setScheduledDate}
      scheduledText={scheduledText}
      setScheduledText={setScheduledText}
      showForm={showSchedulePopover}
      setShowForm={setShowSchedulePopover}
      onSchedule={handlers.handleScheduleAction}
      onClear={handlers.handleClearSchedule}
      saving={updatePending}
      actionPresets={CRM_ACTION_PRESETS}
    />
  );
};

export default CardDetailSchedule;
