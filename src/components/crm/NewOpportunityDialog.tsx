import { useState } from "react";
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
import { Loader2, Sparkles, User, Building2, Phone, Mail, Linkedin, FileText, Euro, TrendingUp, ChevronDown, MessageSquare, History, CheckCircle, XCircle, Clock, CalendarClock } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { useExtractOpportunity, useCreateCard, useCrmBoard } from "@/hooks/useCrmBoard";
import { OpportunityExtraction, BriefQuestion, AcquisitionSource, acquisitionSourceConfig } from "@/types/crm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

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
}

export function NewOpportunityDialog({ open, onOpenChange, userEmail }: NewOpportunityDialogProps) {
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
  const [scheduleAction, setScheduleAction] = useState(false);
  const [nextActionDate, setNextActionDate] = useState("");
  const [nextActionText, setNextActionText] = useState("");

  const { data: boardData } = useCrmBoard();
  const extractMutation = useExtractOpportunity();
  const createCardMutation = useCreateCard();

  // Find "Entrant" column (first column for new opportunities)
  const entrantColumn = boardData?.columns.find((col) => col.name === "Entrant") || boardData?.columns[0];

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
      const result = await extractMutation.mutateAsync(rawInput);
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
    } catch {
      // Error handled by mutation
    }
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
      await createCardMutation.mutateAsync({
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
          ...(scheduleAction && nextActionDate && {
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

      // Reset and close
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
      setScheduleAction(false);
      setNextActionDate("");
      setNextActionText("");
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleClose = () => {
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
    setScheduleAction(false);
    setNextActionDate("");
    setNextActionText("");
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

            {/* Schedule next action */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="schedule-action"
                  checked={scheduleAction}
                  onCheckedChange={(checked) => setScheduleAction(checked === true)}
                />
                <Label htmlFor="schedule-action" className="flex items-center gap-1.5 font-normal cursor-pointer">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Programmer une prochaine action
                </Label>
              </div>
              {scheduleAction && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                  <div>
                    <Label htmlFor="next-action-date" className="text-xs">Date *</Label>
                    <Input
                      id="next-action-date"
                      type="date"
                      value={nextActionDate}
                      onChange={(e) => setNextActionDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="next-action-text" className="text-xs">Action prévue</Label>
                    <Input
                      id="next-action-text"
                      value={nextActionText}
                      onChange={(e) => setNextActionText(e.target.value)}
                      placeholder="Ex: Relancer le client"
                      className="mt-1"
                    />
                  </div>
                </div>
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
              <Button variant="outline" onClick={() => setStep("input")}>
                Retour
              </Button>
              <Button onClick={handleCreate} disabled={createCardMutation.isPending || !editedExtraction?.service_type || !acquisitionSource}>
                {createCardMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
