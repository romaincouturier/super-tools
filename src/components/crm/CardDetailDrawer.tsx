import { useState, useEffect, useCallback, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, useNavigate } from "react-router-dom";
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
  Sparkles,
  AlertTriangle,
  Maximize2,
  Minimize2,
  Brain,
  FileSignature,
  Check,
} from "lucide-react";
import { format, addDays, isAfter, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import DOMPurify from "dompurify";
import {
  CrmCard,
  CrmTag,
  CrmColumn,
  SalesStatus,
  BriefQuestion,
} from "@/types/crm";
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
  const [serviceType, setServiceType] = useState<"formation" | "mission" | null>(null);

  // Scheduled action state
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledText, setScheduledText] = useState("");

  // Comment state
  const [newComment, setNewComment] = useState("");

  // Email state
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

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

  // Get tomorrow's date as minimum for scheduling
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  // Initialize form when card changes
  useEffect(() => {
    if (card) {
      setTitle(card.title);
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
      setServiceType(card.service_type || null);
      // Reset AI state
      setAiAnalysis(null);
      setQuoteDescription(null);
      setDescriptionSaved(false);
    }
  }, [card]);

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (descriptionTimeoutRef.current) {
        clearTimeout(descriptionTimeoutRef.current);
      }
    };
  }, []);

  // AI Analysis function
  const handleAiAnalysis = async () => {
    if (!card) return;

    setAiAnalyzing(true);
    setAiAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
        body: {
          action: "analyze_exchanges",
          card_data: {
            title: card.title,
            description: descriptionHtml,
            company,
            first_name: firstName,
            last_name: lastName,
            service_type: serviceType,
            estimated_value: parseFloat(estimatedValue) || 0,
            comments: details?.comments || [],
            brief_questions: card.brief_questions || [],
          },
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
          card_data: {
            title: card.title,
            description: descriptionHtml,
            company,
            first_name: firstName,
            last_name: lastName,
            service_type: serviceType,
            estimated_value: parseFloat(estimatedValue) || 0,
            comments: details?.comments || [],
            brief_questions: card.brief_questions || [],
          },
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

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  // Generate LinkedIn search URL from name
  const generateLinkedInSearchUrl = () => {
    if (!firstName && !lastName) return "";
    const name = [firstName, lastName?.toUpperCase()].filter(Boolean).join(" ");
    return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(name)}`;
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
        estimated_value: parseFloat(estimatedValue) || 0,
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
        service_type: serviceType,
      },
      actorEmail: user.email,
      oldCard: card,
    });

    // If opportunity is WON and is a formation, ask to create training
    if (statusChangedToWon && serviceType === "formation") {
      const shouldCreateTraining = confirm(
        "Opportunité marquée comme gagnée !\n\nVoulez-vous créer une formation à partir de cette opportunité ?"
      );
      if (shouldCreateTraining) {
        const params = new URLSearchParams();
        if (company) params.set("clientName", company);
        if (firstName) params.set("sponsorFirstName", firstName);
        if (lastName) params.set("sponsorLastName", lastName);
        if (email) params.set("sponsorEmail", email);
        if (title) params.set("trainingName", title.replace(/^\([^)]+\)\s*/, ""));
        params.set("fromCrmCardId", card.id);

        onOpenChange(false);
        navigate(`/formations/create?${params.toString()}`);
      }
    }
  };

  const handleSalesStatusChange = async (newStatus: SalesStatus) => {
    if (!card || !user?.email) return;
    setSalesStatus(newStatus);

    // Save immediately when status changes
    const statusChangedToWon = newStatus === "WON" && card.sales_status !== "WON";

    await updateCard.mutateAsync({
      id: card.id,
      updates: { sales_status: newStatus },
      actorEmail: user.email,
      oldCard: card,
    });

    if (statusChangedToWon && serviceType === "formation") {
      const shouldCreateTraining = confirm(
        "Opportunité marquée comme gagnée !\n\nVoulez-vous créer une formation à partir de cette opportunité ?"
      );
      if (shouldCreateTraining) {
        const params = new URLSearchParams();
        if (company) params.set("clientName", company);
        if (firstName) params.set("sponsorFirstName", firstName);
        if (lastName) params.set("sponsorLastName", lastName);
        if (email) params.set("sponsorEmail", email);
        if (title) params.set("trainingName", title.replace(/^\([^)]+\)\s*/, ""));
        params.set("fromCrmCardId", card.id);

        onOpenChange(false);
        navigate(`/formations/create?${params.toString()}`);
      }
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

  const handleSendEmail = async () => {
    if (!card || !user?.email || !emailTo.trim() || !emailSubject.trim()) return;
    await sendEmail.mutateAsync({
      input: {
        card_id: card.id,
        recipient_email: emailTo.trim(),
        subject: emailSubject.trim(),
        body_html: DOMPurify.sanitize(emailBody),
      },
      senderEmail: user.email,
    });
    setEmailTo("");
    setEmailSubject("");
    setEmailBody("");
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={`overflow-y-auto transition-all duration-300 ${
          isFullScreen
            ? "w-full sm:max-w-full"
            : "w-full sm:max-w-xl"
        }`}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-2">
            <span className="truncate flex-1">{card.title}</span>
            <div className="flex items-center gap-1">
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
              <Button size="sm" onClick={handleSave} disabled={updateCard.isPending}>
                {updateCard.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Sales Status Buttons - Always visible at top */}
        <div className="mt-4 mb-4">
          <Label className="mb-2 block text-sm">Statut commercial</Label>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(salesStatusConfig) as SalesStatus[]).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={salesStatus === status ? "default" : "outline"}
                className={salesStatus === status ? salesStatusConfig[status].color + " text-white" : ""}
                onClick={() => handleSalesStatusChange(status)}
                disabled={updateCard.isPending}
              >
                {salesStatusConfig[status].label}
              </Button>
            ))}
          </div>
        </div>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="details">
              <FileText className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="tags">
              <Tag className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="comments">
              <MessageSquare className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="attachments">
              <Paperclip className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="activity">
              <History className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4 mt-4">
            {/* Contact info section - Editable */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
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
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemple.com"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Téléphone
                  </Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="06 12 34 56 78"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs flex items-center gap-1">
                    <Linkedin className="h-3 w-3" />
                    LinkedIn
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="URL du profil LinkedIn"
                      className="h-8 flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const url = generateLinkedInSearchUrl();
                        if (url) {
                          setLinkedinUrl(url);
                        }
                      }}
                      disabled={!firstName && !lastName}
                      title="Générer un lien de recherche LinkedIn"
                    >
                      <Sparkles className="h-3 w-3" />
                    </Button>
                    {linkedinUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Type de prestation</Label>
                  <Select
                    value={serviceType || ""}
                    onValueChange={(v) => setServiceType(v as "formation" | "mission" | null)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Non défini" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formation">Formation</SelectItem>
                      <SelectItem value="mission">Mission</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Brief questions */}
            {card.brief_questions && card.brief_questions.length > 0 && (
              <div className="p-4 bg-amber-50 rounded-lg space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Questions pour le brief
                </h4>
                <ul className="space-y-1.5">
                  {card.brief_questions.map((q: BriefQuestion) => (
                    <li key={q.id} className="flex items-start gap-2 text-sm">
                      {q.answered ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      )}
                      <span className={q.answered ? "text-muted-foreground line-through" : ""}>
                        {q.question}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quote buttons */}
            <div className="flex gap-2 flex-wrap">
              {serviceType === "formation" && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/micro-devis">
                    <Receipt className="h-4 w-4 mr-2" />
                    Créer un devis formation
                  </Link>
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

            {/* Schedule action */}
            <div className="p-4 bg-blue-50 rounded-lg space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Programmer une action
              </h4>
              {card.waiting_next_action_date && (
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Date (à partir de demain)</Label>
                  <Input
                    type="date"
                    min={tomorrow}
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Action</Label>
                  <Input
                    value={scheduledText}
                    onChange={(e) => setScheduledText(e.target.value)}
                    placeholder="Relancer le client"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleScheduleAction}
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

            <div>
              <Label>Titre</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div>
              <Label>Colonne</Label>
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allColumns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description with auto-save and AI */}
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
              <Textarea
                value={descriptionHtml}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                rows={6}
                placeholder="Notez ici tous les échanges, informations et détails importants de l'opportunité..."
                className="font-mono text-sm"
              />

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

            <div>
              <Label>Valeur estimée (€)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
              />
            </div>

            {/* Email section */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Envoyer un email (mock)
              </h4>
              <div className="space-y-3">
                <Input
                  placeholder="Destinataire (email)"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                />
                <Input
                  placeholder="Sujet"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
                <Textarea
                  placeholder="Corps du message..."
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={handleSendEmail}
                  disabled={!emailTo.trim() || !emailSubject.trim() || sendEmail.isPending}
                  className="w-full"
                >
                  {sendEmail.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Envoyer (mock)
                </Button>
              </div>
            </div>
          </TabsContent>

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
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    <span className="text-sm truncate">{att.file_name}</span>
                    {att.file_size && (
                      <span className="text-xs text-muted-foreground">
                        ({Math.round(att.file_size / 1024)} KB)
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
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

            {/* Emails sent */}
            {details?.emails && details.emails.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Emails envoyés
                </h4>
                {details.emails.map((email) => (
                  <div key={email.id} className="p-2 bg-muted rounded mb-2">
                    <p className="text-sm font-medium">{email.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      À: {email.recipient_email} •{" "}
                      {format(new Date(email.sent_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </p>
                  </div>
                ))}
              </div>
            )}
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
      </SheetContent>
    </Sheet>
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
