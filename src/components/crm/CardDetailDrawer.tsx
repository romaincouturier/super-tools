import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import DetailDrawer from "@/components/shared/DetailDrawer";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import CrmDescriptionEditor from "./CrmDescriptionEditor";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import {
  Save,
  Trash2,
  Plus,
  X,
  Paperclip,
  MessageSquare,
  History,
  Mail,
  Tag,
  FileText,
  Loader2,
  ExternalLink,
  User,
  Building2,
  Phone,
  Linkedin,
  CheckCircle2,
  Circle,
  Receipt,
  Calendar,
  LinkIcon,
  AlertTriangle,
  Maximize2,
  Minimize2,
  Brain,
  FileSignature,
  Check,
  Globe,
  Copy,
  Briefcase,
  Search,
  Undo2,
  Wand2,
  ImageIcon,
  ChevronDown,
  Trophy,
  XCircle,
  MoreVertical,
  Rocket,
  GraduationCap,
  UserPlus,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays, isAfter, startOfDay, parseISO, isFuture } from "date-fns";
import { fr } from "date-fns/locale";
import DOMPurify from "dompurify";
import { QRCodeSVG } from "qrcode.react";
import EmojiPickerButton from "@/components/ui/emoji-picker-button";
import {
  CrmCard,
  CrmTag,
  CrmColumn,
  SalesStatus,
  BriefQuestion,
  AcquisitionSource,
  LossReason,
  acquisitionSourceConfig,
  lossReasonConfig,
  EmailAttachment,
} from "@/types/crm";
import LossReasonDialog from "./LossReasonDialog";
import EntityMediaManager from "@/components/media/EntityMediaManager";
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
import { useSearchMissions } from "@/hooks/useMissions";
import { missionStatusConfig } from "@/types/missions";
import EmailEditor from "./EmailEditor";
import SentDevisSection from "./SentDevisSection";
import { CreateTrainingDialog } from "./CreateTrainingDialog";
import confetti from "canvas-confetti";
import { useCrmEmailTemplates, useUpdateCrmTemplate, replaceCrmVariables } from "@/hooks/useCrmEmailTemplates";
import { useToast } from "@/hooks/use-toast";

interface CardDetailDrawerProps {
  card: CrmCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allTags: CrmTag[];
  allColumns: CrmColumn[];
}

