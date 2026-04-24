import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, User, Building2, Phone, Mail, Linkedin, FileText, Euro, TrendingUp, ChevronDown, MessageSquare, History, CheckCircle, XCircle, Clock, Calendar, Tag } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useExtractOpportunity, useCreateCard, useCrmBoard, useAssignTag } from "@/hooks/useCrmBoard";
import { OpportunityExtraction, BriefQuestion, AcquisitionSource, acquisitionSourceConfig } from "@/types/crm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import NextActionScheduler from "@/components/shared/NextActionScheduler";

const CRM_ACTION_PRESETS = [
  "Relancer le client",
  "Envoyer un devis",
  "Retour après consultation",
  "Appeler",
  "RDV physique",
  "RDV visio",
];

export interface NewOpportunityInitialContact {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
}

interface ClientHistoryItem {
  id: string;
  title: string;
  service_type: string | null;
  sales_status: string;
  estimated_value: number | null;
  won_at: string | null;
  lost_at: string | null;
  loss_reason: string | null;
  created_at: string;
}

interface NewOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
  /**
   * When provided, the AI extraction step is skipped and the dialog opens
   * directly on the review step with these contact fields pre-filled.
   */
  initialContact?: NewOpportunityInitialContact;
  /**
   * When provided, force this acquisition source and lock the dropdown
   * (used for "new opportunity from existing contact" → "nouvelle_mission").
   */
  forceAcquisitionSource?: AcquisitionSource;
}

