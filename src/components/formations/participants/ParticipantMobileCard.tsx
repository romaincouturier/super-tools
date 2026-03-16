import { Badge } from "@/components/ui/badge";
import { getStatusConfig } from "./statusConfig";
import ParticipantActions from "./ParticipantActions";
import type { Participant, ParticipantActionsProps } from "./types";

interface ParticipantMobileCardProps extends Omit<ParticipantActionsProps, "participant" | "displayName"> {
  sortedParticipants: Participant[];
}

const ParticipantMobileCard = ({
  sortedParticipants,
  ...actionsProps
}: ParticipantMobileCardProps) => {
  return (
    <div className="space-y-3">
      {sortedParticipants.map((participant) => {
        const statusConfig = getStatusConfig(participant.needs_survey_status);
        const StatusIcon = statusConfig.icon;
        const displayName = participant.first_name || participant.last_name
          ? `${participant.first_name || ""} ${participant.last_name || ""}`.trim()
          : participant.email;

        return (
          <div key={participant.id} className="p-3 rounded-lg border bg-card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {participant.first_name || participant.last_name
                    ? `${participant.first_name || ""} ${participant.last_name || ""}`.trim()
                    : "\u2014"}
                </p>
                <p className="text-xs text-muted-foreground truncate">{participant.email}</p>
                {participant.company && (
                  <p className="text-xs text-muted-foreground">{participant.company}</p>
                )}
                {participant.formula && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5 w-fit">
                    {participant.formula}
                  </Badge>
                )}
              </div>
              <Badge
                variant={statusConfig.variant}
                className="gap-1 text-xs shrink-0"
              >
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </Badge>
            </div>
            {actionsProps.isInterEntreprise && participant.sold_price_ht != null && (
              <p className="text-xs text-muted-foreground">
                {participant.sold_price_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} \u20ac HT
                {participant.payment_mode === "invoice" && (
                  <span className="ml-1.5 text-amber-600">\u2022 \u00c0 facturer</span>
                )}
              </p>
            )}
            <ParticipantActions
              participant={participant}
              displayName={displayName}
              {...actionsProps}
            />
          </div>
        );
      })}
    </div>
  );
};

export default ParticipantMobileCard;
