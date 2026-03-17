import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import DetailDrawer from "@/components/shared/DetailDrawer";
// supabase imported via hooks
import { crmAiAssist } from "@/services/crmAiAssist";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import DOMPurify from "dompurify";
import { isWonColumnName, isLostColumnName } from "@/lib/crmColumnStatus";
import EmojiPickerButton from "@/components/ui/emoji-picker-button";
import { celebrateWin } from "@/lib/celebrateWin";
import {
  CrmCard,
  CrmTag,
  CrmColumn,
  SalesStatus,
  AcquisitionSource,
  BriefQuestion,
  LossReason,
  EmailAttachment,
} from "@/types/crm";
import {
  useCrmCardDetails,
  useUpdateCard,
  useDeleteCard,
  useAssignTag,
  useUnassignTag,
  useAddComment,
  useAddAttachment,
  useSendEmail,
} from "@/hooks/useCrmBoard";
import { useAuth } from "@/hooks/useAuth";
import { useCrmEmailTemplates, useUpdateCrmTemplate } from "@/hooks/useCrmEmailTemplates";
import { useToast } from "@/hooks/use-toast";
import { isAfter, startOfDay } from "date-fns";
import { PricingLine } from "./MacroPricingDialog";

// Sub-components
import CardDetailToolbar from "./card-detail/CardDetailToolbar";
import CardDetailTagsBar from "./card-detail/CardDetailTagsBar";
import CardDetailSchedule from "./card-detail/CardDetailSchedule";
import CardDetailContact from "./card-detail/CardDetailContact";
import CardDetailQualification from "./card-detail/CardDetailQualification";
import CardDetailCommercial from "./card-detail/CardDetailCommercial";
import CardDetailCommunication from "./card-detail/CardDetailCommunication";
import CardDetailTabs from "./card-detail/CardDetailTabs";
import CardDetailDialogs from "./card-detail/CardDetailDialogs";
import type { CardDetailState, CardDetailHandlers } from "./card-detail/types";

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
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: details, isLoading: detailsLoading } = useCrmCardDetails(card?.id || null);

  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();
  const assignTag = useAssignTag();
  const unassignTag = useUnassignTag();
  const addComment = useAddComment();
  const addAttachment = useAddAttachment();
  const sendEmail = useSendEmail();
  const { data: crmEmailTemplates } = useCrmEmailTemplates();
  const updateTemplate = useUpdateCrmTemplate();

  // ═══ STATE ═══
  const [title, setTitle] = useState("");
  const [cardEmoji, setCardEmoji] = useState<string | null>(null);
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [salesStatus, setSalesStatus] = useState<SalesStatus>("OPEN");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [quoteUrl, setQuoteUrl] = useState("");
  const [columnId, setColumnId] = useState("");
  const [contactExpanded, setContactExpanded] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [serviceType, setServiceType] = useState<"formation" | "mission" | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [acquisitionSource, setAcquisitionSource] = useState<AcquisitionSource | null>(null);
  const [showLossReasonDialog, setShowLossReasonDialog] = useState(false);
  const [pendingLossStatus, setPendingLossStatus] = useState(false);
  const [pendingLossColumnId, setPendingLossColumnId] = useState<string | null>(null);
  const [nextActionSuggesting, setNextActionSuggesting] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledText, setScheduledText] = useState("");
  const [nextActionText, setNextActionText] = useState("");
  const [nextActionDone, setNextActionDone] = useState(false);
  const [nextActionType, setNextActionType] = useState<"email" | "phone" | "rdv_physique" | "rdv_visio" | "other">("other");
  const [localBriefQuestions, setLocalBriefQuestions] = useState<BriefQuestion[]>([]);
  const [briefExpanded, setBriefExpanded] = useState(true);
  const [linkedMissionId, setLinkedMissionId] = useState<string | null>(null);
  const [missionSearchQuery, setMissionSearchQuery] = useState("");
  const [showMissionSearch, setShowMissionSearch] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSubjectBeforeAi, setEmailSubjectBeforeAi] = useState<string | null>(null);
  const [emailBodyBeforeAi, setEmailBodyBeforeAi] = useState<string | null>(null);
  const [improvingSubject, setImprovingSubject] = useState(false);
  const [improvingBody, setImprovingBody] = useState(false);
  const [emailAttachments, setEmailAttachments] = useState<EmailAttachment[]>([]);
  const selectedTemplateRef = useRef<{ id: string; subject: string; html_content: string } | null>(null);
  const emailFileInputRef = useRef<HTMLInputElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [quoteGenerating, setQuoteGenerating] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [quoteDescription, setQuoteDescription] = useState<string | null>(null);
  const [descriptionSaving, setDescriptionSaving] = useState(false);
  const [descriptionSaved, setDescriptionSaved] = useState(false);
  const descriptionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fieldSaving, setFieldSaving] = useState(false);
  const [fieldSaved, setFieldSaved] = useState(false);
  const fieldTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [pricingLines, setPricingLines] = useState<PricingLine[]>([]);
  const [pricingTravelTotal, setPricingTravelTotal] = useState(0);
  const [showCreateTrainingDialog, setShowCreateTrainingDialog] = useState(false);
  const [showWinChoiceDialog, setShowWinChoiceDialog] = useState(false);
  const [pendingTrainingParams, setPendingTrainingParams] = useState<URLSearchParams | null>(null);
  const [showSchedulePopover, setShowSchedulePopover] = useState(false);

  // ═══ INIT ═══
  const prevCardIdRef = useRef<string | null>(null);
  const cardLoadedRef = useRef(false);
  const websiteLookedUpRef = useRef(false);
  const websiteLookupAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (card && card.id !== prevCardIdRef.current) {
      prevCardIdRef.current = card.id;
      websiteLookedUpRef.current = false;
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
      setAssignedTo(card.assigned_to || null);
      setConfidenceScore(card.confidence_score ?? 50);
      setAcquisitionSource(card.acquisition_source ?? null);
      setNextActionText(card.next_action_text || "");
      setNextActionDone(card.next_action_done || false);
      setNextActionType(card.next_action_type || "other");
      setLocalBriefQuestions(card.brief_questions || []);
      const hasDescription = !!(card.description_html && card.description_html.replace(/<[^>]*>/g, "").trim());
      setBriefExpanded(!hasDescription);
      setLinkedMissionId(card.linked_mission_id || null);
      setMissionSearchQuery("");
      setShowMissionSearch(false);
      setAiAnalysis(null);
      setQuoteDescription(null);
      setDescriptionSaved(false);
      setFieldSaved(false);
      setNextActionSuggesting(false);
      cardLoadedRef.current = false;
      setTimeout(() => { cardLoadedRef.current = true; }, 100);
    }
  }, [card]);

  useEffect(() => {
    if (!open) prevCardIdRef.current = null;
  }, [open]);

  // ═══ AUTO-SAVE ═══
  const parseValue = () => parseFloat(estimatedValue) || 0;

  const autoSaveField = useCallback((updates: Record<string, unknown>) => {
    if (!card || !user?.email) return;
    if (fieldTimeoutRef.current) clearTimeout(fieldTimeoutRef.current);
    fieldTimeoutRef.current = setTimeout(async () => {
      setFieldSaving(true);
      setFieldSaved(false);
      try {
        await updateCard.mutateAsync({ id: card.id, updates: updates as Record<string, unknown>, actorEmail: user.email!, oldCard: card });
        setFieldSaved(true);
        setTimeout(() => setFieldSaved(false), 2000);
      } catch (error) {
        console.error("Failed to auto-save field:", error);
      } finally {
        setFieldSaving(false);
      }
    }, 1000);
  }, [card, user?.email, updateCard]);

  useEffect(() => {
    if (!cardLoadedRef.current || !card) return;
    // Note: sales_status and column_id are NOT included here because they are
    // saved immediately by their dedicated handlers (handleSalesStatusChange,
    // handleColumnChange). Including them would cause duplicate mutations and
    // duplicate Slack notifications when an opportunity is won.
    autoSaveField({
      title: title.trim(), estimated_value: parseValue(),
      quote_url: quoteUrl.trim() || null,
      waiting_next_action_date: scheduledDate || null, waiting_next_action_text: scheduledText.trim() || null,
      first_name: firstName.trim() || null, last_name: lastName.trim() || null,
      company: company.trim() || null, email: email.trim() || null,
      phone: phone.trim() || null, linkedin_url: linkedinUrl.trim() || null,
      website_url: websiteUrl.trim() || null, service_type: serviceType,
      next_action_text: nextActionText.trim() || null, next_action_done: nextActionDone,
      next_action_type: nextActionType, linked_mission_id: linkedMissionId,
      emoji: cardEmoji, confidence_score: confidenceScore,
      acquisition_source: acquisitionSource, assigned_to: assignedTo,
    });
  }, [title, estimatedValue, quoteUrl, scheduledDate, scheduledText,
      firstName, lastName, company, email, phone, linkedinUrl, websiteUrl, serviceType,
      nextActionText, nextActionDone, nextActionType, linkedMissionId, cardEmoji, confidenceScore, acquisitionSource, assignedTo]);

  const saveDescription = useCallback(async (newDescription: string) => {
    if (!card || !user?.email) return;
    setDescriptionSaving(true);
    setDescriptionSaved(false);
    try {
      await updateCard.mutateAsync({ id: card.id, updates: { description_html: DOMPurify.sanitize(newDescription) }, actorEmail: user.email, oldCard: card });
      setDescriptionSaved(true);
      setTimeout(() => setDescriptionSaved(false), 2000);
    } catch (error) {
      console.error("Failed to auto-save description:", error);
    } finally {
      setDescriptionSaving(false);
    }
  }, [card, user?.email, updateCard]);

  const handleDescriptionChange = (value: string) => {
    setDescriptionHtml(value);
    if (descriptionTimeoutRef.current) clearTimeout(descriptionTimeoutRef.current);
    descriptionTimeoutRef.current = setTimeout(() => saveDescription(value), 1500);
  };

  useEffect(() => {
    return () => {
      if (descriptionTimeoutRef.current) clearTimeout(descriptionTimeoutRef.current);
      if (fieldTimeoutRef.current) clearTimeout(fieldTimeoutRef.current);
    };
  }, []);

  // ═══ AI ═══
  const buildCardDataForAi = () => {
    const profileParts: string[] = [];
    if (firstName || lastName) profileParts.push(`Contact : ${[firstName, lastName].filter(Boolean).join(" ")}`);
    if (company) profileParts.push(`Entreprise : ${company}`);
    if (email) profileParts.push(`Email : ${email}`);
    if (phone) profileParts.push(`Téléphone : ${phone}`);
    if (linkedinUrl) profileParts.push(`LinkedIn : ${linkedinUrl}`);
    if (websiteUrl) profileParts.push(`Site web : ${websiteUrl}`);
    const currentColumn = allColumns.find(col => col.id === card?.column_id);
    if (currentColumn) profileParts.push(`Étape CRM : ${currentColumn.name}`);
    if (card?.confidence_score != null) profileParts.push(`Confiance : ${card.confidence_score}%`);
    if (card?.acquisition_source) profileParts.push(`Source : ${card.acquisition_source}`);
    return {
      title: card?.title ?? "", description: descriptionHtml, company,
      first_name: firstName, last_name: lastName, service_type: serviceType,
      estimated_value: parseValue(), comments: details?.comments || [],
      brief_questions: card?.brief_questions || [], activities: details?.activity || [],
      emails_sent: (details?.emails || []).map(e => ({ subject: e.subject, body_html: e.body_html, sent_at: e.sent_at, recipient_email: e.recipient_email })),
      client_profile: profileParts.join("\n"),
    };
  };

  const handleAiAnalysis = async () => {
    if (!card) return;
    setAiAnalyzing(true);
    setAiAnalysis(null);
    try {
      const result = await crmAiAssist("analyze_exchanges", buildCardDataForAi());
      setAiAnalysis(result);
    } catch { setAiAnalysis("Erreur lors de l'analyse. Veuillez réessayer."); }
    finally { setAiAnalyzing(false); }
  };

  const handleGenerateQuoteDescription = async () => {
    if (!card) return;
    setQuoteGenerating(true);
    setQuoteDescription(null);
    try {
      const result = await crmAiAssist("generate_quote_description", buildCardDataForAi());
      setQuoteDescription(result);
    } catch { setQuoteDescription("Erreur lors de la génération. Veuillez réessayer."); }
    finally { setQuoteGenerating(false); }
  };

  const handleImproveEmailSubject = async () => {
    if (!emailSubject.trim()) return;
    setImprovingSubject(true);
    setEmailSubjectBeforeAi(emailSubject);
    try {
      const result = await crmAiAssist("improve_email_subject", { ...buildCardDataForAi(), subject: emailSubject });
      setEmailSubject(result);
    } catch { setEmailSubjectBeforeAi(null); }
    finally { setImprovingSubject(false); }
  };

  const handleImproveEmailBody = async () => {
    if (!emailBody.trim()) return;
    setImprovingBody(true);
    setEmailBodyBeforeAi(emailBody);
    try {
      const result = await crmAiAssist("improve_email_body", { ...buildCardDataForAi(), body: emailBody, subject: emailSubject });
      setEmailBody(result);
    } catch { setEmailBodyBeforeAi(null); }
    finally { setImprovingBody(false); }
  };

  const handleUndoSubjectAi = () => { if (emailSubjectBeforeAi) { setEmailSubject(emailSubjectBeforeAi); setEmailSubjectBeforeAi(null); } };
  const handleUndoBodyAi = () => { if (emailBodyBeforeAi) { setEmailBody(emailBodyBeforeAi); setEmailBodyBeforeAi(null); } };

  const handleSuggestNextAction = async () => {
    if (!card) return;
    setNextActionSuggesting(true);
    try {
      const result = await crmAiAssist("suggest_next_action", { ...buildCardDataForAi(), confidence_score: confidenceScore, current_next_action: nextActionText, days_in_pipeline: card.created_at ? Math.floor((Date.now() - new Date(card.created_at).getTime()) / (1000 * 60 * 60 * 24)) : null, activities: details?.activity?.slice(0, 10) || [] });
      setScheduledText(result);
      setShowSchedulePopover(true);
    } catch { toast({ title: "Erreur", description: "Impossible de générer une suggestion.", variant: "destructive" }); }
    finally { setNextActionSuggesting(false); }
  };

  const copyToClipboard = async (text: string) => { await navigator.clipboard.writeText(text); };

  // ═══ LINKEDIN / WEBSITE AUTO ═══
  useEffect(() => {
    if (card?.linkedin_url) return;
    if (firstName.trim() || lastName.trim()) {
      const name = [firstName.trim(), lastName.trim().toUpperCase()].filter(Boolean).join(" ");
      setLinkedinUrl(`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(name)}`);
    } else { setLinkedinUrl(""); }
  }, [firstName, lastName, card?.linkedin_url]);

  const commonEmailProviders = new Set([
    "gmail.com", "googlemail.com", "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr",
    "live.com", "live.fr", "msn.com", "yahoo.com", "yahoo.fr", "aol.com",
    "icloud.com", "me.com", "mac.com", "protonmail.com", "proton.me",
    "free.fr", "orange.fr", "sfr.fr", "laposte.net", "wanadoo.fr",
    "bbox.fr", "numericable.fr", "neuf.fr", "cegetel.net",
    "gmx.com", "gmx.fr", "mail.com", "zoho.com", "yandex.com",
    "tutanota.com", "fastmail.com", "hey.com",
  ]);

  useEffect(() => {
    if (!cardLoadedRef.current) return;
    if (email.trim()) {
      const atIndex = email.indexOf("@");
      if (atIndex >= 0) {
        const domain = email.slice(atIndex + 1).trim().toLowerCase();
        if (domain && domain.indexOf(".") >= 0 && !commonEmailProviders.has(domain)) {
          const newUrl = `https://www.${domain}`;
          if (websiteUrl !== newUrl) setWebsiteUrl(newUrl);
          return;
        }
      }
    }
    if (!company.trim() || websiteLookedUpRef.current) return;
    websiteLookupAbortRef.current?.abort();
    const controller = new AbortController();
    websiteLookupAbortRef.current = controller;
    const timer = setTimeout(async () => {
      try {
        const emailDomain = email.includes("@") ? email.split("@")[1]?.trim() : "";
        const result = await crmAiAssist("find_website", { company, context: emailDomain });
        if (controller.signal.aborted) return;
        if (result) { websiteLookedUpRef.current = true; setWebsiteUrl(result); }
      } catch { /* best-effort */ }
    }, 1500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [email, company]);

  // ═══ STATUS CHANGES ═══

  const buildTrainingParams = (): URLSearchParams => {
    const params = new URLSearchParams();
    if (company) params.set("clientName", company);
    if (firstName) params.set("sponsorFirstName", firstName);
    if (lastName) params.set("sponsorLastName", lastName);
    if (email) params.set("sponsorEmail", email);
    if (phone) params.set("sponsorPhone", phone);
    if (title) params.set("trainingName", title.replace(/^\([^)]+\)\s*/, ""));
    if (card?.id) params.set("fromCrmCardId", card.id);
    if (estimatedValue && parseFloat(estimatedValue) > 0) params.set("estimatedValue", estimatedValue);
    return params;
  };

  const promptWinChoice = () => {
    const params = buildTrainingParams();
    setPendingTrainingParams(params);
    celebrateWin();
    setShowWinChoiceDialog(true);
  };

  const promptCreateTraining = () => {
    const params = buildTrainingParams();
    setPendingTrainingParams(params);
    setShowCreateTrainingDialog(true);
  };

  const applyStatusChange = async (newStatus: SalesStatus, previousStatus: SalesStatus) => {
    if (!card || !user?.email) return;
    setSalesStatus(newStatus);
    const isFinalStatus = newStatus === "WON" || newStatus === "LOST";
    const updates: Record<string, unknown> = { sales_status: newStatus };
    if (isFinalStatus) { updates.status_operational = "TODAY"; updates.waiting_next_action_date = null; updates.waiting_next_action_text = null; setScheduledDate(""); setScheduledText(""); }
    if (newStatus === "WON" && previousStatus !== "WON") updates.won_at = new Date().toISOString();
    if (newStatus === "LOST" && previousStatus !== "LOST") updates.lost_at = new Date().toISOString();
    if (newStatus === "OPEN") { updates.won_at = null; updates.lost_at = null; updates.loss_reason = null; updates.loss_reason_detail = null; }
    const statusChangedToWon = newStatus === "WON" && previousStatus !== "WON";
    await updateCard.mutateAsync({ id: card.id, updates, actorEmail: user.email, oldCard: card });
    if (statusChangedToWon) promptWinChoice();
  };

  const handleSalesStatusChange = async (newStatus: SalesStatus) => {
    if (!card || !user?.email) return;
    const previousStatus = salesStatus;
    if (newStatus === previousStatus) { await applyStatusChange("OPEN", previousStatus); return; }
    if (newStatus === "LOST" && previousStatus !== "LOST") { setPendingLossStatus(true); setShowLossReasonDialog(true); return; }
    await applyStatusChange(newStatus, previousStatus);
  };

  const handleLossReasonConfirm = async (reason: LossReason, detail: string) => {
    setShowLossReasonDialog(false);
    setPendingLossStatus(false);
    const lossColumnId = pendingLossColumnId;
    setPendingLossColumnId(null);
    if (!card || !user?.email) return;
    setSalesStatus("LOST");
    const updates: Record<string, unknown> = { sales_status: "LOST", loss_reason: reason, loss_reason_detail: detail || null, lost_at: new Date().toISOString(), status_operational: "TODAY", waiting_next_action_date: null, waiting_next_action_text: null };
    if (lossColumnId) updates.column_id = lossColumnId;
    setScheduledDate(""); setScheduledText("");
    await updateCard.mutateAsync({ id: card.id, updates, actorEmail: user.email, oldCard: card });
  };

  const handleLossReasonCancel = () => {
    setShowLossReasonDialog(false);
    setPendingLossStatus(false);
    if (pendingLossColumnId && card) setColumnId(card.column_id);
    setPendingLossColumnId(null);
  };

  const handleColumnChange = async (newColumnId: string, columnName: string) => {
    if (!card || !user?.email) return;
    setColumnId(newColumnId);
    const isWonColumn = isWonColumnName(columnName);
    const isLostColumn = isLostColumnName(columnName);
    const currentColumn = allColumns.find(col => col.id === card.column_id);
    const wasInWonColumn = currentColumn ? isWonColumnName(currentColumn.name) : false;
    const wasInLostColumn = currentColumn ? isLostColumnName(currentColumn.name) : false;
    const movingToWon = isWonColumn && !wasInWonColumn;
    const movingToLost = isLostColumn && !wasInLostColumn;
    const leavingWonColumn = wasInWonColumn && !isWonColumn;
    const leavingLostColumn = wasInLostColumn && !isLostColumn;
    if (movingToLost && salesStatus !== "LOST") { setPendingLossColumnId(newColumnId); setPendingLossStatus(true); setShowLossReasonDialog(true); return; }
    const updates: Record<string, unknown> = { column_id: newColumnId };
    if (isWonColumn) { updates.sales_status = "WON"; setSalesStatus("WON"); } else if (leavingWonColumn) { updates.sales_status = "OPEN"; setSalesStatus("OPEN"); }
    if (leavingLostColumn) { updates.sales_status = "OPEN"; updates.lost_at = null; updates.loss_reason = null; updates.loss_reason_detail = null; setSalesStatus("OPEN"); }
    await updateCard.mutateAsync({ id: card.id, updates, actorEmail: user.email, oldCard: card });
    if (movingToWon) promptWinChoice();
  };

  const handleScheduleAction = async () => {
    if (!card || !user?.email || !scheduledDate || !scheduledText.trim()) return;
    const selectedDate = startOfDay(new Date(scheduledDate));
    const today = startOfDay(new Date());
    if (!isAfter(selectedDate, today)) { toast({ title: "Date invalide", description: "La date doit être dans le futur (pas aujourd'hui).", variant: "destructive" }); return; }
    try {
      await updateCard.mutateAsync({ id: card.id, updates: { waiting_next_action_date: scheduledDate, waiting_next_action_text: scheduledText.trim() }, actorEmail: user.email, oldCard: card });
      setShowSchedulePopover(false);
    } catch (e) {
      console.error("handleScheduleAction error:", e);
      toast({ title: "Erreur", description: "Impossible de programmer l'action.", variant: "destructive" });
    }
  };

  const handleClearSchedule = async () => {
    if (!card || !user?.email) return;
    try {
      await updateCard.mutateAsync({ id: card.id, updates: { waiting_next_action_date: null, waiting_next_action_text: null }, actorEmail: user.email, oldCard: card });
      setScheduledDate(""); setScheduledText("");
    } catch (e) {
      console.error("handleClearSchedule error:", e);
      toast({ title: "Erreur", description: "Impossible d'annuler la programmation.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!card) return;
    if (confirm("Supprimer cette opportunité ?")) {
      try {
        await deleteCard.mutateAsync(card.id);
        onOpenChange(false);
      } catch (e) {
        console.error("handleDelete error:", e);
        toast({ title: "Erreur", description: "Impossible de supprimer l'opportunité.", variant: "destructive" });
      }
    }
  };

  const handleToggleTag = async (tagId: string) => {
    if (!card || !user?.email) return;
    try {
      const hasTag = card.tags?.some((t) => t.id === tagId);
      if (hasTag) { await unassignTag.mutateAsync({ cardId: card.id, tagId, actorEmail: user.email }); }
      else { await assignTag.mutateAsync({ cardId: card.id, tagId, actorEmail: user.email }); }
    } catch (e: unknown) {
      console.error("handleToggleTag error:", e);
      const hasTag = card.tags?.some((t) => t.id === tagId);
      const action = hasTag ? "retirer" : "affecter";
      const detail = e?.message || e?.error_description || "";
      toast({ title: "Erreur", description: `Impossible d'${action} le tag.${detail ? ` ${detail}` : ""}`, variant: "destructive" });
    }
  };

  const handleAddComment = async () => {
    if (!card || !user?.email || !newComment.trim()) return;
    try {
      await addComment.mutateAsync({ cardId: card.id, content: newComment.trim(), authorEmail: user.email });
      setNewComment("");
    } catch (e) {
      console.error("handleAddComment error:", e);
      toast({ title: "Erreur", description: "Impossible d'ajouter le commentaire.", variant: "destructive" });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!card || !user?.email || !e.target.files?.[0]) return;
    try {
      await addAttachment.mutateAsync({ cardId: card.id, file: e.target.files[0], actorEmail: user.email });
    } catch (err) {
      console.error("handleFileUpload error:", err);
      toast({ title: "Erreur", description: "Impossible d'uploader le fichier.", variant: "destructive" });
    }
    e.target.value = "";
  };

  const handleEmailAttachFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => { const base64 = (reader.result as string).split(",")[1]; setEmailAttachments((prev) => [...prev, { filename: file.name, content: base64 }]); };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleRemoveAttachment = (index: number) => { setEmailAttachments((prev) => prev.filter((_, i) => i !== index)); };

  const parseEmails = (str: string): string[] => str.split(/[,;\s]+/).map(s => s.trim()).filter(s => s.includes("@"));

  const sendingRef = useRef(false);
  const handleSendEmail = async () => {
    if (!card || !user?.email || !emailTo.trim() || !emailSubject.trim()) return;
    if (sendingRef.current) return; // prevent duplicate sends
    sendingRef.current = true;
    try {
      const sentSubject = emailSubject.trim();
      const sentBody = DOMPurify.sanitize(emailBody);
      const templateSnapshot = selectedTemplateRef.current;
      const ccList = parseEmails(emailCc);
      const bccList = parseEmails(emailBcc);
      await sendEmail.mutateAsync({
        input: { card_id: card.id, recipient_email: emailTo.trim(), subject: sentSubject, body_html: sentBody, attachments: emailAttachments.length > 0 ? emailAttachments : undefined, cc: ccList.length > 0 ? ccList : undefined, bcc: bccList.length > 0 ? bccList : undefined },
        senderEmail: user.email,
      });
      setEmailTo(""); setEmailCc(""); setEmailBcc(""); setShowCcBcc(false); setEmailSubject(""); setEmailBody(""); setEmailAttachments([]); selectedTemplateRef.current = null;
      await queryClient.invalidateQueries({ queryKey: ["crm-board", "card-details", card.id] });
      if (templateSnapshot) {
        try {
          const result = await crmAiAssist("improve_template", { subject: templateSnapshot.subject, body: templateSnapshot.html_content, context: `Objet envoyé : ${sentSubject}\n\nContenu envoyé :\n${sentBody}` });
          if (result) { try { const improved = JSON.parse(result); if (improved.subject && improved.html_content) { await updateTemplate.mutateAsync({ id: templateSnapshot.id, updates: { subject: improved.subject, html_content: improved.html_content } }); } } catch { /* skip */ } }
        } catch { /* best-effort */ }
      }
    } finally {
      sendingRef.current = false;
    }
  };

  const handleConfirmCreateTraining = () => {
    if (pendingTrainingParams) { setShowCreateTrainingDialog(false); setShowWinChoiceDialog(false); onOpenChange(false); navigate(`/formations/new?${pendingTrainingParams.toString()}`); setPendingTrainingParams(null); }
  };

  const handleConfirmCreateMission = () => {
    setShowWinChoiceDialog(false); onOpenChange(false);
    const missionTitle = title.replace(/^\([^)]+\)\s*/, "");
    const params = new URLSearchParams();
    if (missionTitle) params.set("title", missionTitle);
    if (company) params.set("clientName", company);
    if (firstName) params.set("contactFirstName", firstName);
    if (lastName) params.set("contactLastName", lastName);
    if (email) params.set("contactEmail", email);
    if (phone) params.set("contactPhone", phone);
    if (estimatedValue && parseFloat(estimatedValue) > 0) params.set("totalAmount", estimatedValue);
    if (card?.id) params.set("fromCrmCardId", card.id);
    navigate(`/missions?${params.toString()}`);
  };

  // ═══ RENDER ═══
  if (!card) return null;

  const state: CardDetailState = {
    card, allTags, allColumns,
    title, setTitle, cardEmoji, setCardEmoji, descriptionHtml, salesStatus,
    estimatedValue, setEstimatedValue, quoteUrl, setQuoteUrl, columnId,
    contactExpanded, setContactExpanded,
    firstName, setFirstName, lastName, setLastName, company, setCompany,
    email, setEmail, phone, setPhone, linkedinUrl, setLinkedinUrl,
    websiteUrl, setWebsiteUrl, serviceType, setServiceType,
    assignedTo, setAssignedTo, confidenceScore, setConfidenceScore,
    acquisitionSource, setAcquisitionSource,
    scheduledDate, setScheduledDate, scheduledText, setScheduledText,
    showSchedulePopover, setShowSchedulePopover,
    nextActionText, setNextActionText, nextActionDone, setNextActionDone,
    nextActionType, setNextActionType, nextActionSuggesting,
    localBriefQuestions, setLocalBriefQuestions, briefExpanded, setBriefExpanded,
    linkedMissionId, setLinkedMissionId, missionSearchQuery, setMissionSearchQuery,
    showMissionSearch, setShowMissionSearch,
    emailTo, setEmailTo, emailCc, setEmailCc, emailBcc, setEmailBcc,
    showCcBcc, setShowCcBcc, emailSubject, setEmailSubject, emailBody, setEmailBody,
    emailAttachments, setEmailAttachments,
    emailSubjectBeforeAi, emailBodyBeforeAi, improvingSubject, improvingBody,
    isFullScreen, setIsFullScreen, fieldSaving, fieldSaved, descriptionSaving, descriptionSaved,
    aiAnalyzing, aiAnalysis, setAiAnalysis, quoteGenerating, quoteDescription, setQuoteDescription,
    showPricingDialog, setShowPricingDialog, newComment, setNewComment,
  };

  const handlers: CardDetailHandlers = {
    handleDescriptionChange, handleSalesStatusChange, handleColumnChange,
    handleScheduleAction, handleClearSchedule, handleSuggestNextAction,
    handleDelete, handleToggleTag, handleAddComment, handleFileUpload,
    handleEmailAttachFiles, handleRemoveAttachment, handleSendEmail,
    handleAiAnalysis, handleGenerateQuoteDescription,
    handleImproveEmailSubject, handleImproveEmailBody,
    handleUndoSubjectAi, handleUndoBodyAi, copyToClipboard, promptCreateTraining,
  };

  return (
    <>
      <DetailDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <EmojiPickerButton emoji={cardEmoji} onEmojiChange={setCardEmoji} size="md" />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 min-w-0 bg-transparent font-bold text-lg border-none outline-none focus:outline-none"
            />
          </div>
        }
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => setIsFullScreen(!isFullScreen)} title={isFullScreen ? "Réduire" : "Plein écran"}>
              {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            {(fieldSaving || descriptionSaving) && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /></span>}
            {(fieldSaved || descriptionSaved) && !fieldSaving && !descriptionSaving && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /></span>}
          </>
        }
        contentClassName={`flex flex-col overflow-hidden transition-all duration-300 ${isFullScreen ? "sm:max-w-full" : "sm:max-w-[1100px]"}`}
        headerClassName="shrink-0 border-b pb-3"
      >
        <div className="flex-1 overflow-y-auto">
          <CardDetailToolbar state={state} handlers={handlers} updatePending={updateCard.isPending} />
          <CardDetailTagsBar state={state} handlers={handlers} />
          <CardDetailSchedule state={state} handlers={handlers} updatePending={updateCard.isPending} />
          <CardDetailContact state={state} handlers={handlers} />
          <CardDetailQualification state={state} handlers={handlers} />
          <CardDetailCommercial state={state} handlers={handlers} />
          <CardDetailCommunication state={state} handlers={handlers} details={details} emailFileInputRef={emailFileInputRef} selectedTemplateRef={selectedTemplateRef} />
          <CardDetailTabs state={state} handlers={handlers} details={details} detailsLoading={detailsLoading} />

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
              <Button variant="destructive" onClick={handleDelete} disabled={deleteCard.isPending} className="w-full">
                {deleteCard.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Supprimer cette opportunité
              </Button>
            </div>
          </div>
        </div>
      </DetailDrawer>

      <CardDetailDialogs
        cardId={card.id}
        title={title}
        firstName={firstName}
        lastName={lastName}
        email={email}
        company={company}
        estimatedValue={estimatedValue}
        serviceType={serviceType}
        showLossReasonDialog={showLossReasonDialog}
        onLossReasonConfirm={handleLossReasonConfirm}
        onLossReasonCancel={handleLossReasonCancel}
        showPricingDialog={showPricingDialog}
        setShowPricingDialog={setShowPricingDialog}
        pricingLines={pricingLines}
        setPricingLines={setPricingLines}
        pricingTravelTotal={pricingTravelTotal}
        setPricingTravelTotal={setPricingTravelTotal}
        setEstimatedValue={setEstimatedValue}
        showCreateTrainingDialog={showCreateTrainingDialog}
        setShowCreateTrainingDialog={setShowCreateTrainingDialog}
        pendingTrainingParams={pendingTrainingParams}
        handleConfirmCreateTraining={handleConfirmCreateTraining}
        showWinChoiceDialog={showWinChoiceDialog}
        setShowWinChoiceDialog={setShowWinChoiceDialog}
        handleConfirmCreateMission={handleConfirmCreateMission}
        onOpenChange={onOpenChange}
      />
    </>
  );
};

export default CardDetailDrawer;
