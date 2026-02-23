import {
  HelpCircle,
  Mail,
  MailCheck,
  Clock,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Loader2,
  Send,
  RefreshCw,
  Receipt,
  Scroll,
  Award,
  Download,
  Forward,
  UserCheck,
  RotateCw,
  FileSignature,
  BellRing,
  StickyNote,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ViewQuestionnaireDialog from "./ViewQuestionnaireDialog";
import ParticipantDocumentsDialog from "./ParticipantDocumentsDialog";
import EditParticipantDialog from "./EditParticipantDialog";
import type { Participant, ParticipantListProps } from "./ParticipantList.types";
import { useParticipantList } from "./useParticipantList";

const getStatusConfig = (status: string) => {
  switch (status) {
    case "non_envoye":
      return {
        label: "Non envoyé",
        icon: Mail,
        variant: "secondary" as const,
        tooltip: "Le questionnaire n'a pas encore été envoyé",
      };
    case "programme":
      return {
        label: "Recueil programmé",
        icon: Clock,
        variant: "outline" as const,
        tooltip:
          "Le mail d'accueil a été envoyé, l'envoi du questionnaire de recueil est programmé",
      };
    case "manuel":
      return {
        label: "Mode manuel",
        icon: AlertTriangle,
        variant: "secondary" as const,
        tooltip: "Formation trop proche, envoi manuel requis",
      };
    case "envoye":
      return {
        label: "Envoyé",
        icon: MailCheck,
        variant: "outline" as const,
        tooltip: "Le questionnaire a été envoyé, en attente de réponse",
      };
    case "accueil_envoye":
      return {
        label: "Accueil envoyé",
        icon: MailCheck,
        variant: "outline" as const,
        tooltip: "Le mail d'accueil a été envoyé (J-7)",
      };
    case "en_cours":
      return {
        label: "En cours",
        icon: Clock,
        variant: "default" as const,
        tooltip: "Le participant a commencé à remplir le questionnaire",
      };
    case "complete":
      return {
        label: "Complété",
        icon: CheckCircle,
        variant: "default" as const,
        tooltip: "Le questionnaire a été complété",
      };
    case "valide_formateur":
      return {
        label: "Validé",
        icon: CheckCircle,
        variant: "default" as const,
        tooltip: "Le formateur a validé les réponses",
      };
    case "expire":
      return {
        label: "Expiré",
        icon: AlertTriangle,
        variant: "destructive" as const,
        tooltip: "Le lien du questionnaire a expiré",
      };
    default:
      return {
        label: status,
        icon: HelpCircle,
        variant: "secondary" as const,
        tooltip: "Statut inconnu",
      };
  }
};

const ParticipantList = (props: ParticipantListProps) => {
  const {
    participants,
    trainingId,
    formatFormation,
    elearningDuration,
    trainingName,
    trainingStartDate,
    trainingEndDate,
    attendanceSheetsUrls,
    onParticipantUpdated,
  } = props;

  const isMobile = useIsMobile();
  const pl = useParticipantList(props);

  const SortIcon = ({ field }: { field: string }) => {
    if (pl.sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return pl.sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  if (participants.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg">Aucun participant inscrit</p>
        <p className="text-sm">Ajoutez des participants pour commencer</p>
      </div>
    );
  }

  const renderParticipantActions = (participant: Participant, displayName: string) => (
    <div className="flex items-center gap-1 flex-wrap">
      {pl.isInterEntreprise && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${participant.invoice_file_url ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
              onClick={() => pl.setDocumentsParticipant(participant)}
            >
              <Receipt className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {participant.invoice_file_url
                ? "Facture uploadée - Gérer les documents"
                : "Gérer la facture"}
            </p>
          </TooltipContent>
        </Tooltip>
      )}

      {pl.isIndividualConvention &&
        (() => {
          const hasConvention = !!participant.convention_file_url;
          const sigInfo = pl.conventionSignatures.get(participant.id);
          const isLoading =
            pl.generatingConventionId === participant.id ||
            pl.downloadingConventionId === participant.id;

          if (!hasConvention) {
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => pl.handleGenerateConvention(participant)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Scroll className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Générer la convention de formation</p>
                </TooltipContent>
              </Tooltip>
            );
          }

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Scroll className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => pl.handleDownloadConvention(participant)}>
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger la convention
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => pl.handleGenerateConvention(participant)}>
                  <RotateCw className="h-4 w-4 mr-2" />
                  Ré-générer la convention
                </DropdownMenuItem>
                {sigInfo && !participant.signed_convention_url && (
                  <DropdownMenuItem disabled className="text-xs opacity-70">
                    <FileSignature className="h-4 w-4 mr-2" />
                    {sigInfo.status === "signed"
                      ? `Signée le ${new Date(sigInfo.signed_at!).toLocaleDateString("fr-FR")}`
                      : sigInfo.status === "pending"
                        ? "En attente de signature"
                        : `Signature : ${sigInfo.status}`}
                  </DropdownMenuItem>
                )}
                {participant.signed_convention_url && (
                  <DropdownMenuItem disabled className="text-xs opacity-70">
                    <FileSignature className="h-4 w-4 mr-2" />
                    Convention signée (upload manuel)
                  </DropdownMenuItem>
                )}
                {pl.canSendConventionReminderFor(participant) && (
                  <DropdownMenuItem
                    onClick={() => pl.handleSendConventionReminder(participant)}
                    disabled={pl.conventionRemindingId === participant.id}
                  >
                    {pl.conventionRemindingId === participant.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <BellRing className="h-4 w-4 mr-2" />
                    )}
                    Relancer pour la convention
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })()}

      {(participant.needs_survey_status === "complete" ||
        participant.needs_survey_status === "valide_formateur") && (
        <ViewQuestionnaireDialog
          participantId={participant.id}
          participantName={displayName}
          trainingId={trainingId}
        />
      )}

      {pl.canSendSurveyFor(participant) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => pl.handleSendSurvey(participant)}
              disabled={pl.sendingId === participant.id}
            >
              {pl.sendingId === participant.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Envoyer le questionnaire</p>
          </TooltipContent>
        </Tooltip>
      )}

      {pl.canSendReminderFor(participant) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => pl.handleSendReminder(participant)}
              disabled={pl.remindingId === participant.id}
            >
              {pl.remindingId === participant.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Relancer pour recueillir le besoin</p>
          </TooltipContent>
        </Tooltip>
      )}

      {(() => {
        const cert = pl.certificatesByParticipant.get(participant.id);
        const hasCert = !!cert?.certificateUrl;
        const sponsorEmail = participant.sponsor_email;
        const sponsorName = [participant.sponsor_first_name, participant.sponsor_last_name]
          .filter(Boolean)
          .join(" ");

        if (!hasCert) {
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  disabled={pl.generatingCertId === participant.id}
                  onClick={() => pl.handleGenerateCertificate(participant)}
                >
                  {pl.generatingCertId === participant.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Award className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Générer et envoyer l'attestation</p>
              </TooltipContent>
            </Tooltip>
          );
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary"
                disabled={pl.sendingCertId === participant.id}
              >
                {pl.sendingCertId === participant.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Award className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open(cert!.certificateUrl!, "_blank")}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger l'attestation
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  pl.handleSendCertificate(
                    participant,
                    participant.email,
                    participant.first_name || "",
                  )
                }
              >
                <Forward className="h-4 w-4 mr-2" />
                Envoyer au participant
              </DropdownMenuItem>
              {sponsorEmail && (
                <DropdownMenuItem
                  onClick={() => pl.handleSendCertificate(participant, sponsorEmail, sponsorName)}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Envoyer au commanditaire
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })()}

      <EditParticipantDialog
        participant={participant}
        trainingId={trainingId}
        formatFormation={formatFormation}
        trainingElearningDuration={elearningDuration}
        onParticipantUpdated={onParticipantUpdated}
      />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            disabled={pl.deletingId === participant.id}
          >
            {pl.deletingId === participant.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce participant ?</AlertDialogTitle>
            <AlertDialogDescription>
              {displayName} sera définitivement retiré de cette formation. Ses réponses au
              questionnaire seront également supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pl.handleDelete(participant)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <>
      {isMobile ? (
        <div className="space-y-3">
          {pl.sortedParticipants.map((participant) => {
            const statusConfig = getStatusConfig(participant.needs_survey_status);
            const StatusIcon = statusConfig.icon;
            const displayName =
              participant.first_name || participant.last_name
                ? `${participant.first_name || ""} ${participant.last_name || ""}`.trim()
                : participant.email;

            return (
              <div key={participant.id} className="p-3 rounded-lg border bg-card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {participant.first_name || participant.last_name
                        ? `${participant.first_name || ""} ${participant.last_name || ""}`.trim()
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{participant.email}</p>
                    {participant.company && (
                      <p className="text-xs text-muted-foreground">{participant.company}</p>
                    )}
                  </div>
                  <Badge variant={statusConfig.variant} className="gap-1 text-xs shrink-0">
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                </div>
                {pl.isInterEntreprise && participant.sold_price_ht != null && (
                  <p className="text-xs text-muted-foreground">
                    {participant.sold_price_ht.toLocaleString("fr-FR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    € HT
                    {participant.payment_mode === "invoice" && (
                      <span className="ml-1.5 text-amber-600">• À facturer</span>
                    )}
                  </p>
                )}
                {renderParticipantActions(participant, displayName)}
              </div>
            );
          })}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  onClick={() => pl.toggleSort("last_name")}
                  className="flex items-center hover:text-foreground transition-colors"
                >
                  Nom <SortIcon field="last_name" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => pl.toggleSort("email")}
                  className="flex items-center hover:text-foreground transition-colors"
                >
                  Email <SortIcon field="email" />
                </button>
              </TableHead>
              <TableHead>Société</TableHead>
              {pl.isInterEntreprise && <TableHead>Commanditaire</TableHead>}
              {pl.isInterEntreprise && (
                <TableHead>
                  <button
                    onClick={() => pl.toggleSort("amount")}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    Montant HT <SortIcon field="amount" />
                  </button>
                </TableHead>
              )}
              <TableHead>Recueil des besoins</TableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pl.sortedParticipants.map((participant) => {
              const statusConfig = getStatusConfig(participant.needs_survey_status);
              const StatusIcon = statusConfig.icon;
              const displayName =
                participant.first_name || participant.last_name
                  ? `${participant.first_name || ""} ${participant.last_name || ""}`.trim()
                  : participant.email;
              const sponsorDisplayName =
                participant.sponsor_first_name || participant.sponsor_last_name
                  ? `${participant.sponsor_first_name || ""} ${participant.sponsor_last_name || ""}`.trim()
                  : null;

              return (
                <TableRow key={participant.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {participant.first_name || participant.last_name
                        ? `${participant.first_name || ""} ${participant.last_name || ""}`.trim()
                        : "—"}
                      {pl.isInterEntreprise && participant.payment_mode === "invoice" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-warning" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>À facturer après la formation</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {pl.isInterEntreprise && participant.notes && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs whitespace-pre-wrap">{participant.notes}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{participant.email}</TableCell>
                  <TableCell>{participant.company || "—"}</TableCell>
                  {pl.isInterEntreprise && (
                    <TableCell>
                      {sponsorDisplayName || participant.sponsor_email ? (
                        <div className="flex flex-col gap-0.5">
                          {sponsorDisplayName && (
                            <span className="text-sm">{sponsorDisplayName}</span>
                          )}
                          {participant.sponsor_email && (
                            <span className="text-xs text-muted-foreground">
                              {participant.sponsor_email}
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  )}
                  {pl.isInterEntreprise && (
                    <TableCell>
                      {participant.sold_price_ht != null
                        ? `${participant.sold_price_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                        : "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant={statusConfig.variant} className="cursor-help gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{statusConfig.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{renderParticipantActions(participant, displayName)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {pl.documentsParticipant && (
        <ParticipantDocumentsDialog
          open={!!pl.documentsParticipant}
          onOpenChange={(open) => !open && pl.setDocumentsParticipant(null)}
          participant={{
            id: pl.documentsParticipant.id,
            first_name: pl.documentsParticipant.first_name,
            last_name: pl.documentsParticipant.last_name,
            email: pl.documentsParticipant.email,
            company: pl.documentsParticipant.company,
            sponsor_first_name: pl.documentsParticipant.sponsor_first_name || null,
            sponsor_last_name: pl.documentsParticipant.sponsor_last_name || null,
            sponsor_email: pl.documentsParticipant.sponsor_email || null,
            invoice_file_url: pl.documentsParticipant.invoice_file_url || null,
          }}
          trainingId={trainingId}
          trainingName={trainingName}
          startDate={trainingStartDate}
          endDate={trainingEndDate}
          attendanceSheetsUrls={attendanceSheetsUrls}
          onUpdate={onParticipantUpdated}
        />
      )}
    </>
  );
};

export default ParticipantList;
