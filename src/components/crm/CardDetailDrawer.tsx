import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Save,
  Trash2,
  FileText,
  Loader2,
  Tag,
  Paperclip,
  MessageSquare,
  History,
  AlertTriangle,
  Maximize2,
  Minimize2,
  ImageIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { addDays, format, isAfter, startOfDay } from "date-fns";
import DOMPurify from "dompurify";
import confetti from "canvas-confetti";
import {
  CrmCard,
  CrmTag,
  CrmColumn,
  SalesStatus,
  AcquisitionSource,
  LossReason,
  BriefQuestion,
} from "@/types/crm";
import LossReasonDialog from "./LossReasonDialog";
import EntityMediaManager from "@/components/media/EntityMediaManager";
import { CreateTrainingDialog } from "./CreateTrainingDialog";
import {
  useCrmCardDetails,
  useUpdateCard,
  useDeleteCard,
  useAssignTag,
  useUnassignTag,
  useAddComment,
  useDeleteComment,
  useAddAttachment,
  useDeleteAttachment,
  useSendEmail,
} from "@/hooks/useCrmBoard";
import { useAuth } from "@/hooks/useAuth";

// Extracted sub-components
import CardToolbar from "./card-detail/CardToolbar";
import ScheduleActionPanel from "./card-detail/ScheduleActionPanel";
import CardDetailsTab from "./card-detail/CardDetailsTab";
import CardTagsTab from "./card-detail/CardTagsTab";
import CardCommentsTab from "./card-detail/CardCommentsTab";
import CardAttachmentsTab from "./card-detail/CardAttachmentsTab";
import CardActivityTab from "./card-detail/CardActivityTab";
import WinChoiceDialog from "./card-detail/WinChoiceDialog";

interface CardDetailDrawerProps {
  card: CrmCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allTags: CrmTag[];
  allColumns: CrmColumn[];
}

