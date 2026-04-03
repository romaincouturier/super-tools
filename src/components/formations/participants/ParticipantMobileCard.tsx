import { Send, Clock, Linkedin } from "lucide-react";
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
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-muted-foreground truncate">{participant.email}</p>
                  {(participant.first_name || participant.last_name) && (
                    <a
                      href={`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(
                        [participant.first_name, participant.last_name, participant.company].filter(Boolean).join(" ")
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-[#0A66C2] transition-colors shrink-0"
                    >
                      <Linkedin className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {participant.company && (
                  <p className="text-xs text-muted-foreground">{participant.company}</p>
                )}
                {participant.formula && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5 w-fit">
                    {participant.formula}
                  </Badge>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {(() => {
                  const isConvoked = !["non_envoye", "manuel"].includes(participant.needs_survey_status);
                  return (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${isConvoked ? "text-primary" : "text-muted-foreground"}`}>
                      {isConvoked ? <Send className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {isConvoked ? "Convoqué" : "Non convoqué"}
                    </span>
                  );
                })()}
                <Badge
                  variant={statusConfig.variant}
                  className="gap-1 text-xs"
                >
                  <StatusIcon className="h-3 w-3" />
                  {statusConfig.label}
                </Badge>
              </div>
            </div>
            {actionsProps.isInterEntreprise && participant.sold_price_ht != null && (
              <p className="text-xs text-muted-foreground">
                {participant.sold_price_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT
                {participant.payment_mode === "invoice" && (
                  <span className="ml-1.5 text-amber-600">• À facturer</span>
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
