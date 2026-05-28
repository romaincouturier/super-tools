import { Mail, CheckCircle, StickyNote, ArrowUpDown, ArrowUp, ArrowDown, Linkedin } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ParticipantActions from "./ParticipantActions";
import type { Participant, ParticipantActionsProps, SortField, SortDirection } from "./types";

interface ParticipantTableProps extends Omit<ParticipantActionsProps, "participant" | "displayName"> {
  sortedParticipants: Participant[];
  hasCoachingParticipants: boolean;
  sortField: SortField | null;
  sortDirection: SortDirection;
  onToggleSort: (field: SortField) => void;
  onCopyEmail: (email: string) => void;
  onToggleCoachingSession: (participant: Participant) => void;
  onUncheckCoachingSession: (participant: Participant) => void;
}

const SortIcon = ({ field, sortField, sortDirection }: { field: string; sortField: SortField | null; sortDirection: SortDirection }) => {
  if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return sortDirection === "asc"
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
};

const ParticipantTable = ({
  sortedParticipants,
  hasCoachingParticipants,
  sortField,
  sortDirection,
  onToggleSort,
  onCopyEmail,
  onToggleCoachingSession,
  onUncheckCoachingSession,
  ...actionsProps
}: ParticipantTableProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <button onClick={() => onToggleSort("last_name")} className="flex items-center hover:text-foreground transition-colors">
              Participant <SortIcon field="last_name" sortField={sortField} sortDirection={sortDirection} />
            </button>
          </TableHead>
          <TableHead>Entreprise</TableHead>
          {actionsProps.isInterEntreprise && (
            <TableHead>
              <button onClick={() => onToggleSort("amount")} className="flex items-center hover:text-foreground transition-colors">
                Montant HT <SortIcon field="amount" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
          )}
          {hasCoachingParticipants && <TableHead>Coaching</TableHead>}
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedParticipants.map((participant) => {
          const displayName = participant.first_name || participant.last_name
            ? `${participant.first_name || ""} ${participant.last_name || ""}`.trim()
            : participant.email;

          return (
            <TableRow key={participant.id} className={actionsProps.isInterEntreprise && participant.payment_mode === "invoice" && !participant.invoice_file_url ? "text-red-600" : ""}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {participant.first_name || participant.last_name
                          ? `${participant.last_name || ""} ${participant.first_name || ""}`.trim()
                          : participant.email}
                      </span>
                      {participant.formula && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {participant.formula}
                        </Badge>
                      )}
                      {participant.repositioned_to_training_id && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                              <ArrowRightLeft className="h-2.5 w-2.5" />
                              Repositionné
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Repositionné vers une autre session{participant.repositioned_at ? ` le ${new Date(participant.repositioned_at).toLocaleDateString("fr-FR")}` : ""}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {(() => {
                        const missingType = !participant.type_stagiaire_bpf;
                        const missingSource =
                          actionsProps.isInterEntreprise &&
                          !actionsProps.bpfTrainingHasSource &&
                          !participant.source_financement_bpf;
                        if (!missingType && !missingSource) return null;
                        const labelParts: string[] = [];
                        if (missingType) labelParts.push("type de stagiaire");
                        if (missingSource) labelParts.push("source de financement");
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-block w-2 h-2 rounded-full bg-destructive" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>BPF incomplet : {labelParts.join(" + ")}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}
                      {actionsProps.isInterEntreprise && participant.payment_mode === "invoice" && !participant.invoice_file_url && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-block w-2 h-2 rounded-full bg-warning" />
                          </TooltipTrigger>
                          <TooltipContent><p>À facturer</p></TooltipContent>
                        </Tooltip>
                      )}
                      {participant.notes && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <StickyNote className="h-3 w-3 text-muted-foreground shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent><p className="max-w-xs whitespace-pre-wrap">{participant.notes}</p></TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-primary shrink-0"
                        onClick={() => onCopyEmail(participant.email)}
                      >
                        <Mail className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Copier {participant.email}</p></TooltipContent>
                  </Tooltip>
                  {(participant.first_name || participant.last_name) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(
                            [participant.first_name, participant.last_name, participant.company].filter(Boolean).join(" ")
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-[#0A66C2] hover:bg-muted transition-colors shrink-0"
                        >
                          <Linkedin className="h-3 w-3" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent><p>Rechercher sur LinkedIn</p></TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {participant.company || "—"}
              </TableCell>
              {actionsProps.isInterEntreprise && (
                <TableCell className="tabular-nums">
                  {participant.sold_price_ht != null
                    ? `${participant.sold_price_ht.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`
                    : "—"}
                </TableCell>
              )}
              {hasCoachingParticipants && (
                <TableCell>
                  {(participant.coaching_sessions_total || 0) > 0 ? (
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: participant.coaching_sessions_total || 0 }).map((_, i) => {
                        const isCompleted = i < (participant.coaching_sessions_completed || 0);
                        return (
                          <Tooltip key={i}>
                            <TooltipTrigger asChild>
                              <button
                                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  isCompleted
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-muted-foreground/30 hover:border-primary"
                                }`}
                                onClick={() => {
                                  if (isCompleted && i === (participant.coaching_sessions_completed || 0) - 1) {
                                    onUncheckCoachingSession(participant);
                                  } else if (!isCompleted && i === (participant.coaching_sessions_completed || 0)) {
                                    onToggleCoachingSession(participant);
                                  }
                                }}
                              >
                                {isCompleted && <CheckCircle className="h-3 w-3" />}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Séance {i + 1}/{participant.coaching_sessions_total} {isCompleted ? "(réalisée)" : "(à programmer)"}</p>
                              {participant.coaching_deadline && (
                                <p className="text-xs">Validité : {new Date(participant.coaching_deadline).toLocaleDateString("fr-FR")}</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ) : null}
                </TableCell>
              )}
              <TableCell>
                <div className="flex justify-end">
                  <ParticipantActions
                    participant={participant}
                    displayName={displayName}
                    {...actionsProps}
                  />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default ParticipantTable;