const CardDetailDrawer = ({
  card,
  open,
  onOpenChange,
  allTags,
  allColumns,
}: CardDetailDrawerProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: details, isLoading: detailsLoading } = useCrmCardDetails(card?.id || null);

  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();
  const assignTag = useAssignTag();
  const unassignTag = useUnassignTag();
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const addAttachment = useAddAttachment();
  const deleteAttachment = useDeleteAttachment();
  const sendEmail = useSendEmail();

  // Form state
  const [title, setTitle] = useState("");
  const [cardEmoji, setCardEmoji] = useState<string | null>(null);
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [salesStatus, setSalesStatus] = useState<SalesStatus>("OPEN");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [quoteUrl, setQuoteUrl] = useState("");
  const [columnId, setColumnId] = useState("");

  // Contact fields state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [serviceType, setServiceType] = useState<"formation" | "mission" | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [acquisitionSource, setAcquisitionSource] = useState<AcquisitionSource | null>(null);

  // Loss reason dialog state
  const [showLossReasonDialog, setShowLossReasonDialog] = useState(false);
  const [pendingLossStatus, setPendingLossStatus] = useState(false);

  // Scheduled action state
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledText, setScheduledText] = useState("");
  const [showSchedulePopover, setShowSchedulePopover] = useState(false);

  // Next action state
  const [nextActionText, setNextActionText] = useState("");
  const [nextActionDone, setNextActionDone] = useState(false);

  // Linked mission state
  const [linkedMissionId, setLinkedMissionId] = useState<string | null>(null);

  // Comment state
  const [newComment, setNewComment] = useState("");

  // Email state
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // UI state
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Win dialog state
  const [showCreateTrainingDialog, setShowCreateTrainingDialog] = useState(false);
  const [showWinChoiceDialog, setShowWinChoiceDialog] = useState(false);
  const [pendingTrainingParams, setPendingTrainingParams] = useState<URLSearchParams | null>(null);

  // Get tomorrow's date as minimum for scheduling
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  // Initialize form when card changes
  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setCardEmoji(card.emoji || null);
      setDescriptionHtml(card.description_html || "");
      setSalesStatus(card.sales_status);
      setEstimatedValue(String(card.estimated_value || 0));
      setQuoteUrl(card.quote_url || "");
      setColumnId(card.column_id);
      setScheduledDate(card.waiting_next_action_date || "");
      setScheduledText(card.waiting_next_action_text || "");
      setFirstName(card.first_name || "");
      setLastName(card.last_name || "");
      setCompany(card.company || "");
      setEmail(card.email || "");
      setPhone(card.phone || "");
      setLinkedinUrl(card.linkedin_url || "");
      setWebsiteUrl(card.website_url || "");
      setServiceType(card.service_type || null);
      setConfidenceScore(card.confidence_score ?? null);
      setAcquisitionSource(card.acquisition_source ?? null);
      setNextActionText(card.next_action_text || "");
      setNextActionDone(card.next_action_done || false);
      setLinkedMissionId(card.linked_mission_id || null);
    }
  }, [card]);

  // Helper to build training creation params from current card data
  const buildTrainingParams = (): URLSearchParams => {
    const params = new URLSearchParams();
    if (company) params.set("clientName", company);
    if (firstName) params.set("sponsorFirstName", firstName);
    if (lastName) params.set("sponsorLastName", lastName);
    if (email) params.set("sponsorEmail", email);
    if (phone) params.set("sponsorPhone", phone);
    if (title) params.set("trainingName", title.replace(/^\([^)]+\)\s*/, ""));
    if (card?.id) params.set("fromCrmCardId", card.id);
    if (estimatedValue && parseFloat(estimatedValue) > 0) {
      params.set("estimatedValue", estimatedValue);
    }
    return params;
  };

  // Celebration confetti animation for won deals
  const celebrateWin = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    const colors = ["#FFD700", "#FFA500", "#FF6347", "#32CD32", "#1E90FF", "#9370DB"];

    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };

    confetti({ particleCount: 100, spread: 70, origin: { x: 0.5, y: 0.5 }, colors });
    frame();
  };

  // Show win choice dialog
  const promptWinChoice = () => {
    const params = buildTrainingParams();
    setPendingTrainingParams(params);
    celebrateWin();
    setShowWinChoiceDialog(true);
  };

  const handleSave = async () => {
    if (!card || !user?.email) return;
    const statusChangedToWon = salesStatus === "WON" && card.sales_status !== "WON";

    await updateCard.mutateAsync({
      id: card.id,
      updates: {
        title: title.trim(),
        description_html: DOMPurify.sanitize(descriptionHtml),
        sales_status: salesStatus,
        estimated_value: Math.round((parseFloat(estimatedValue) || 0) * 100) / 100,
        quote_url: quoteUrl.trim() || null,
        column_id: columnId,
        waiting_next_action_date: scheduledDate || null,
        waiting_next_action_text: scheduledText.trim() || null,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        website_url: websiteUrl.trim() || null,
        service_type: serviceType,
        next_action_text: nextActionText.trim() || null,
        next_action_done: nextActionDone,
        linked_mission_id: linkedMissionId,
        emoji: cardEmoji,
        confidence_score: confidenceScore,
        acquisition_source: acquisitionSource,
      },
      actorEmail: user.email,
      oldCard: card,
    });

    if (statusChangedToWon) promptWinChoice();
  };

  const handleSalesStatusChange = async (newStatus: SalesStatus) => {
    if (!card || !user?.email) return;
    const previousStatus = salesStatus;
    if (newStatus === "LOST" && previousStatus !== "LOST") {
      setPendingLossStatus(true);
      setShowLossReasonDialog(true);
      return;
    }
    await applyStatusChange(newStatus, previousStatus);
  };

  const handleLossReasonConfirm = async (reason: LossReason, detail: string) => {
    setShowLossReasonDialog(false);
    setPendingLossStatus(false);
    if (!card || !user?.email) return;
    setSalesStatus("LOST");
    setScheduledDate("");
    setScheduledText("");
    await updateCard.mutateAsync({
      id: card.id,
      updates: {
        sales_status: "LOST",
        loss_reason: reason,
        loss_reason_detail: detail || null,
        lost_at: new Date().toISOString(),
        status_operational: "TODAY",
        waiting_next_action_date: null,
        waiting_next_action_text: null,
      },
      actorEmail: user.email,
      oldCard: card,
    });
  };

  const applyStatusChange = async (newStatus: SalesStatus, previousStatus: SalesStatus) => {
    if (!card || !user?.email) return;
    setSalesStatus(newStatus);

    const isFinalStatus = newStatus === "WON" || newStatus === "LOST";
    const updates: Record<string, unknown> = { sales_status: newStatus };

    if (isFinalStatus) {
      updates.status_operational = "TODAY";
      updates.waiting_next_action_date = null;
      updates.waiting_next_action_text = null;
      setScheduledDate("");
      setScheduledText("");
    }
    if (newStatus === "WON" && previousStatus !== "WON") updates.won_at = new Date().toISOString();
    if (newStatus === "LOST" && previousStatus !== "LOST") updates.lost_at = new Date().toISOString();
    if (newStatus === "OPEN") {
      updates.won_at = null;
      updates.lost_at = null;
      updates.loss_reason = null;
      updates.loss_reason_detail = null;
    }

    const statusChangedToWon = newStatus === "WON" && previousStatus !== "WON";
    await updateCard.mutateAsync({ id: card.id, updates, actorEmail: user.email, oldCard: card });
    if (statusChangedToWon) promptWinChoice();
  };

  const handleColumnChange = async (newColumnId: string, columnName: string) => {
    if (!card || !user?.email) return;
    setColumnId(newColumnId);

    const isWonColumn = columnName.toLowerCase().includes("gagné");
    const currentColumn = allColumns.find(col => col.id === card.column_id);
    const wasInWonColumn = currentColumn?.name.toLowerCase().includes("gagné") || false;
    const movingToWon = isWonColumn && !wasInWonColumn;
    const leavingWonColumn = wasInWonColumn && !isWonColumn;

    const updates: Record<string, unknown> = { column_id: newColumnId };
    if (isWonColumn) { updates.sales_status = "WON"; setSalesStatus("WON"); }
    else if (leavingWonColumn) { updates.sales_status = "OPEN"; setSalesStatus("OPEN"); }

    await updateCard.mutateAsync({ id: card.id, updates, actorEmail: user.email, oldCard: card });
    if (movingToWon) promptWinChoice();
  };

  const handleScheduleAction = async () => {
    if (!card || !user?.email || !scheduledDate || !scheduledText.trim()) return;
    const selectedDate = startOfDay(new Date(scheduledDate));
    const today = startOfDay(new Date());
    if (!isAfter(selectedDate, today)) {
      toast({ title: "Date invalide", description: "La date doit être dans le futur (pas aujourd'hui)", variant: "destructive" });
      return;
    }
    await updateCard.mutateAsync({
      id: card.id,
      updates: { waiting_next_action_date: scheduledDate, waiting_next_action_text: scheduledText.trim() },
      actorEmail: user.email,
      oldCard: card,
    });
    onOpenChange(false);
  };

  const handleClearSchedule = async () => {
    if (!card || !user?.email) return;
    await updateCard.mutateAsync({
      id: card.id,
      updates: { waiting_next_action_date: null, waiting_next_action_text: null },
      actorEmail: user.email,
      oldCard: card,
    });
    setScheduledDate("");
    setScheduledText("");
  };

  const handleDelete = async () => {
    if (!card) return;
    if (confirm("Supprimer cette opportunité ?")) {
      await deleteCard.mutateAsync(card.id);
      onOpenChange(false);
    }
  };

  const handleToggleTag = async (tagId: string) => {
    if (!card || !user?.email) return;
    const hasTag = card.tags?.some((t) => t.id === tagId);
    if (hasTag) await unassignTag.mutateAsync({ cardId: card.id, tagId, actorEmail: user.email });
    else await assignTag.mutateAsync({ cardId: card.id, tagId, actorEmail: user.email });
  };

  const handleAddComment = async () => {
    if (!card || !user?.email || !newComment.trim()) return;
    await addComment.mutateAsync({ cardId: card.id, content: newComment.trim(), authorEmail: user.email });
    setNewComment("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!card || !user?.email || !e.target.files?.[0]) return;
    await addAttachment.mutateAsync({ cardId: card.id, file: e.target.files[0], actorEmail: user.email });
    e.target.value = "";
  };

  const handleSendEmail = async () => {
    if (!card || !user?.email || !emailTo.trim() || !emailSubject.trim()) return;
    await sendEmail.mutateAsync({
      input: { card_id: card.id, recipient_email: emailTo.trim(), subject: emailSubject.trim(), body_html: DOMPurify.sanitize(emailBody) },
      senderEmail: user.email,
    });
    setEmailTo("");
    setEmailSubject("");
    setEmailBody("");
  };

  const handleSaveDescription = async (newDescription: string) => {
    if (!card || !user?.email) return;
    await updateCard.mutateAsync({
      id: card.id,
      updates: { description_html: DOMPurify.sanitize(newDescription) },
      actorEmail: user.email,
      oldCard: card,
    });
  };

  const handleConfirmCreateTraining = () => {
    if (pendingTrainingParams) {
      setShowCreateTrainingDialog(false);
      setShowWinChoiceDialog(false);
      onOpenChange(false);
      navigate(`/formations/new?${pendingTrainingParams.toString()}`);
      setPendingTrainingParams(null);
    }
  };

  const handleConfirmCreateMission = () => {
    setShowWinChoiceDialog(false);
    onOpenChange(false);
    const missionTitle = title.replace(/^\([^)]+\)\s*/, "");
    const params = new URLSearchParams();
    if (missionTitle) params.set("title", missionTitle);
    if (company) params.set("clientName", company);
    if (firstName || lastName) params.set("clientContact", [firstName, lastName].filter(Boolean).join(" "));
    if (estimatedValue && parseFloat(estimatedValue) > 0) params.set("totalAmount", estimatedValue);
    if (card?.id) params.set("fromCrmCardId", card.id);
    navigate(`/missions?${params.toString()}`);
  };

  const handleAttachToTraining = (trainingId: string) => {
    setShowWinChoiceDialog(false);
    onOpenChange(false);
    const params = new URLSearchParams();
    if (firstName) params.set("addParticipantFirstName", firstName);
    if (lastName) params.set("addParticipantLastName", lastName);
    if (email) params.set("addParticipantEmail", email);
    if (company) params.set("addParticipantCompany", company);
    if (estimatedValue && parseFloat(estimatedValue) > 0) params.set("addParticipantSoldPriceHt", estimatedValue);
    if (card?.id) params.set("fromCrmCardId", card.id);
    const qs = params.toString();
    navigate(`/formations/${trainingId}${qs ? `?${qs}` : ""}`);
  };

  if (!card) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          className={`flex flex-col overflow-hidden transition-all duration-300 ${
            isFullScreen ? "w-full sm:max-w-full" : "w-full sm:max-w-xl"
          }`}
        >
          <SheetHeader className="shrink-0 border-b pb-3">
            <SheetTitle className="flex items-center justify-between gap-2">
              <span className="truncate flex-1">{card.title}</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  title={isFullScreen ? "Réduire" : "Plein écran"}
                >
                  {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateCard.isPending}>
                  {updateCard.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </div>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <CardToolbar
              columnId={columnId}
              allColumns={allColumns}
              estimatedValue={estimatedValue}
              confidenceScore={confidenceScore}
              salesStatus={salesStatus}
              isPending={updateCard.isPending}
              onColumnChange={handleColumnChange}
              onSalesStatusChange={handleSalesStatusChange}
              onShowSchedule={() => setShowSchedulePopover(true)}
            />

            {showSchedulePopover && (
              <ScheduleActionPanel
                scheduledDate={scheduledDate}
                scheduledText={scheduledText}
                onDateChange={setScheduledDate}
                onTextChange={setScheduledText}
                onSchedule={handleScheduleAction}
                onClearSchedule={handleClearSchedule}
                onClose={() => setShowSchedulePopover(false)}
                existingDate={card.waiting_next_action_date}
                existingText={card.waiting_next_action_text}
                isPending={updateCard.isPending}
                minDate={tomorrow}
              />
            )}

            <Tabs defaultValue="details" className="mt-4">
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="details"><FileText className="h-4 w-4" /></TabsTrigger>
                <TabsTrigger value="tags"><Tag className="h-4 w-4" /></TabsTrigger>
                <TabsTrigger value="comments"><MessageSquare className="h-4 w-4" /></TabsTrigger>
                <TabsTrigger value="attachments"><Paperclip className="h-4 w-4" /></TabsTrigger>
                <TabsTrigger value="media"><ImageIcon className="h-4 w-4" /></TabsTrigger>
                <TabsTrigger value="activity"><History className="h-4 w-4" /></TabsTrigger>
              </TabsList>

              <TabsContent value="details">
                <CardDetailsTab
                  card={card}
                  firstName={firstName}
                  lastName={lastName}
                  company={company}
                  email={email}
                  phone={phone}
                  linkedinUrl={linkedinUrl}
                  websiteUrl={websiteUrl}
                  serviceType={serviceType}
                  acquisitionSource={acquisitionSource}
                  onFirstNameChange={setFirstName}
                  onLastNameChange={setLastName}
                  onCompanyChange={setCompany}
                  onEmailChange={setEmail}
                  onPhoneChange={setPhone}
                  onLinkedinUrlChange={setLinkedinUrl}
                  onWebsiteUrlChange={setWebsiteUrl}
                  onServiceTypeChange={setServiceType}
                  onAcquisitionSourceChange={setAcquisitionSource}
                  title={title}
                  cardEmoji={cardEmoji}
                  descriptionHtml={descriptionHtml}
                  onTitleChange={setTitle}
                  onCardEmojiChange={setCardEmoji}
                  onDescriptionChange={setDescriptionHtml}
                  onSaveDescription={handleSaveDescription}
                  nextActionText={nextActionText}
                  nextActionDone={nextActionDone}
                  onNextActionTextChange={setNextActionText}
                  onNextActionDoneChange={setNextActionDone}
                  linkedMissionId={linkedMissionId}
                  onLinkedMissionIdChange={setLinkedMissionId}
                  quoteUrl={quoteUrl}
                  onQuoteUrlChange={setQuoteUrl}
                  estimatedValue={estimatedValue}
                  onEstimatedValueChange={setEstimatedValue}
                  confidenceScore={confidenceScore}
                  onConfidenceScoreChange={setConfidenceScore}
                  emailTo={emailTo}
                  emailSubject={emailSubject}
                  emailBody={emailBody}
                  onEmailToChange={setEmailTo}
                  onEmailSubjectChange={setEmailSubject}
                  onEmailBodyChange={setEmailBody}
                  onSendEmail={handleSendEmail}
                  isSendingEmail={sendEmail.isPending}
                  onUpdateBriefQuestion={(updatedQuestions) => {
                    if (!user?.email) return;
                    updateCard.mutate({
                      id: card.id,
                      updates: { brief_questions: updatedQuestions },
                      actorEmail: user.email,
                      oldCard: card,
                    });
                  }}
                  comments={details?.comments || []}
                  userEmail={user?.email || ""}
                />
              </TabsContent>

              <TabsContent value="tags">
                <CardTagsTab
                  cardTags={card.tags || []}
                  allTags={allTags}
                  onToggleTag={handleToggleTag}
                />
              </TabsContent>

              <TabsContent value="comments">
                <CardCommentsTab
                  comments={details?.comments || []}
                  isLoading={detailsLoading}
                  newComment={newComment}
                  onNewCommentChange={setNewComment}
                  onAddComment={handleAddComment}
                  onDeleteComment={(id) => deleteComment.mutate(id)}
                  isAdding={addComment.isPending}
                />
              </TabsContent>

              <TabsContent value="attachments">
                <CardAttachmentsTab
                  attachments={details?.attachments || []}
                  isLoading={detailsLoading}
                  cardId={card.id}
                  userEmail={user?.email || ""}
                  onFileUpload={handleFileUpload}
                  onDeleteAttachment={(params) => deleteAttachment.mutate(params)}
                  isUploading={addAttachment.isPending}
                />
              </TabsContent>

              <TabsContent value="media" className="mt-4">
                <EntityMediaManager
                  sourceType="crm"
                  sourceId={card.id}
                  sourceLabel={card.title}
                  variant="bare"
                />
              </TabsContent>

              <TabsContent value="activity">
                <CardActivityTab
                  activity={details?.activity || []}
                  emails={details?.emails || []}
                  isLoading={detailsLoading}
                />
              </TabsContent>
            </Tabs>

            {/* Delete section */}
            <div className="mt-8 pt-4 border-t border-destructive/20">
              <div className="p-4 bg-destructive/5 rounded-lg space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Zone dangereuse
                </h4>
                <p className="text-sm text-muted-foreground">
                  La suppression d'une opportunité est irréversible. Toutes les données associées (commentaires, pièces jointes, historique) seront perdues.
                </p>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteCard.isPending}
                  className="w-full"
                >
                  {deleteCard.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Supprimer cette opportunité
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <LossReasonDialog
        open={showLossReasonDialog}
        onConfirm={handleLossReasonConfirm}
        onCancel={() => { setShowLossReasonDialog(false); setPendingLossStatus(false); }}
      />

      <CreateTrainingDialog
        open={showCreateTrainingDialog}
        onOpenChange={setShowCreateTrainingDialog}
        onConfirmCreate={handleConfirmCreateTraining}
        onConfirmAddParticipant={(trainingId) => {
          setShowCreateTrainingDialog(false);
          onOpenChange(false);
          navigate(`/formations/${trainingId}`);
        }}
        opportunityTitle={title}
        isFormation={serviceType === "formation" || !serviceType}
      />

      <WinChoiceDialog
        open={showWinChoiceDialog}
        onOpenChange={setShowWinChoiceDialog}
        title={title}
        onCreateTraining={() => {
          setShowWinChoiceDialog(false);
          setShowCreateTrainingDialog(true);
        }}
        onCreateMission={handleConfirmCreateMission}
        onAttachToTraining={handleAttachToTraining}
      />
    </>
  );
};

export default CardDetailDrawer;