export function NewOpportunityDialog({ open, onOpenChange, userEmail, initialContact, forceAcquisitionSource }: NewOpportunityDialogProps) {
  const [step, setStep] = useState<"input" | "review">("input");
  const [rawInput, setRawInput] = useState("");
  const [rawInputOpen, setRawInputOpen] = useState(false);
  const [_extraction, setExtraction] = useState<OpportunityExtraction | null>(null);
  const [editedExtraction, setEditedExtraction] = useState<OpportunityExtraction | null>(null);
  const [estimatedValue, setEstimatedValue] = useState("");
  const [valueEstimation, setValueEstimation] = useState<{ value: number; source: string; count: number } | null>(null);
  const [acquisitionSource, setAcquisitionSource] = useState<AcquisitionSource | null>(null);
  const [clientHistory, setClientHistory] = useState<ClientHistoryItem[]>([]);
  const [clientHistoryOpen, setClientHistoryOpen] = useState(true);
  const [nextActionDate, setNextActionDate] = useState("");
  const [nextActionText, setNextActionText] = useState("");
  const [nextActionFormOpen, setNextActionFormOpen] = useState(false);
  const [nextActionSuggested, setNextActionSuggested] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagsAutoSuggested, setTagsAutoSuggested] = useState(false);

  const { data: boardData } = useCrmBoard();
  const extractMutation = useExtractOpportunity();
  const createCardMutation = useCreateCard();
  const assignTagMutation = useAssignTag();
  const availableTags = boardData?.tags || [];

  // Find "Entrant" column (first column for new opportunities)
  const entrantColumn = boardData?.columns.find((col) => col.name === "Entrant") || boardData?.columns[0];

  // When opened with an initialContact, skip extraction and prefill the review step.
  useEffect(() => {
    if (!open || !initialContact) return;
    const seeded: OpportunityExtraction = {
      first_name: initialContact.first_name ?? null,
      last_name: initialContact.last_name ?? null,
      phone: initialContact.phone ?? null,
      company: initialContact.company ?? null,
      email: initialContact.email ?? null,
      linkedin_url: initialContact.linkedin_url ?? null,
      service_type: null,
      title: "",
      brief_questions: [],
      suggested_tag_ids: [],
      suggested_next_action: null,
    };
    setExtraction(seeded);
    setEditedExtraction(seeded);
    setStep("review");
    if (forceAcquisitionSource) setAcquisitionSource(forceAcquisitionSource);
    estimateValueFromHistory(seeded);
    fetchClientHistory(seeded.email, seeded.company);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialContact, forceAcquisitionSource]);

  // Estimate value from CRM history
  const estimateValueFromHistory = async (extraction: OpportunityExtraction) => {
    try {
      const { data } = await supabase
        .from("crm_cards")
        .select("estimated_value, service_type, company")
        .eq("sales_status", "WON")
        .gt("estimated_value", 0);

      if (!data || data.length === 0) return;

      // Priority 1: same company + same service_type
      let matches = data.filter(
        (c) =>
          extraction.company &&
          c.company?.toLowerCase() === extraction.company.toLowerCase() &&
          extraction.service_type &&
          c.service_type === extraction.service_type
      );
      let source = "même entreprise & type";

      // Priority 2: same company only
      if (matches.length === 0 && extraction.company) {
        matches = data.filter(
          (c) => c.company?.toLowerCase() === extraction.company?.toLowerCase()
        );
        source = "même entreprise";
      }

      // Priority 3: same service_type
      if (matches.length === 0 && extraction.service_type) {
        matches = data.filter((c) => c.service_type === extraction.service_type);
        source = extraction.service_type === "formation" ? "formations gagnées" : "missions gagnées";
      }

      // Priority 4: all won deals
      if (matches.length === 0) {
        matches = data;
        source = "toutes les opportunités gagnées";
      }

      const avg = matches.reduce((sum, c) => sum + (c.estimated_value || 0), 0) / matches.length;
      const rounded = Math.round(avg / 100) * 100;

      if (rounded > 0) {
        setValueEstimation({ value: rounded, source, count: matches.length });
        setEstimatedValue(String(rounded));
      }
    } catch {
      // Silently fail - estimation is optional
    }
  };

  const fetchClientHistory = async (email: string | null, company: string | null) => {
    if (!email && !company) { setClientHistory([]); return; }
    try {
      let query = supabase
        .from("crm_cards")
        .select("id, title, service_type, sales_status, estimated_value, won_at, lost_at, loss_reason, created_at")
        .order("created_at", { ascending: false });

      if (email) {
        query = query.eq("email", email);
      } else if (company) {
        query = query.eq("company", company);
      }

      const { data } = await query;
      setClientHistory((data as ClientHistoryItem[]) || []);
    } catch {
      setClientHistory([]);
    }
  };

  const handleExtract = async () => {
    if (!rawInput.trim()) return;

    try {
      const result = await extractMutation.mutateAsync({
        rawInput,
        availableTags: availableTags.map((t) => ({ id: t.id, name: t.name, category: t.category })),
      });
      setExtraction(result);
      setEditedExtraction(result);
      setStep("review");
      // Auto-estimate value from CRM history
      estimateValueFromHistory(result);
      // Auto-detect acquisition source
      const detectedSource = await detectAcquisitionSource(rawInput, result.email);
      if (detectedSource) setAcquisitionSource(detectedSource);
      // Fetch client history
      fetchClientHistory(result.email, result.company);
      // Pre-fill suggested tags
      if (result.suggested_tag_ids?.length) {
        setSelectedTagIds(result.suggested_tag_ids);
        setTagsAutoSuggested(true);
      }
      // Pre-fill suggested next action
      if (result.suggested_next_action) {
        setNextActionDate(result.suggested_next_action.date);
        setNextActionText(result.suggested_next_action.text);
        setNextActionSuggested(true);
        setNextActionFormOpen(false);
      }
    } catch {
      // Error handled by mutation
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  // Detect acquisition source from raw input and contact history
  const detectAcquisitionSource = async (raw: string, contactEmail: string | null): Promise<AcquisitionSource | undefined> => {
    // Check for website form metadata (User Agent, IP, "Propulsé par", URL patterns)
    const techPatterns = [
      /agent utilisateur:/i,
      /user.?agent:/i,
      /ip distante:/i,
      /remote.?ip:/i,
      /propulsé par/i,
      /powered by/i,
      /elementor/i,
      /wordpress/i,
      /url de la page:/i,
    ];
    const hasWebFormMetadata = techPatterns.some((p) => p.test(raw));

    // Check if contact email already exists in CRM
    if (contactEmail) {
      const { data: existingCards } = await supabase
        .from("crm_cards")
        .select("id")
        .eq("email", contactEmail)
        .limit(1);

      if (existingCards && existingCards.length > 0) {
        return "nouvelle_mission";
      }
    }

    if (hasWebFormMetadata) {
      return "site_web";
    }

    return undefined;
  };

  const handleCreate = async () => {
    if (!editedExtraction || !entrantColumn) return;

    try {
      const created = await createCardMutation.mutateAsync({
        input: {
          column_id: entrantColumn.id,
          title: editedExtraction.title,
          first_name: editedExtraction.first_name || undefined,
          last_name: editedExtraction.last_name || undefined,
          phone: editedExtraction.phone || undefined,
          company: editedExtraction.company || undefined,
          email: editedExtraction.email || undefined,
          linkedin_url: editedExtraction.linkedin_url || undefined,
          service_type: editedExtraction.service_type || undefined,
          estimated_value: parseFloat(estimatedValue) || 0,
          brief_questions: editedExtraction.brief_questions,
          raw_input: rawInput,
          acquisition_source: acquisitionSource || undefined,
          ...(nextActionDate && {
            status_operational: "WAITING" as const,
            waiting_next_action_date: nextActionDate,
            waiting_next_action_text: nextActionText || undefined,
          }),
          description_html: rawInput
            .replace(/\r\n/g, "\n")
            .replace(/[\u2028\u2029]/g, "\n")
            .replace(/\n[ \t]*\n/g, "\n\n")
            .replace(/\n{3,}/g, "\n\n")
            .split("\n\n")
            .map((paragraph) => {
              const lines = paragraph.split("\n").map((line) =>
                line
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
              );
              return `<p>${lines.join("<br>") || "<br>"}</p>`;
            })
            .join(""),
        },
        actorEmail: userEmail,
      });

      // Persist selected tags
      if (created?.id && selectedTagIds.length > 0) {
        await Promise.all(
          selectedTagIds.map((tagId) =>
            assignTagMutation.mutateAsync({ cardId: created.id, tagId, actorEmail: userEmail }),
          ),
        );
      }

      resetState();
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const resetState = () => {
    setStep("input");
    setRawInput("");
    setRawInputOpen(false);
    setExtraction(null);
    setEditedExtraction(null);
    setEstimatedValue("");
    setValueEstimation(null);
    setAcquisitionSource(null);
    setClientHistory([]);
    setClientHistoryOpen(true);
    setNextActionDate("");
    setNextActionText("");
    setNextActionFormOpen(false);
    setNextActionSuggested(false);
    setSelectedTagIds([]);
    setTagsAutoSuggested(false);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const updateField = (field: keyof OpportunityExtraction, value: string | null) => {
    if (!editedExtraction) return;
    setEditedExtraction({ ...editedExtraction, [field]: value });
  };

  const updateQuestion = (id: string, question: string) => {
    if (!editedExtraction) return;
    const updatedQuestions = editedExtraction.brief_questions.map((q) =>
      q.id === id ? { ...q, question } : q
    );
    setEditedExtraction({ ...editedExtraction, brief_questions: updatedQuestions });
  };

  const removeQuestion = (id: string) => {
    if (!editedExtraction) return;
    const updatedQuestions = editedExtraction.brief_questions.filter((q) => q.id !== id);
    setEditedExtraction({ ...editedExtraction, brief_questions: updatedQuestions });
  };

  const addQuestion = () => {
    if (!editedExtraction) return;
    const newQuestion: BriefQuestion = {
      id: crypto.randomUUID(),
      question: "",
      answered: false,
    };
    setEditedExtraction({
      ...editedExtraction,
      brief_questions: [...editedExtraction.brief_questions, newQuestion],
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Nouvelle opportunité
          </DialogTitle>
          <DialogDescription>
            {step === "input"
              ? "Collez les informations du prospect (email, message, notes...) et l'IA extraira les données."
              : initialContact
                ? "Renseignez le sujet de la nouvelle opportunité pour ce contact existant."
                : "Vérifiez et ajustez les informations extraites avant de créer l'opportunité."}
          </DialogDescription>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="raw-input">Informations du prospect</Label>
              <VoiceTextarea
                id="raw-input"
                placeholder="Collez ici l'email, le message ou les notes concernant le prospect...

Exemple:
Bonjour, je suis Jean Dupont de la société Acme.
Nous recherchons une formation en management pour 10 personnes.
Mon email: jean.dupont@acme.fr
Tel: 06 12 34 56 78"
                className="mt-2 min-h-[200px]"
                value={rawInput}
                onValueChange={setRawInput}
                onChange={(e) => setRawInput(e.target.value)}
              />
            </div>
          </div>
        ) : editedExtraction ? (
          <div className="space-y-6">
            {/* Raw input (collapsible) */}
            <Collapsible open={rawInputOpen} onOpenChange={setRawInputOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Message initial
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${rawInputOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground bg-muted/50 rounded-md p-3 max-h-[200px] overflow-y-auto border">
                  {rawInput}
                </pre>
              </CollapsibleContent>
            </Collapsible>

            {/* Client history */}
            {clientHistory.length > 0 && (
              <Collapsible open={clientHistoryOpen} onOpenChange={setClientHistoryOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50">
                    <span className="flex items-center gap-2">
                      <History className="h-3.5 w-3.5" />
                      Client connu — {clientHistory.length} opportunité{clientHistory.length > 1 ? "s" : ""} existante{clientHistory.length > 1 ? "s" : ""}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${clientHistoryOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-1.5">
                    {clientHistory.map((card) => {
                      const isWon = card.sales_status === "WON";
                      const isLost = card.sales_status === "LOST";
                      const StatusIcon = isWon ? CheckCircle : isLost ? XCircle : Clock;
                      const statusColor = isWon ? "text-green-600" : isLost ? "text-red-500" : "text-amber-500";
                      const statusLabel = isWon ? "Gagné" : isLost ? "Perdu" : "En cours";
                      const date = card.won_at || card.lost_at || card.created_at;
                      return (
                        <div key={card.id} className="flex items-center gap-2 text-xs rounded-md border px-3 py-2 bg-muted/30">
                          <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${statusColor}`} />
                          <span className="font-medium truncate flex-1">{card.title}</span>
                          {card.service_type && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">
                              {card.service_type === "formation" ? "Formation" : "Mission"}
                            </Badge>
                          )}
                          {card.estimated_value ? (
                            <span className="text-muted-foreground whitespace-nowrap">
                              {card.estimated_value.toLocaleString("fr-FR")} €
                            </span>
                          ) : null}
                          <span className={`whitespace-nowrap ${statusColor}`}>{statusLabel}</span>
                          <span className="text-muted-foreground/60 whitespace-nowrap">
                            {new Date(date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                          </span>
                        </div>
                      );
                    })}
                    {(() => {
                      const wonCards = clientHistory.filter(c => c.sales_status === "WON");
                      const totalWon = wonCards.reduce((s, c) => s + (c.estimated_value || 0), 0);
                      if (wonCards.length === 0) return null;
                      return (
                        <p className="text-xs text-muted-foreground pt-1 pl-1">
                          Total gagné : <span className="font-medium text-green-600">{totalWon.toLocaleString("fr-FR")} €</span> sur {wonCards.length} opportunité{wonCards.length > 1 ? "s" : ""}
                        </p>
                      );
                    })()}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Title */}
            <div>
              <Label htmlFor="title">Titre de l'opportunité</Label>
              <Input
                id="title"
                value={editedExtraction.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="mt-2"
              />
            </div>

            {/* Service type badge */}
            <div>
              <Label className="flex items-center gap-1">
                Type <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2 mt-1">
                <Badge
                  variant={editedExtraction.service_type === "formation" ? "default" : "outline"}
                  className={`cursor-pointer ${!editedExtraction.service_type ? "ring-1 ring-destructive/30" : ""}`}
                  onClick={() => updateField("service_type", "formation")}
                >
                  Formation
                </Badge>
                <Badge
                  variant={editedExtraction.service_type === "mission" ? "default" : "outline"}
                  className={`cursor-pointer ${!editedExtraction.service_type ? "ring-1 ring-destructive/30" : ""}`}
                  onClick={() => updateField("service_type", "mission")}
                >
                  Mission
                </Badge>
              </div>
            </div>

            {/* Acquisition source */}
            <div>
              <Label className="flex items-center gap-1">
                Source d'acquisition <span className="text-destructive">*</span>
              </Label>
              <Select
                value={acquisitionSource || ""}
                onValueChange={(v) => setAcquisitionSource(v as AcquisitionSource)}
                disabled={!!forceAcquisitionSource}
              >
                <SelectTrigger className={`mt-1 ${!acquisitionSource ? "ring-1 ring-destructive/30" : ""}`}>
                  <SelectValue placeholder="Sélectionner une source..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(acquisitionSourceConfig).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {forceAcquisitionSource && (
                <p className="text-xs text-muted-foreground mt-1">
                  Source verrouillée — opportunité créée à partir d'un contact existant.
                </p>
              )}
            </div>

            {/* Contact info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Prénom
                </Label>
                <Input
                  value={editedExtraction.first_name || ""}
                  onChange={(e) => updateField("first_name", e.target.value || null)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Nom
                </Label>
                <Input
                  value={editedExtraction.last_name || ""}
                  onChange={(e) => updateField("last_name", e.target.value || null)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Entreprise
                </Label>
                <Input
                  value={editedExtraction.company || ""}
                  onChange={(e) => updateField("company", e.target.value || null)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Téléphone
                </Label>
                <Input
                  value={editedExtraction.phone || ""}
                  onChange={(e) => updateField("phone", e.target.value || null)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  Email
                </Label>
                <Input
                  value={editedExtraction.email || ""}
                  onChange={(e) => updateField("email", e.target.value || null)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <Linkedin className="h-3 w-3" />
                  LinkedIn
                </Label>
                <Input
                  value={editedExtraction.linkedin_url || ""}
                  onChange={(e) => updateField("linkedin_url", e.target.value || null)}
                  placeholder="https://linkedin.com/in/..."
                  className="mt-1"
                />
              </div>
            </div>

            {/* Estimated value */}
            <div>
              <Label className="flex items-center gap-1">
                <Euro className="h-3 w-3" />
                Valeur estimée (€)
              </Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={estimatedValue}
                onChange={(e) => {
                  setEstimatedValue(e.target.value);
                  if (valueEstimation) setValueEstimation(null);
                }}
                placeholder="Ex: 2500"
                className="mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {valueEstimation && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  Estimation basée sur {valueEstimation.count} {valueEstimation.source} (moyenne : {valueEstimation.value.toLocaleString("fr-FR")} €)
                </p>
              )}
            </div>

            {/* Tags */}
            {availableTags.length > 0 && (
              <div>
                <Label className="flex items-center gap-1.5 mb-2">
                  <Tag className="h-3 w-3" />
                  Tags
                  {tagsAutoSuggested && selectedTagIds.length > 0 && (
                    <span className="text-[10px] font-normal text-primary inline-flex items-center gap-0.5">
                      <Sparkles className="h-2.5 w-2.5" /> suggérés par l'IA
                    </span>
                  )}
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {availableTags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        type="button"
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                          selected ? "border-transparent" : "border-border hover:border-foreground/30"
                        }`}
                        style={
                          selected
                            ? { backgroundColor: tag.color + "30", color: tag.color }
                            : { color: "hsl(var(--muted-foreground))" }
                        }
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Schedule next action — uses the same component as the existing-opportunity drawer */}
            <div>
              <Label className="flex items-center gap-1.5 mb-2">
                <Calendar className="h-3.5 w-3.5" />
                Prochaine action
                {nextActionSuggested && nextActionDate && (
                  <span className="text-[10px] font-normal text-primary inline-flex items-center gap-0.5">
                    <Sparkles className="h-2.5 w-2.5" /> suggérée par l'IA
                  </span>
                )}
              </Label>
              <NextActionScheduler
                currentAction={{ date: nextActionDate || null, text: nextActionText || null }}
                scheduledDate={nextActionDate}
                setScheduledDate={(v) => { setNextActionDate(v); setNextActionSuggested(false); }}
                scheduledText={nextActionText}
                setScheduledText={(v) => { setNextActionText(v); setNextActionSuggested(false); }}
                showForm={nextActionFormOpen}
                setShowForm={setNextActionFormOpen}
                onSchedule={() => Promise.resolve()}
                onClear={() => {
                  setNextActionDate("");
                  setNextActionText("");
                  setNextActionFormOpen(false);
                  setNextActionSuggested(false);
                }}
                actionPresets={CRM_ACTION_PRESETS}
              />
              {!nextActionDate && !nextActionFormOpen && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNextActionFormOpen(true)}
                  className="gap-1.5"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Programmer une action
                </Button>
              )}
            </div>

            {/* Brief questions */}
            <div>
              <Label className="flex items-center gap-1 mb-2">
                <FileText className="h-3 w-3" />
                Questions pour le brief
              </Label>
              <div className="space-y-2">
                {editedExtraction.brief_questions.map((q) => (
                  <div key={q.id} className="flex gap-2">
                    <Input
                      value={q.question}
                      onChange={(e) => updateQuestion(q.id, e.target.value)}
                      placeholder="Question..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(q.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                  + Ajouter une question
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          {step === "input" ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button
                onClick={handleExtract}
                disabled={!rawInput.trim() || extractMutation.isPending}
              >
                {extractMutation.isPending ? (
                  <>
                    <Spinner className="mr-2" />
                    Extraction...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Extraire avec l'IA
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              {initialContact ? (
                <Button variant="outline" onClick={handleClose}>
                  Annuler
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setStep("input")}>
                  Retour
                </Button>
              )}
              <Button onClick={handleCreate} disabled={createCardMutation.isPending || !editedExtraction?.service_type || !acquisitionSource || !editedExtraction.title.trim()}>
                {createCardMutation.isPending ? (
                  <>
                    <Spinner className="mr-2" />
                    Création...
                  </>
                ) : (
                  "Créer l'opportunité"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