const salesStatusConfig: Record<SalesStatus, { label: string; color: string }> = {
  OPEN: { label: "En cours", color: "bg-blue-500 hover:bg-blue-600" },
  WON: { label: "Gagné", color: "bg-green-500 hover:bg-green-600" },
  LOST: { label: "Perdu", color: "bg-red-500 hover:bg-red-600" },
  CANCELED: { label: "Annulé", color: "bg-gray-500 hover:bg-gray-600" },
};

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
  const deleteComment = useDeleteComment();
  const addAttachment = useAddAttachment();
  const deleteAttachment = useDeleteAttachment();
  const sendEmail = useSendEmail();
  const { data: crmEmailTemplates } = useCrmEmailTemplates();
  const updateTemplate = useUpdateCrmTemplate();

  // Form state
  const [title, setTitle] = useState("");
  const [cardEmoji, setCardEmoji] = useState<string | null>(null);
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [salesStatus, setSalesStatus] = useState<SalesStatus>("OPEN");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [quoteUrl, setQuoteUrl] = useState("");
  const [columnId, setColumnId] = useState("");

  // Contact fields state (editable)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [serviceType, setServiceType] = useState<"formation" | "mission" | null>(null);

  // Confidence score state
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);

  // Acquisition source state
  const [acquisitionSource, setAcquisitionSource] = useState<AcquisitionSource | null>(null);

  // Loss reason dialog state
  const [showLossReasonDialog, setShowLossReasonDialog] = useState(false);
  const [pendingLossStatus, setPendingLossStatus] = useState(false);
  const [pendingLossColumnId, setPendingLossColumnId] = useState<string | null>(null);

  // Next best action AI state
  const [nextActionSuggesting, setNextActionSuggesting] = useState(false);
  const [nextActionSuggestion, setNextActionSuggestion] = useState<string | null>(null);

  // Scheduled action state
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledText, setScheduledText] = useState("");

  // Next action state
  const [nextActionText, setNextActionText] = useState("");
  const [nextActionDone, setNextActionDone] = useState(false);
  const [nextActionType, setNextActionType] = useState<"email" | "phone" | "rdv_physique" | "rdv_visio" | "other">("other");

  // Linked mission state
  const [linkedMissionId, setLinkedMissionId] = useState<string | null>(null);
  const [missionSearchQuery, setMissionSearchQuery] = useState("");
  const [showMissionSearch, setShowMissionSearch] = useState(false);
  const { data: missionSearchResults, isLoading: searchingMissions } = useSearchMissions(missionSearchQuery);

  // Comment state
  const [newComment, setNewComment] = useState("");

  // Email state
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSubjectBeforeAi, setEmailSubjectBeforeAi] = useState<string | null>(null);
  const [emailBodyBeforeAi, setEmailBodyBeforeAi] = useState<string | null>(null);
  const [improvingSubject, setImprovingSubject] = useState(false);
  const [improvingBody, setImprovingBody] = useState(false);
  const [emailAttachments, setEmailAttachments] = useState<EmailAttachment[]>([]);
  const selectedTemplateRef = useRef<{ id: string; subject: string; html_content: string } | null>(null);
  const emailFileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [isFullScreen, setIsFullScreen] = useState(false);

  // AI state
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [quoteGenerating, setQuoteGenerating] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [quoteDescription, setQuoteDescription] = useState<string | null>(null);

  // Auto-save state
  const [descriptionSaving, setDescriptionSaving] = useState(false);
  const [descriptionSaved, setDescriptionSaved] = useState(false);
  const descriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [fieldSaving, setFieldSaving] = useState(false);
  const [fieldSaved, setFieldSaved] = useState(false);
  const fieldTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Email history state
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);

  // Create training/mission dialog state (win choice)
  const [showCreateTrainingDialog, setShowCreateTrainingDialog] = useState(false);
  const [showWinChoiceDialog, setShowWinChoiceDialog] = useState(false);
  const [pendingTrainingParams, setPendingTrainingParams] = useState<URLSearchParams | null>(null);
  const [showSchedulePopover, setShowSchedulePopover] = useState(false);

  // Attach to existing inter-entreprise training state
  const [interTrainings, setInterTrainings] = useState<Array<{
    id: string;
    training_name: string;
    start_date: string;
    client_name: string;
    format_formation: string | null;
  }>>([]);
  const [interTrainingsLoading, setInterTrainingsLoading] = useState(false);
  const [showAttachTraining, setShowAttachTraining] = useState(false);

  // Fetch upcoming inter-entreprise trainings when win dialog opens
  useEffect(() => {
    if (!showWinChoiceDialog) {
      setShowAttachTraining(false);
      return;
    }
    const fetchInterTrainings = async () => {
      setInterTrainingsLoading(true);
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("trainings")
        .select("id, training_name, start_date, client_name, format_formation")
        .in("format_formation", ["inter-entreprises", "e_learning"])
        .gte("start_date", today)
        .order("start_date", { ascending: true })
        .limit(50);

      if (!error && data) {
        setInterTrainings(data);
      }
      setInterTrainingsLoading(false);
    };
    fetchInterTrainings();
  }, [showWinChoiceDialog]);

  // Handle attach to existing inter-entreprise training
  const handleAttachToTraining = (trainingId: string) => {
    setShowWinChoiceDialog(false);
    onOpenChange(false);
    const params = new URLSearchParams();
    if (firstName) params.set("addParticipantFirstName", firstName);
    if (lastName) params.set("addParticipantLastName", lastName);
    if (email) params.set("addParticipantEmail", email);
    if (company) params.set("addParticipantCompany", company);
    if (estimatedValue && parseFloat(estimatedValue) > 0) {
      params.set("addParticipantSoldPriceHt", estimatedValue);
    }
    if (card?.id) params.set("fromCrmCardId", card.id);
    const qs = params.toString();
    navigate(`/formations/${trainingId}${qs ? `?${qs}` : ""}`);
  };

  // Get tomorrow's date as minimum for scheduling
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  // Initialize form when a DIFFERENT card is opened (not on every refetch)
  const prevCardIdRef = useRef<string | null>(null);
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
      // Contact fields
      setFirstName(card.first_name || "");
      setLastName(card.last_name || "");
      setCompany(card.company || "");
      setEmail(card.email || "");
      setPhone(card.phone || "");
      setLinkedinUrl(card.linkedin_url || "");
      setWebsiteUrl(card.website_url || "");
      setServiceType(card.service_type || null);
      // Confidence score
      setConfidenceScore(card.confidence_score ?? 50);
      // Acquisition source
      setAcquisitionSource(card.acquisition_source ?? null);
      // Reset next action suggestion
      setNextActionSuggestion(null);
      // Next action
      setNextActionText(card.next_action_text || "");
      setNextActionDone(card.next_action_done || false);
      setNextActionType((card as any).next_action_type || "other");
      // Linked mission
      setLinkedMissionId(card.linked_mission_id || null);
      setMissionSearchQuery("");
      setShowMissionSearch(false);
      // Reset AI state
      setAiAnalysis(null);
      setQuoteDescription(null);
      setDescriptionSaved(false);
      setFieldSaved(false);
      // Mark card as loaded (skip first auto-save trigger)
      cardLoadedRef.current = false;
      setTimeout(() => { cardLoadedRef.current = true; }, 100);
    }
  }, [card]);

  // Reset tracking when drawer closes so re-opening the same card reinitializes
  useEffect(() => {
    if (!open) {
      prevCardIdRef.current = null;
    }
  }, [open]);

  // Track whether card data is loaded (to avoid auto-saving on initial render)
  const cardLoadedRef = useRef(false);

  // Auto-save all fields (except description which has its own handler)
  useEffect(() => {
    if (!cardLoadedRef.current || !card) return;
    autoSaveField({
      title: title.trim(),
      sales_status: salesStatus,
      estimated_value: parseValue(),
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
      next_action_type: nextActionType,
      linked_mission_id: linkedMissionId,
      emoji: cardEmoji,
      confidence_score: confidenceScore,
      acquisition_source: acquisitionSource,
    });
  }, [title, salesStatus, estimatedValue, quoteUrl, columnId, scheduledDate, scheduledText,
      firstName, lastName, company, email, phone, linkedinUrl, websiteUrl, serviceType,
      nextActionText, nextActionDone, nextActionType, linkedMissionId, cardEmoji, confidenceScore, acquisitionSource]);

  // Auto-save description with debounce
  const saveDescription = useCallback(async (newDescription: string) => {
    if (!card || !user?.email) return;

    setDescriptionSaving(true);
    setDescriptionSaved(false);

    try {
      await updateCard.mutateAsync({
        id: card.id,
        updates: {
          description_html: DOMPurify.sanitize(newDescription),
        },
        actorEmail: user.email,
        oldCard: card,
      });
      setDescriptionSaved(true);
      // Reset saved indicator after 2 seconds
      setTimeout(() => setDescriptionSaved(false), 2000);
    } catch (error) {
      console.error("Failed to auto-save description:", error);
    } finally {
      setDescriptionSaving(false);
    }
  }, [card, user?.email, updateCard]);

  const handleDescriptionChange = (value: string) => {
    setDescriptionHtml(value);

    // Clear existing timeout
    if (descriptionTimeoutRef.current) {
      clearTimeout(descriptionTimeoutRef.current);
    }

    // Set new timeout for auto-save (1.5 seconds debounce)
    descriptionTimeoutRef.current = setTimeout(() => {
      saveDescription(value);
    }, 1500);
  };


  // Generic field auto-save with debounce
  const autoSaveField = useCallback((updates: Record<string, unknown>) => {
    if (!card || !user?.email) return;

    if (fieldTimeoutRef.current) {
      clearTimeout(fieldTimeoutRef.current);
    }

    fieldTimeoutRef.current = setTimeout(async () => {
      setFieldSaving(true);
      setFieldSaved(false);
      try {
        await updateCard.mutateAsync({
          id: card.id,
          updates: updates as any,
          actorEmail: user.email!,
          oldCard: card,
        });
        setFieldSaved(true);
        setTimeout(() => setFieldSaved(false), 2000);
      } catch (error) {
        console.error("Failed to auto-save field:", error);
      } finally {
        setFieldSaving(false);
      }
    }, 1000);
  }, [card, user?.email, updateCard]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (descriptionTimeoutRef.current) {
        clearTimeout(descriptionTimeoutRef.current);
      }
      if (fieldTimeoutRef.current) {
        clearTimeout(fieldTimeoutRef.current);
      }
    };
  }, []);

  // Shared helpers to avoid duplication
  const parseValue = () => parseFloat(estimatedValue) || 0;

  const buildCardDataForAi = () => ({
    title: card?.title ?? "",
    description: descriptionHtml,
    company,
    first_name: firstName,
    last_name: lastName,
    service_type: serviceType,
    estimated_value: parseValue(),
    comments: details?.comments || [],
    brief_questions: card?.brief_questions || [],
  });

  // AI Analysis function
  const handleAiAnalysis = async () => {
    if (!card) return;

    setAiAnalyzing(true);
    setAiAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
        body: {
          action: "analyze_exchanges",
          card_data: buildCardDataForAi(),
        },
      });

      if (error) throw error;
      setAiAnalysis(data.result);
    } catch (error) {
      console.error("AI analysis error:", error);
      setAiAnalysis("Erreur lors de l'analyse. Veuillez réessayer.");
    } finally {
      setAiAnalyzing(false);
    }
  };

  // Generate quote description
  const handleGenerateQuoteDescription = async () => {
    if (!card) return;

    setQuoteGenerating(true);
    setQuoteDescription(null);

    try {
      const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
        body: {
          action: "generate_quote_description",
          card_data: buildCardDataForAi(),
        },
      });

      if (error) throw error;
      setQuoteDescription(data.result);
    } catch (error) {
      console.error("Quote generation error:", error);
      setQuoteDescription("Erreur lors de la génération. Veuillez réessayer.");
    } finally {
      setQuoteGenerating(false);
    }
  };

  // Improve email subject with AI
  const handleImproveEmailSubject = async () => {
    if (!emailSubject.trim()) return;
    setImprovingSubject(true);
    setEmailSubjectBeforeAi(emailSubject);

    try {
      const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
        body: {
          action: "improve_email_subject",
          card_data: { ...buildCardDataForAi(), subject: emailSubject },
        },
      });

      if (error) throw error;
      setEmailSubject(data.result);
    } catch (error) {
      console.error("AI subject improvement error:", error);
      setEmailSubjectBeforeAi(null);
    } finally {
      setImprovingSubject(false);
    }
  };

  // Improve email body with AI
  const handleImproveEmailBody = async () => {
    if (!emailBody.trim()) return;
    setImprovingBody(true);
    setEmailBodyBeforeAi(emailBody);

    try {
      const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
        body: {
          action: "improve_email_body",
          card_data: { ...buildCardDataForAi(), body: emailBody, subject: emailSubject },
        },
      });

      if (error) throw error;
      setEmailBody(data.result);
    } catch (error) {
      console.error("AI body improvement error:", error);
      setEmailBodyBeforeAi(null);
    } finally {
      setImprovingBody(false);
    }
  };

  // Undo AI improvement
  const handleUndoSubjectAi = () => {
    if (emailSubjectBeforeAi) {
      setEmailSubject(emailSubjectBeforeAi);
      setEmailSubjectBeforeAi(null);
    }
  };

  const handleUndoBodyAi = () => {
    if (emailBodyBeforeAi) {
      setEmailBody(emailBodyBeforeAi);
      setEmailBodyBeforeAi(null);
    }
  };

  // Copy to clipboard
  // Suggest next action with AI (Feature 5)
  const handleSuggestNextAction = async () => {
    if (!card) return;
    setNextActionSuggesting(true);

    try {
      const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
        body: {
          action: "suggest_next_action",
          card_data: {
            ...buildCardDataForAi(),
            confidence_score: confidenceScore,
            current_next_action: nextActionText,
            days_in_pipeline: card.created_at ? Math.floor((Date.now() - new Date(card.created_at).getTime()) / (1000 * 60 * 60 * 24)) : null,
            activities: details?.activity?.slice(0, 10) || [],
          },
        },
      });

      if (error) throw error;
      setScheduledText(data.result);
      setShowSchedulePopover(true);
    } catch (error) {
      console.error("AI next action suggestion error:", error);
      toast({ title: "Erreur", description: "Impossible de générer une suggestion.", variant: "destructive" });
    } finally {
      setNextActionSuggesting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  // Auto-calculate LinkedIn search URL from first/last name (only if card has no saved URL)
  useEffect(() => {
    if (card?.linkedin_url) return; // Don't overwrite a saved LinkedIn URL
    if (firstName.trim() || lastName.trim()) {
      const name = [firstName.trim(), lastName.trim().toUpperCase()].filter(Boolean).join(" ");
      setLinkedinUrl(`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(name)}`);
    } else {
      setLinkedinUrl("");
    }
  }, [firstName, lastName, card?.linkedin_url]);

  // Common email providers (domains that should NOT be used as website)
  const commonEmailProviders = new Set([
    "gmail.com", "googlemail.com", "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr",
    "live.com", "live.fr", "msn.com", "yahoo.com", "yahoo.fr", "aol.com",
    "icloud.com", "me.com", "mac.com", "protonmail.com", "proton.me",
    "free.fr", "orange.fr", "sfr.fr", "laposte.net", "wanadoo.fr",
    "bbox.fr", "numericable.fr", "neuf.fr", "cegetel.net",
    "gmx.com", "gmx.fr", "mail.com", "zoho.com", "yandex.com",
    "tutanota.com", "fastmail.com", "hey.com",
  ]);

  // Track whether we already looked up the website for this card
  const websiteLookedUpRef = useRef(false);
  const websiteLookupAbortRef = useRef<AbortController | null>(null);

  // Auto-deduce website from email domain or company name (via API lookup)
  useEffect(() => {
    // Skip if website was already set from card data (user-entered)
    if (!cardLoadedRef.current) return;

    // 1) Try email domain first (instant, no API call)
    if (email.trim()) {
      const atIndex = email.indexOf("@");
      if (atIndex >= 0) {
        const domain = email.slice(atIndex + 1).trim().toLowerCase();
        if (domain && domain.indexOf(".") >= 0 && !commonEmailProviders.has(domain)) {
          const newUrl = `https://www.${domain}`;
          if (websiteUrl !== newUrl) {
            setWebsiteUrl(newUrl);
          }
          return;
        }
      }
    }

    // 2) Fallback: search real website via Clearbit/AI (debounced API call)
    if (!company.trim() || websiteLookedUpRef.current) return;

    // Abort previous lookup
    websiteLookupAbortRef.current?.abort();
    const controller = new AbortController();
    websiteLookupAbortRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const emailDomain = email.includes("@") ? email.split("@")[1]?.trim() : "";
        const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
          body: {
            action: "find_website",
            card_data: { company, context: emailDomain },
          },
        });
        if (controller.signal.aborted) return;
        if (!error && data?.result) {
          websiteLookedUpRef.current = true;
          setWebsiteUrl(data.result);
        }
      } catch {
        // Silently fail - website lookup is best-effort
      }
    }, 1500); // debounce 1.5s

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [email, company]);

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

  // Called when user confirms training creation from dialog
  const handleConfirmCreateTraining = () => {
    if (pendingTrainingParams) {
      setShowCreateTrainingDialog(false);
      setShowWinChoiceDialog(false);
      onOpenChange(false);
      navigate(`/formations/new?${pendingTrainingParams.toString()}`);
      setPendingTrainingParams(null);
    }
  };

  // Called when user chooses to create a mission after winning
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

  // Show win choice dialog (formation or mission)
  const promptWinChoice = () => {
    const params = buildTrainingParams();
    setPendingTrainingParams(params);
    celebrateWin();
    setShowWinChoiceDialog(true);
  };

  // Show training creation dialog (for formations or when user might want to create one)
  const promptCreateTraining = () => {
    const params = buildTrainingParams();
    setPendingTrainingParams(params);
    setShowCreateTrainingDialog(true);
  };

  const handleSave = async () => {
    if (!card || !user?.email) return;

    // Check if status changed to WON
    const statusChangedToWon = salesStatus === "WON" && card.sales_status !== "WON";

    await updateCard.mutateAsync({
      id: card.id,
      updates: {
        title: title.trim(),
        description_html: DOMPurify.sanitize(descriptionHtml),
        sales_status: salesStatus,
        estimated_value: parseValue(),
        quote_url: quoteUrl.trim() || null,
        column_id: columnId,
        waiting_next_action_date: scheduledDate || null,
        waiting_next_action_text: scheduledText.trim() || null,
        // Contact fields
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
        next_action_type: nextActionType,
        linked_mission_id: linkedMissionId,
        emoji: cardEmoji,
        confidence_score: confidenceScore,
        acquisition_source: acquisitionSource,
      },
      actorEmail: user.email,
      oldCard: card,
    });

    // If opportunity is WON, prompt win choice (formation or mission)
    if (statusChangedToWon) {
      promptWinChoice();
    }
  };

  const handleSalesStatusChange = async (newStatus: SalesStatus) => {
    if (!card || !user?.email) return;

    // Intercept LOST transition: show loss reason dialog first
    const previousStatus = salesStatus;
    if (newStatus === "LOST" && previousStatus !== "LOST") {
      setPendingLossStatus(true);
      setShowLossReasonDialog(true);
      return;
    }

    await applyStatusChange(newStatus, previousStatus);
  };

  // Called when loss reason dialog is confirmed
  const handleLossReasonConfirm = async (reason: LossReason, detail: string) => {
    setShowLossReasonDialog(false);
    setPendingLossStatus(false);
    const lossColumnId = pendingLossColumnId;
    setPendingLossColumnId(null);
    if (!card || !user?.email) return;

    setSalesStatus("LOST");

    const updates: Record<string, unknown> = {
      sales_status: "LOST",
      loss_reason: reason,
      loss_reason_detail: detail || null,
      lost_at: new Date().toISOString(),
      status_operational: "TODAY",
      waiting_next_action_date: null,
      waiting_next_action_text: null,
    };

    // If triggered from column change, also move the card
    if (lossColumnId) {
      updates.column_id = lossColumnId;
    }

    setScheduledDate("");
    setScheduledText("");

    await updateCard.mutateAsync({
      id: card.id,
      updates,
      actorEmail: user.email,
      oldCard: card,
    });
  };

  const handleLossReasonCancel = () => {
    setShowLossReasonDialog(false);
    setPendingLossStatus(false);
    // Revert column selection if triggered from column dropdown
    if (pendingLossColumnId && card) {
      setColumnId(card.column_id);
    }
    setPendingLossColumnId(null);
  };

  const applyStatusChange = async (newStatus: SalesStatus, previousStatus: SalesStatus) => {
    if (!card || !user?.email) return;
    setSalesStatus(newStatus);

    // When opportunity becomes WON or LOST, reset operational status to TODAY and clear waiting fields
    const isFinalStatus = newStatus === "WON" || newStatus === "LOST";
    const updates: Record<string, unknown> = { sales_status: newStatus };

    if (isFinalStatus) {
      updates.status_operational = "TODAY";
      updates.waiting_next_action_date = null;
      updates.waiting_next_action_text = null;
      setScheduledDate("");
      setScheduledText("");
    }

    // Set temporal timestamps
    if (newStatus === "WON" && previousStatus !== "WON") {
      updates.won_at = new Date().toISOString();
    }
    if (newStatus === "LOST" && previousStatus !== "LOST") {
      updates.lost_at = new Date().toISOString();
    }
    // Clear timestamps when reverting to OPEN
    if (newStatus === "OPEN") {
      updates.won_at = null;
      updates.lost_at = null;
      updates.loss_reason = null;
      updates.loss_reason_detail = null;
    }

    const statusChangedToWon = newStatus === "WON" && previousStatus !== "WON";

    await updateCard.mutateAsync({
      id: card.id,
      updates,
      actorEmail: user.email,
      oldCard: card,
    });

    // If opportunity is WON, prompt win choice (formation or mission)
    if (statusChangedToWon) {
      promptWinChoice();
    }
  };

  // Celebration confetti animation for won deals
  const celebrateWin = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const colors = ["#FFD700", "#FFA500", "#FF6347", "#32CD32", "#1E90FF", "#9370DB"];

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 },
        colors: colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 },
        colors: colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    // Initial burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.5, y: 0.5 },
      colors: colors,
    });

    frame();
  };

  const handleColumnChange = async (newColumnId: string, columnName: string) => {
    if (!card || !user?.email) return;
    setColumnId(newColumnId);

    // Detect if moving to a "won" column (contains "gagné" case-insensitive)
    const isWonColumn = columnName.toLowerCase().includes("gagné");
    const isLostColumn = columnName.toLowerCase().includes("perdu");

    // Check if currently in a "won" or "lost" column (before this move)
    const currentColumn = allColumns.find(col => col.id === card.column_id);
    const wasInWonColumn = currentColumn?.name.toLowerCase().includes("gagné") || false;
    const wasInLostColumn = currentColumn?.name.toLowerCase().includes("perdu") || false;

    // Detect if this is a fresh win (moving to won from non-won)
    const movingToWon = isWonColumn && !wasInWonColumn;
    const movingToLost = isLostColumn && !wasInLostColumn;

    // Detect if leaving a won column (moving from won to non-won)
    const leavingWonColumn = wasInWonColumn && !isWonColumn;
    const leavingLostColumn = wasInLostColumn && !isLostColumn;

    // Intercept move to "Perdu" column: show loss reason dialog
    if (movingToLost && salesStatus !== "LOST") {
      setPendingLossColumnId(newColumnId);
      setPendingLossStatus(true);
      setShowLossReasonDialog(true);
      return;
    }

    // Update column and sales status
    const updates: Record<string, any> = { column_id: newColumnId };

    if (isWonColumn) {
      // Moving to won column: set status to WON
      updates.sales_status = "WON";
      setSalesStatus("WON");
    } else if (leavingWonColumn) {
      // Leaving won column: reset status to OPEN
      updates.sales_status = "OPEN";
      setSalesStatus("OPEN");
    }

    if (leavingLostColumn) {
      updates.sales_status = "OPEN";
      updates.lost_at = null;
      updates.loss_reason = null;
      updates.loss_reason_detail = null;
      setSalesStatus("OPEN");
    }

    await updateCard.mutateAsync({
      id: card.id,
      updates,
      actorEmail: user.email,
      oldCard: card,
    });

    // If moving to won column, prompt win choice (formation or mission)
    if (movingToWon) {
      promptWinChoice();
    }
  };

  const handleScheduleAction = async () => {
    if (!card || !user?.email || !scheduledDate || !scheduledText.trim()) return;

    // Validate date is in the future (not today)
    const selectedDate = startOfDay(new Date(scheduledDate));
    const today = startOfDay(new Date());
    if (!isAfter(selectedDate, today)) {
      alert("La date doit être dans le futur (pas aujourd'hui)");
      return;
    }

    await updateCard.mutateAsync({
      id: card.id,
      updates: {
        waiting_next_action_date: scheduledDate,
        waiting_next_action_text: scheduledText.trim(),
      },
      actorEmail: user.email,
      oldCard: card,
    });

    onOpenChange(false);
  };

  const handleClearSchedule = async () => {
    if (!card || !user?.email) return;

    await updateCard.mutateAsync({
      id: card.id,
      updates: {
        waiting_next_action_date: null,
        waiting_next_action_text: null,
      },
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
    if (hasTag) {
      await unassignTag.mutateAsync({ cardId: card.id, tagId, actorEmail: user.email });
    } else {
      await assignTag.mutateAsync({ cardId: card.id, tagId, actorEmail: user.email });
    }
  };

  const handleAddComment = async () => {
    if (!card || !user?.email || !newComment.trim()) return;
    await addComment.mutateAsync({
      cardId: card.id,
      content: newComment.trim(),
      authorEmail: user.email,
    });
    setNewComment("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!card || !user?.email || !e.target.files?.[0]) return;
    await addAttachment.mutateAsync({
      cardId: card.id,
      file: e.target.files[0],
      actorEmail: user.email,
    });
    e.target.value = "";
  };

  const handleEmailAttachFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      // Limit to 10MB per file (Resend limit)
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "Fichier trop volumineux", description: `"${file.name}" dépasse 10 Mo.`, variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setEmailAttachments((prev) => [...prev, { filename: file.name, content: base64 }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleRemoveAttachment = (index: number) => {
    setEmailAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendEmail = async () => {
    if (!card || !user?.email || !emailTo.trim() || !emailSubject.trim()) return;
    const sentSubject = emailSubject.trim();
    const sentBody = DOMPurify.sanitize(emailBody);
    const templateSnapshot = selectedTemplateRef.current;
    await sendEmail.mutateAsync({
      input: {
        card_id: card.id,
        recipient_email: emailTo.trim(),
        subject: sentSubject,
        body_html: sentBody,
        attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
      },
      senderEmail: user.email,
    });
    setEmailTo("");
    setEmailSubject("");
    setEmailBody("");
    setEmailAttachments([]);
    selectedTemplateRef.current = null;
    // Explicitly refetch card details so email history updates immediately
    await queryClient.invalidateQueries({ queryKey: ["crm-board", "card-details", card.id] });
    // Auto-improve template in background if one was used
    if (templateSnapshot) {
      try {
        const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
          body: {
            action: "improve_template",
            card_data: {
              subject: templateSnapshot.subject,
              body: templateSnapshot.html_content,
              context: `Objet envoyé : ${sentSubject}\n\nContenu envoyé :\n${sentBody}`,
            },
          },
        });
        if (!error && data?.result) {
          try {
            const improved = JSON.parse(data.result);
            if (improved.subject && improved.html_content) {
              await updateTemplate.mutateAsync({
                id: templateSnapshot.id,
                updates: { subject: improved.subject, html_content: improved.html_content },
              });
            }
          } catch {
            // AI did not return valid JSON, skip update
          }
        }
      } catch {
        // Template improvement is best-effort, don't block on errors
      }
    }
  };

  if (!card) return null;

  const cardTags = card.tags || [];
  const tagsByCategory = allTags.reduce((acc, tag) => {
    const cat = tag.category || "Autre";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tag);
    return acc;
  }, {} as Record<string, CrmTag[]>);

  return (
    <>
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={<span className="sr-only">{card.title}</span>}
      actions={
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsFullScreen(!isFullScreen)}
            title={isFullScreen ? "Réduire" : "Plein écran"}
          >
            {isFullScreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          {(fieldSaving || descriptionSaving) && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
            </span>
          )}
          {(fieldSaved || descriptionSaved) && !fieldSaving && !descriptionSaving && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
            </span>
          )}
        </>
      }
      contentClassName={`flex flex-col overflow-hidden transition-all duration-300 ${
        isFullScreen ? "sm:max-w-full" : "sm:max-w-xl"
      }`}
      headerClassName="shrink-0 border-b pb-3"
    >

        <div className="flex-1 overflow-y-auto">
        {/* Toolbar - Column selector + Value + Actions */}
        <div className="mt-4 mb-4 flex items-center gap-2">
          {/* Action menu (left) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => setShowSchedulePopover(true)}>
                <Calendar className="h-4 w-4 mr-2" />
                Programmer une action
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSuggestNextAction} disabled={nextActionSuggesting}>
                {nextActionSuggesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                Suggestion IA
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Column selector (center) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" className="gap-1.5">
                {allColumns.find(c => c.id === columnId)?.name || "Colonne"}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {allColumns.map((col) => (
                <DropdownMenuItem
                  key={col.id}
                  onClick={() => handleColumnChange(col.id, col.name)}
                  disabled={updateCard.isPending || col.id === columnId}
                  className={cn(col.id === columnId && "font-semibold bg-accent")}
                >
                  {col.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Estimated value (editable) */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-sm font-medium transition-colors cursor-pointer hover:opacity-80 text-green-700 bg-green-50 border-green-200">
                {estimatedValue && parseFloat(estimatedValue) > 0
                  ? `${Number(parseFloat(estimatedValue) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`
                  : "0 €"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-3" align="start">
              <Label className="text-xs">Valeur estimée (€)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                className="h-8 mt-1"
                autoFocus
              />
            </PopoverContent>
          </Popover>

          {/* Confidence score (editable) */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn(
                "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer hover:opacity-80",
                confidenceScore !== null && confidenceScore >= 70 && "border-green-300 text-green-700 bg-green-50",
                confidenceScore !== null && confidenceScore >= 40 && confidenceScore < 70 && "border-orange-300 text-orange-700 bg-orange-50",
                (confidenceScore === null || confidenceScore < 40) && "border-red-300 text-red-700 bg-red-50",
              )}>
                {confidenceScore !== null ? `${confidenceScore}%` : "—%"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="start">
              <Label className="text-xs flex items-center justify-between">
                <span>Confiance</span>
                <span className="font-medium">{confidenceScore !== null ? `${confidenceScore}%` : "—"}</span>
              </Label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={confidenceScore ?? 50}
                  onChange={(e) => setConfidenceScore(parseInt(e.target.value))}
                  className="flex-1 h-2 accent-primary cursor-pointer"
                />
                {confidenceScore !== null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs text-muted-foreground"
                    onClick={() => setConfidenceScore(null)}
                    title="Réinitialiser"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Won / Lost icons */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1 text-green-600 hover:text-green-700 hover:bg-green-50",
              salesStatus === "WON" && "bg-green-100 text-green-700"
            )}
            onClick={() => handleSalesStatusChange("WON")}
            disabled={updateCard.isPending}
            title="Gagné"
          >
            <Trophy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1 text-red-600 hover:text-red-700 hover:bg-red-50",
              salesStatus === "LOST" && "bg-red-100 text-red-700"
            )}
            onClick={() => handleSalesStatusChange("LOST")}
            disabled={updateCard.isPending}
            title="Perdu"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>

        {/* Next scheduled action banner (always visible) */}
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
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-500 hover:text-blue-700" onClick={handleClearSchedule}>
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
                <Button variant="ghost" size="sm" onClick={handleClearSchedule}>
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
                  { label: "Demain", days: 1 },
                  { label: "J+3", days: 3 },
                  { label: "J+7", days: 7 },
                  { label: "J+14", days: 14 },
                ].map(({ label, days }) => {
                  const targetDate = format(addDays(new Date(), days), "yyyy-MM-dd");
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
              onClick={() => { handleScheduleAction(); setShowSchedulePopover(false); }}
              disabled={!scheduledDate || !scheduledText.trim() || updateCard.isPending}
              className="w-full"
            >
              {updateCard.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              Programmer
            </Button>
          </div>
        )}


        {/* ═══ TITLE & TYPE ═══ */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <EmojiPickerButton emoji={cardEmoji} onEmojiChange={setCardEmoji} size="md" />
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={serviceType || ""}
              onValueChange={(v) => setServiceType(v as "formation" | "mission" | null)}
            >
              <SelectTrigger className="h-7 w-auto text-xs gap-1">
                <SelectValue placeholder="Type de prestation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="formation">Formation</SelectItem>
                <SelectItem value="mission">Mission</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={acquisitionSource || ""}
              onValueChange={(v) => setAcquisitionSource(v as AcquisitionSource)}
            >
              <SelectTrigger className="h-7 w-auto text-xs gap-1">
                <SelectValue placeholder="Source d'acquisition" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(acquisitionSourceConfig) as [AcquisitionSource, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ═══ CONTACT ═══ */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-3 mt-4">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <User className="h-4 w-4" />
            Contact
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Prénom</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Prénom"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nom</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nom"
                className="h-8"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                Entreprise
              </Label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Nom de l'entreprise"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Email
              </Label>
              <div className="flex gap-1">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemple.com"
                  className="h-8 flex-1"
                />
                {email.trim() && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => copyToClipboard(email)}
                    title="Copier l'email"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Téléphone
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  className="h-8 flex-1"
                />
                {phone.trim() && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" title="QR Code téléphone">
                        <Phone className="h-3.5 w-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-4" align="end">
                      <div className="flex flex-col items-center gap-2">
                        <QRCodeSVG value={`tel:${phone.trim()}`} size={140} />
                        <span className="text-xs text-muted-foreground">Scannez pour appeler</span>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
            {linkedinUrl && (
              <div className="col-span-2">
                <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => window.open(linkedinUrl, '_blank', 'noopener')}>
                    <Linkedin className="h-3.5 w-3.5" />
                    LinkedIn
                    <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div className="space-y-1 col-span-2">
              <Label className="text-xs flex items-center gap-1">
                <Globe className="h-3 w-3" />
                Site web
              </Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://www.exemple.com"
                  className="h-8 flex-1"
                />
                {websiteUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ QUALIFICATION ═══ */}
        <div className="space-y-4 mt-6">
          <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
            Qualification
          </h4>

          {/* Brief questions */}
          {card.brief_questions && card.brief_questions.length > 0 && (
            <div className="p-4 bg-amber-50 rounded-lg space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Questions pour le brief
                <span className="text-xs text-muted-foreground font-normal">
                  ({card.brief_questions.filter((q: BriefQuestion) => q.answered).length}/{card.brief_questions.length})
                </span>
              </h4>
              <ul className="space-y-1.5">
                {card.brief_questions.map((q: BriefQuestion) => (
                  <li key={q.id} className="flex items-start gap-2.5 text-sm">
                    <Checkbox
                      id={`brief-${q.id}`}
                      checked={q.answered}
                      onCheckedChange={() => {
                        if (!user?.email) return;
                        const updatedQuestions = card.brief_questions.map((bq: BriefQuestion) =>
                          bq.id === q.id ? { ...bq, answered: !bq.answered } : bq
                        );
                        updateCard.mutate({
                          id: card.id,
                          updates: { brief_questions: updatedQuestions },
                          actorEmail: user.email,
                          oldCard: card,
                        });
                      }}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor={`brief-${q.id}`}
                      className={cn("cursor-pointer flex-1", q.answered && "text-muted-foreground line-through")}
                    >
                      {q.question}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Description / Notes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                Description / Notes
                {descriptionSaving && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Enregistrement...
                  </span>
                )}
                {descriptionSaved && !descriptionSaving && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Enregistré
                  </span>
                )}
              </Label>
            </div>
            <CrmDescriptionEditor
              content={descriptionHtml}
              onChange={handleDescriptionChange}
              cardId={card?.id}
            />
          </div>


          {/* Linked Mission */}
          {serviceType === "mission" && (
            <div className="p-4 bg-purple-50 rounded-lg space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Mission liée
              </h4>
              {linkedMissionId ? (
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <span className="text-sm">Mission #{linkedMissionId.slice(0, 8)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLinkedMissionId(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={missionSearchQuery}
                      onChange={(e) => {
                        setMissionSearchQuery(e.target.value);
                        setShowMissionSearch(true);
                      }}
                      placeholder="Rechercher une mission..."
                      className="h-8"
                    />
                    {searchingMissions && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                  {showMissionSearch && missionSearchResults && missionSearchResults.length > 0 && (
                    <div className="border rounded bg-white max-h-40 overflow-y-auto">
                      {missionSearchResults.map((mission) => (
                        <button
                          key={mission.id}
                          className="w-full text-left p-2 hover:bg-muted text-sm border-b last:border-b-0"
                          onClick={() => {
                            setLinkedMissionId(mission.id);
                            setMissionSearchQuery("");
                            setShowMissionSearch(false);
                          }}
                        >
                          <div className="font-medium">{mission.title}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            {mission.client_name && <span>{mission.client_name}</span>}
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px]"
                              style={{
                                backgroundColor: missionStatusConfig[mission.status].color + "20",
                                color: missionStatusConfig[mission.status].color,
                              }}
                            >
                              {missionStatusConfig[mission.status].label}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {showMissionSearch && missionSearchQuery.length >= 2 && missionSearchResults?.length === 0 && (
                    <p className="text-xs text-muted-foreground">Aucune mission trouvée</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ COMMERCIAL ═══ */}
        <div className="space-y-4 mt-6 border-t pt-4">
          <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
            Commercial
          </h4>

          {/* Devis buttons */}
          <div className="flex gap-2 flex-wrap">
            {serviceType === "formation" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams({
                    ...(company && { nomClient: company }),
                    ...(email && { emailCommanditaire: email }),
                    ...((firstName || lastName) && { adresseCommanditaire: [firstName, lastName].filter(Boolean).join(" ") }),
                    ...(card?.id && { crmCardId: card.id }),
                    source: "crm",
                  });
                  window.open(`/micro-devis?${params.toString()}`, "_blank");
                }}
              >
                <Receipt className="h-4 w-4 mr-2" />
                Créer un devis formation
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = prompt("URL du devis existant :", quoteUrl);
                if (url !== null) {
                  setQuoteUrl(url);
                }
              }}
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Lier à un devis existant
            </Button>
            {quoteUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={quoteUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Voir le devis
                </a>
              </Button>
            )}
          </div>

          {/* AI buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAiAnalysis}
              disabled={aiAnalyzing || !descriptionHtml.trim()}
            >
              {aiAnalyzing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              Analyser avec l'IA
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateQuoteDescription}
              disabled={quoteGenerating || !descriptionHtml.trim()}
            >
              {quoteGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileSignature className="h-4 w-4 mr-2" />
              )}
              Générer descriptif devis
            </Button>
          </div>

          {/* AI Analysis result */}
          {aiAnalysis && (
            <div className="p-4 bg-purple-50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm flex items-center gap-2 text-purple-700">
                  <Brain className="h-4 w-4" />
                  Analyse IA
                </h4>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(aiAnalysis)}
                    title="Copier"
                  >
                    <FileText className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAiAnalysis(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="text-sm whitespace-pre-wrap text-purple-900">
                {aiAnalysis}
              </div>
            </div>
          )}

          {/* Quote description result */}
          {quoteDescription && (
            <div className="p-4 bg-emerald-50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm flex items-center gap-2 text-emerald-700">
                  <FileSignature className="h-4 w-4" />
                  Descriptif pour devis
                </h4>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(quoteDescription)}
                    title="Copier"
                  >
                    <FileText className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuoteDescription(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="text-sm whitespace-pre-wrap text-emerald-900">
                {quoteDescription}
              </div>
            </div>
          )}
        </div>

        {/* ═══ COMMUNICATION ═══ */}
        <div className="space-y-4 mt-6 border-t pt-4">
          <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
            Communication
          </h4>

          {/* Email composer */}
          <div className="space-y-3">
            {/* Email templates */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Modèle</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1 flex-1">
                    <FileText className="h-3.5 w-3.5" />
                    Choisir un modèle
                    <ChevronDown className="h-3 w-3 ml-auto" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="p-2 border-b">
                    <p className="text-sm font-medium">Modèles d'email</p>
                    <p className="text-xs text-muted-foreground">Cliquez pour pré-remplir le message</p>
                  </div>
                  <div className="divide-y">
                    {crmEmailTemplates && crmEmailTemplates.length > 0 ? (
                      crmEmailTemplates.map((tpl) => {
                        const vars = {
                          company: company || undefined,
                          first_name: firstName || undefined,
                          last_name: lastName || undefined,
                          title: card?.title ? card.title.toLowerCase() : undefined,
                          email: email || undefined,
                        };
                        return (
                          <button
                            key={tpl.id}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors"
                            onClick={() => {
                              setEmailSubject(replaceCrmVariables(tpl.subject, vars));
                              setEmailBody(replaceCrmVariables(tpl.html_content, vars));
                              selectedTemplateRef.current = { id: tpl.id, subject: tpl.subject, html_content: tpl.html_content };
                            }}
                          >
                            <div className="font-medium text-sm">{tpl.template_name}</div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Aucun modèle configuré. Ajoutez-en dans Paramètres &gt; CRM.
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                Destinataire
                {email && email !== emailTo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEmailTo(email)}
                    title={`Utiliser ${email}`}
                    className="h-5 px-1.5 text-[10px] text-primary"
                  >
                    <Copy className="h-3 w-3 mr-0.5" />
                    Client
                  </Button>
                )}
              </Label>
              <Input
                placeholder="email@exemple.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Sujet"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="flex-1"
              />
              {emailSubjectBeforeAi ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUndoSubjectAi}
                  title="Annuler l'amélioration"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImproveEmailSubject}
                  disabled={!emailSubject.trim() || improvingSubject}
                  title="Améliorer avec l'IA"
                >
                  {improvingSubject ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <EmailEditor
                content={emailBody}
                onChange={(content) => setEmailBody(content)}
                placeholder="Corps du message..."
                variables={{
                  first_name: firstName || undefined,
                  last_name: lastName || undefined,
                  company: company || undefined,
                }}
                onGenderSelect={(gender) => {
                  if (card) {
                    supabase
                      .from("crm_cards")
                      .update({ gender })
                      .eq("id", card.id)
                      .then(() => queryClient.invalidateQueries({ queryKey: ["crm-cards"] }));
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                {emailBodyBeforeAi && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUndoBodyAi}
                    title="Annuler l'amélioration"
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    Annuler IA
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImproveEmailBody}
                  disabled={!emailBody.trim() || improvingBody}
                  title="Améliorer avec l'IA"
                >
                  {improvingBody ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-1" />
                  )}
                  Améliorer avec l'IA
                </Button>
              </div>
            </div>
            {/* Attachments */}
            <div className="space-y-2">
              <input
                ref={emailFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleEmailAttachFiles}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => emailFileInputRef.current?.click()}
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  Joindre un fichier
                </Button>
                {emailAttachments.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {emailAttachments.length} fichier{emailAttachments.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {emailAttachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {emailAttachments.map((att, i) => (
                    <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
                      <Paperclip className="h-3 w-3" />
                      {att.filename}
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(i)}
                        className="ml-0.5 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSendEmail}
                disabled={!emailTo.trim() || !emailSubject.trim() || sendEmail.isPending}
                className="flex-1"
              >
                {sendEmail.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Envoyer{emailAttachments.length > 0 ? ` (${emailAttachments.length} pièce${emailAttachments.length > 1 ? "s" : ""} jointe${emailAttachments.length > 1 ? "s" : ""})` : ""}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={!emailTo.trim() || !emailSubject.trim() || sendEmail.isPending}
                    className="px-2"
                  >
                    <Calendar className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {[
                    { label: "Demain 8h", hours: (() => { const d = addDays(new Date(), 1); d.setHours(8, 0, 0, 0); return d; })() },
                    { label: "Dans 3 jours ouvrés 8h", hours: (() => { let d = new Date(); let r = 3; while (r > 0) { d = addDays(d, 1); if (d.getDay() !== 0 && d.getDay() !== 6) r--; } d.setHours(8, 0, 0, 0); return d; })() },
                    { label: "Dans 5 jours ouvrés 8h", hours: (() => { let d = new Date(); let r = 5; while (r > 0) { d = addDays(d, 1); if (d.getDay() !== 0 && d.getDay() !== 6) r--; } d.setHours(8, 0, 0, 0); return d; })() },
                  ].map(({ label, hours }) => (
                    <DropdownMenuItem
                      key={label}
                      onClick={async () => {
                        if (!card || !user?.email || !emailTo.trim() || !emailSubject.trim()) return;
                        try {
                          await (supabase as any).from("crm_scheduled_emails").insert({
                            card_id: card.id,
                            recipient_email: emailTo.trim(),
                            subject: emailSubject.trim(),
                            body_html: DOMPurify.sanitize(emailBody),
                            scheduled_at: hours.toISOString(),
                            sender_email: user.email,
                            attachments: emailAttachments.length > 0 ? emailAttachments : null,
                          });
                          toast({ title: "Email programmé", description: `Envoi prévu le ${format(hours, "d MMM yyyy 'à' HH:mm", { locale: fr })}` });
                          setEmailTo(""); setEmailSubject(""); setEmailBody(""); setEmailAttachments([]);
                        } catch {
                          toast({ title: "Erreur", description: "Impossible de programmer l'email.", variant: "destructive" });
                        }
                      }}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      {label}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {format(hours, "d MMM HH:mm", { locale: fr })}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Unified email & devis history */}
          <SentDevisSection email={email || null} cardId={card?.id || null} emails={details?.emails} />
        </div>

        {/* ═══ COMPLÉMENTS ═══ */}
        <Tabs defaultValue="tags" className="mt-6 border-t pt-4">
          <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-3">
            Compléments
          </h4>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="tags">
              <Tag className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="comments">
              <MessageSquare className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="attachments">
              <Paperclip className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="media">
              <ImageIcon className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="activity">
              <History className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>

          {/* Tags Tab */}
          <TabsContent value="tags" className="space-y-4 mt-4">
            <div>
              <Label className="mb-2 block">Tags assignés</Label>
              <div className="flex flex-wrap gap-2">
                {cardTags.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucun tag</p>
                )}
                {cardTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    style={{ backgroundColor: tag.color + "20", color: tag.color }}
                    className="cursor-pointer"
                    onClick={() => handleToggleTag(tag.id)}
                  >
                    {tag.name}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Ajouter un tag</Label>
              {Object.entries(tagsByCategory).map(([category, tags]) => (
                <div key={category} className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1">{category}</p>
                  <div className="flex flex-wrap gap-2">
                    {tags
                      .filter((t) => !cardTags.some((ct) => ct.id === t.id))
                      .map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          style={{ borderColor: tag.color, color: tag.color }}
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleToggleTag(tag.id)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {tag.name}
                        </Badge>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Comments Tab */}
          <TabsContent value="comments" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Ajouter un commentaire..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
              />
              <Button
                onClick={handleAddComment}
                disabled={!newComment.trim() || addComment.isPending}
              >
                {addComment.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="space-y-3">
              {detailsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {details?.comments.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun commentaire</p>
              )}
              {details?.comments.map((comment) => (
                <div key={comment.id} className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{comment.author_email}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(comment.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => deleteComment.mutate(comment.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="mt-2 text-sm">{comment.content}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Attachments Tab */}
          <TabsContent value="attachments" className="space-y-4 mt-4">
            <div>
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("file-upload")?.click()}
                disabled={addAttachment.isPending}
              >
                {addAttachment.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Ajouter un fichier
              </Button>
            </div>

            <div className="space-y-2">
              {detailsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {details?.attachments.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune pièce jointe</p>
              )}
              {details?.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-2 bg-muted rounded"
                >
                  <button
                    className="flex items-center gap-2 hover:text-primary transition-colors text-left min-w-0"
                    onClick={async () => {
                      try {
                        const { data } = await supabase.storage
                          .from("crm-attachments")
                          .createSignedUrl(att.file_path, 3600);
                        if (data?.signedUrl) {
                          window.open(data.signedUrl, "_blank", "noopener");
                        }
                      } catch (e) {
                        console.error("Error opening attachment:", e);
                      }
                    }}
                  >
                    <Paperclip className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate underline">{att.file_name}</span>
                    {att.file_size && (
                      <span className="text-xs text-muted-foreground">
                        ({Math.round(att.file_size / 1024)} KB)
                      </span>
                    )}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() =>
                      deleteAttachment.mutate({
                        id: att.id,
                        cardId: card.id,
                        fileName: att.file_name,
                        filePath: att.file_path,
                        actorEmail: user?.email || "",
                      })
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Media Tab */}
          <TabsContent value="media" className="mt-4">
            <EntityMediaManager
              sourceType="crm"
              sourceId={card.id}
              sourceLabel={card.title}
              variant="bare"
            />
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-2 mt-4">
            {detailsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {details?.activity.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune activité</p>
            )}
            {details?.activity.map((log) => (
              <div key={log.id} className="p-2 border-l-2 border-muted pl-4">
                <p className="text-sm">
                  <span className="font-medium">{formatActivityType(log.action_type)}</span>
                  {log.old_value && log.new_value && (
                    <span className="text-muted-foreground">
                      {" "}
                      : {log.old_value} → {log.new_value}
                    </span>
                  )}
                  {!log.old_value && log.new_value && (
                    <span className="text-muted-foreground"> : {log.new_value}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {log.actor_email} •{" "}
                  {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                </p>
              </div>
            ))}
          </TabsContent>
        </Tabs>

        {/* Delete section - at the bottom */}
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
              {deleteCard.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Supprimer cette opportunité
            </Button>
          </div>
        </div>
        </div>
    </DetailDrawer>

    {/* Loss Reason Dialog */}
    <LossReasonDialog
      open={showLossReasonDialog}
      onConfirm={handleLossReasonConfirm}
      onCancel={handleLossReasonCancel}
    />

    {/* Create Training Dialog - MUST be outside Sheet to display correctly */}
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

    {/* Win choice dialog - choose formation or mission */}
    <AlertDialog open={showWinChoiceDialog} onOpenChange={setShowWinChoiceDialog}>
      <AlertDialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-green-100 text-green-600">
              <Trophy className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Opportunité gagnée !</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left">
            L'opportunité <strong>"{title}"</strong> a été marquée comme gagnée.
            <br /><br />
            Que souhaitez-vous créer à partir de cette opportunité ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <Button
            variant="outline"
            className="h-auto flex flex-col items-center gap-2 p-4 hover:border-primary hover:bg-primary/5"
            onClick={() => {
              setShowWinChoiceDialog(false);
              setShowCreateTrainingDialog(true);
            }}
          >
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="font-medium">Créer une formation</span>
            <span className="text-xs text-muted-foreground text-center">Préremplir avec les infos de l'opportunité</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto flex flex-col items-center gap-2 p-4 hover:border-purple-500 hover:bg-purple-50"
            onClick={handleConfirmCreateMission}
          >
            <Rocket className="h-8 w-8 text-purple-600" />
            <span className="font-medium">Créer une mission</span>
            <span className="text-xs text-muted-foreground text-center">Préremplir avec les infos de l'opportunité</span>
          </Button>
        </div>

        {/* Attach to existing inter-entreprise training */}
        <div className="border-t pt-3">
          <button
            className="w-full flex items-center justify-between text-sm font-medium text-left px-1 py-1 hover:text-primary transition-colors"
            onClick={() => setShowAttachTraining(!showAttachTraining)}
          >
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Attacher à une formation inter-entreprise existante
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showAttachTraining && "rotate-180")} />
          </button>

          {showAttachTraining && (
            <div className="mt-2 space-y-2">
              {interTrainingsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : interTrainings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">
                  Aucune formation inter-entreprise à venir
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-1">
                  {interTrainings.map((training) => (
                    <button
                      key={training.id}
                      onClick={() => handleAttachToTraining(training.id)}
                      className="w-full text-left px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors flex items-start gap-3"
                    >
                      <GraduationCap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{training.training_name}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(parseISO(training.start_date), "d MMM yyyy", { locale: fr })}
                          </span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            Inter-entreprises
                          </Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Non, plus tard</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

function formatActivityType(type: string): string {
  const labels: Record<string, string> = {
    card_created: "Carte créée",
    card_moved: "Carte déplacée",
    status_operational_changed: "Statut opérationnel modifié",
    sales_status_changed: "Statut commercial modifié",
    estimated_value_changed: "Valeur modifiée",
    tag_added: "Tag ajouté",
    tag_removed: "Tag retiré",
    comment_added: "Commentaire ajouté",
    attachment_added: "Pièce jointe ajoutée",
    attachment_removed: "Pièce jointe supprimée",
    email_sent: "Email envoyé",
    action_scheduled: "Action programmée",
  };
  return labels[type] || type;
}

export default CardDetailDrawer;
