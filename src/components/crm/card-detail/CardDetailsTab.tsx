import { useState, useCallback, useRef, useEffect } from "react";
import {
  User,
  Building2,
  Mail,
  Phone,
  Linkedin,
  Globe,
  ExternalLink,
  Copy,
  Sparkles,
  Brain,
  FileSignature,
  FileText,
  Check,
  X,
  Loader2,
  Receipt,
  LinkIcon,
  Briefcase,
  Search,
  Wand2,
  Undo2,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { QRCodeSVG } from "qrcode.react";
import EmojiPickerButton from "@/components/ui/emoji-picker-button";
import CrmDescriptionEditor from "../CrmDescriptionEditor";
import EmailEditor from "../EmailEditor";
import SentDevisSection from "../SentDevisSection";
import { supabase } from "@/integrations/supabase/client";
import {
  CrmCard,
  BriefQuestion,
  AcquisitionSource,
  acquisitionSourceConfig,
} from "@/types/crm";
import { useSearchMissions } from "@/hooks/useMissions";
import { missionStatusConfig } from "@/types/missions";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";

interface CardDetailsTabProps {
  card: CrmCard;
  // Contact fields
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  websiteUrl: string;
  serviceType: "formation" | "mission" | null;
  acquisitionSource: AcquisitionSource | null;
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  onCompanyChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onLinkedinUrlChange: (v: string) => void;
  onWebsiteUrlChange: (v: string) => void;
  onServiceTypeChange: (v: "formation" | "mission" | null) => void;
  onAcquisitionSourceChange: (v: AcquisitionSource | null) => void;
  // Title & description
  title: string;
  cardEmoji: string | null;
  descriptionHtml: string;
  onTitleChange: (v: string) => void;
  onCardEmojiChange: (v: string | null) => void;
  onDescriptionChange: (v: string) => void;
  onSaveDescription: (v: string) => Promise<void>;
  // Next action
  nextActionText: string;
  nextActionDone: boolean;
  onNextActionTextChange: (v: string) => void;
  onNextActionDoneChange: (v: boolean) => void;
  // Linked mission
  linkedMissionId: string | null;
  onLinkedMissionIdChange: (v: string | null) => void;
  // Quote
  quoteUrl: string;
  onQuoteUrlChange: (v: string) => void;
  estimatedValue: string;
  onEstimatedValueChange: (v: string) => void;
  // Confidence
  confidenceScore: number | null;
  onConfidenceScoreChange: (v: number | null) => void;
  // Email
  emailTo: string;
  emailSubject: string;
  emailBody: string;
  onEmailToChange: (v: string) => void;
  onEmailSubjectChange: (v: string) => void;
  onEmailBodyChange: (v: string) => void;
  onSendEmail: () => void;
  isSendingEmail: boolean;
  // Brief questions
  onUpdateBriefQuestion: (updatedQuestions: BriefQuestion[]) => void;
  // Comments for AI context
  comments: Array<{ content: string }>;
  userEmail: string;
}

const CardDetailsTab = (props: CardDetailsTabProps) => {
  const {
    card, firstName, lastName, company, email, phone, linkedinUrl, websiteUrl,
    serviceType, acquisitionSource, onFirstNameChange, onLastNameChange,
    onCompanyChange, onEmailChange, onPhoneChange, onLinkedinUrlChange,
    onWebsiteUrlChange, onServiceTypeChange, onAcquisitionSourceChange,
    title, cardEmoji, descriptionHtml, onTitleChange, onCardEmojiChange,
    onDescriptionChange, onSaveDescription, nextActionText, nextActionDone,
    onNextActionTextChange, onNextActionDoneChange, linkedMissionId,
    onLinkedMissionIdChange, quoteUrl, onQuoteUrlChange, estimatedValue,
    onEstimatedValueChange, confidenceScore, onConfidenceScoreChange,
    emailTo, emailSubject, emailBody, onEmailToChange, onEmailSubjectChange,
    onEmailBodyChange, onSendEmail, isSendingEmail, onUpdateBriefQuestion,
    comments, userEmail,
  } = props;

  // AI state
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [quoteGenerating, setQuoteGenerating] = useState(false);
  const [quoteDescription, setQuoteDescription] = useState<string | null>(null);
  const [nextActionSuggesting, setNextActionSuggesting] = useState(false);
  const [nextActionSuggestion, setNextActionSuggestion] = useState<string | null>(null);

  // Email AI state
  const [emailSubjectBeforeAi, setEmailSubjectBeforeAi] = useState<string | null>(null);
  const [emailBodyBeforeAi, setEmailBodyBeforeAi] = useState<string | null>(null);
  const [improvingSubject, setImprovingSubject] = useState(false);
  const [improvingBody, setImprovingBody] = useState(false);

  // Auto-save description
  const [descriptionSaving, setDescriptionSaving] = useState(false);
  const [descriptionSaved, setDescriptionSaved] = useState(false);
  const descriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mission search
  const [missionSearchQuery, setMissionSearchQuery] = useState("");
  const [showMissionSearch, setShowMissionSearch] = useState(false);
  const { data: missionSearchResults, isLoading: searchingMissions } = useSearchMissions(missionSearchQuery);

  // Reset AI state when card changes
  useEffect(() => {
    setAiAnalysis(null);
    setQuoteDescription(null);
    setNextActionSuggestion(null);
    setDescriptionSaved(false);
    setMissionSearchQuery("");
    setShowMissionSearch(false);
  }, [card?.id]);

  useEffect(() => {
    return () => {
      if (descriptionTimeoutRef.current) {
        clearTimeout(descriptionTimeoutRef.current);
      }
    };
  }, []);

  const handleDescriptionChange = (value: string) => {
    onDescriptionChange(value);
    if (descriptionTimeoutRef.current) {
      clearTimeout(descriptionTimeoutRef.current);
    }
    descriptionTimeoutRef.current = setTimeout(async () => {
      setDescriptionSaving(true);
      setDescriptionSaved(false);
      try {
        await onSaveDescription(value);
        setDescriptionSaved(true);
        setTimeout(() => setDescriptionSaved(false), 2000);
      } catch {
        // error handled by parent
      } finally {
        setDescriptionSaving(false);
      }
    }, 1500);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const generateLinkedInSearchUrl = () => {
    if (!firstName && !lastName) return "";
    const name = [firstName, lastName?.toUpperCase()].filter(Boolean).join(" ");
    return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(name)}`;
  };

  const buildAiCardData = () => ({
    title: card.title,
    description: descriptionHtml,
    company,
    first_name: firstName,
    last_name: lastName,
    service_type: serviceType,
    estimated_value: Math.round((parseFloat(estimatedValue) || 0) * 100) / 100,
    comments: comments || [],
    brief_questions: card.brief_questions || [],
  });

  const handleAiAnalysis = async () => {
    setAiAnalyzing(true);
    setAiAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
        body: { action: "analyze_exchanges", card_data: buildAiCardData() },
      });
      if (error) throw error;
      setAiAnalysis(data.result);
    } catch {
      setAiAnalysis("Erreur lors de l'analyse. Veuillez réessayer.");
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleGenerateQuoteDescription = async () => {
    setQuoteGenerating(true);
    setQuoteDescription(null);
    try {
      const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
        body: { action: "generate_quote_description", card_data: buildAiCardData() },
      });
      if (error) throw error;
      setQuoteDescription(data.result);
    } catch {
      setQuoteDescription("Erreur lors de la génération. Veuillez réessayer.");
    } finally {
      setQuoteGenerating(false);
    }
  };

  const handleSuggestNextAction = async () => {
    setNextActionSuggesting(true);
    setNextActionSuggestion(null);
    try {
      const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
        body: {
          action: "suggest_next_action",
          card_data: {
            ...buildAiCardData(),
            confidence_score: confidenceScore,
            current_next_action: nextActionText,
            days_in_pipeline: card.created_at ? Math.floor((Date.now() - new Date(card.created_at).getTime()) / (1000 * 60 * 60 * 24)) : null,
          },
        },
      });
      if (error) throw error;
      setNextActionSuggestion(data.result);
    } catch {
      setNextActionSuggestion("Erreur lors de la suggestion. Veuillez réessayer.");
    } finally {
      setNextActionSuggesting(false);
    }
  };

  const handleImproveEmailSubject = async () => {
    if (!emailSubject.trim()) return;
    setImprovingSubject(true);
    setEmailSubjectBeforeAi(emailSubject);
    try {
      const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
        body: {
          action: "improve_email_subject",
          card_data: { subject: emailSubject, company, first_name: firstName, context: descriptionHtml },
        },
      });
      if (error) throw error;
      onEmailSubjectChange(data.result);
    } catch {
      setEmailSubjectBeforeAi(null);
    } finally {
      setImprovingSubject(false);
    }
  };

  const handleImproveEmailBody = async () => {
    if (!emailBody.trim()) return;
    setImprovingBody(true);
    setEmailBodyBeforeAi(emailBody);
    try {
      const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
        body: {
          action: "improve_email_body",
          card_data: { body: emailBody, subject: emailSubject, company, first_name: firstName, context: descriptionHtml },
        },
      });
      if (error) throw error;
      onEmailBodyChange(data.result);
    } catch {
      setEmailBodyBeforeAi(null);
    } finally {
      setImprovingBody(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Contact info section */}
      <div className="p-4 bg-muted/50 rounded-lg space-y-3">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <User className="h-4 w-4" />
          Contact
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Prénom</Label>
            <Input value={firstName} onChange={(e) => onFirstNameChange(e.target.value)} placeholder="Prénom" className="h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nom</Label>
            <Input value={lastName} onChange={(e) => onLastNameChange(e.target.value)} placeholder="Nom" className="h-8" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs flex items-center gap-1"><Building2 className="h-3 w-3" />Entreprise</Label>
            <Input value={company} onChange={(e) => onCompanyChange(e.target.value)} placeholder="Nom de l'entreprise" className="h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" />Email</Label>
            <div className="flex gap-1">
              <Input type="email" value={email} onChange={(e) => onEmailChange(e.target.value)} placeholder="email@exemple.com" className="h-8 flex-1" />
              {email.trim() && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(email)} title="Copier l'email">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" />Téléphone</Label>
            <div className="flex items-center gap-2">
              <Input type="tel" value={phone} onChange={(e) => onPhoneChange(e.target.value)} placeholder="06 12 34 56 78" className="h-8 flex-1" />
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
          <div className="space-y-1 col-span-2">
            <Label className="text-xs flex items-center gap-1"><Linkedin className="h-3 w-3" />LinkedIn</Label>
            <div className="flex gap-2">
              <Input value={linkedinUrl} onChange={(e) => onLinkedinUrlChange(e.target.value)} placeholder="URL du profil LinkedIn" className="h-8 flex-1" />
              <Button variant="outline" size="sm" onClick={() => { const url = generateLinkedInSearchUrl(); if (url) onLinkedinUrlChange(url); }} disabled={!firstName && !lastName} title="Générer un lien de recherche LinkedIn">
                <Sparkles className="h-3 w-3" />
              </Button>
              {linkedinUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={linkedinUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs flex items-center gap-1"><Globe className="h-3 w-3" />Site web</Label>
            <div className="flex gap-2">
              <Input type="url" value={websiteUrl} onChange={(e) => onWebsiteUrlChange(e.target.value)} placeholder="https://www.exemple.com" className="h-8 flex-1" />
              {websiteUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={websiteUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type de prestation</Label>
            <Select value={serviceType || ""} onValueChange={(v) => onServiceTypeChange(v as "formation" | "mission" | null)}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Non défini" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="formation">Formation</SelectItem>
                <SelectItem value="mission">Mission</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Source d'acquisition</Label>
            <Select value={acquisitionSource || ""} onValueChange={(v) => onAcquisitionSourceChange(v as AcquisitionSource)}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Non définie" /></SelectTrigger>
              <SelectContent>
                {(Object.entries(acquisitionSourceConfig) as [AcquisitionSource, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Linked Mission */}
      {serviceType === "mission" && (
        <div className="p-4 bg-purple-50 rounded-lg space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2"><Briefcase className="h-4 w-4" />Mission liée</h4>
          {linkedMissionId ? (
            <div className="flex items-center justify-between p-2 bg-white rounded border">
              <span className="text-sm">Mission #{linkedMissionId.slice(0, 8)}</span>
              <Button variant="ghost" size="sm" onClick={() => onLinkedMissionIdChange(null)}><X className="h-4 w-4" /></Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input value={missionSearchQuery} onChange={(e) => { setMissionSearchQuery(e.target.value); setShowMissionSearch(true); }} placeholder="Rechercher une mission..." className="h-8" />
                {searchingMissions && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {showMissionSearch && missionSearchResults && missionSearchResults.length > 0 && (
                <div className="border rounded bg-white max-h-40 overflow-y-auto">
                  {missionSearchResults.map((mission) => (
                    <button key={mission.id} className="w-full text-left p-2 hover:bg-muted text-sm border-b last:border-b-0" onClick={() => { onLinkedMissionIdChange(mission.id); setMissionSearchQuery(""); setShowMissionSearch(false); }}>
                      <div className="font-medium">{mission.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        {mission.client_name && <span>{mission.client_name}</span>}
                        <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: missionStatusConfig[mission.status].color + "20", color: missionStatusConfig[mission.status].color }}>{missionStatusConfig[mission.status].label}</span>
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

      {/* Brief questions */}
      {card.brief_questions && card.brief_questions.length > 0 && (
        <div className="p-4 bg-amber-50 rounded-lg space-y-2">
          <h4 className="font-medium text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Questions pour le brief</h4>
          <ul className="space-y-1.5">
            {card.brief_questions.map((q: BriefQuestion) => (
              <li key={q.id} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-amber-100/50 rounded px-1 py-0.5 -mx-1 transition-colors" onClick={() => {
                if (!userEmail) return;
                const updatedQuestions = card.brief_questions.map((bq: BriefQuestion) => bq.id === q.id ? { ...bq, answered: !bq.answered } : bq);
                onUpdateBriefQuestion(updatedQuestions);
              }}>
                {q.answered ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
                <span className={q.answered ? "text-muted-foreground line-through" : ""}>{q.question}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quote buttons */}
      <div className="flex gap-2 flex-wrap">
        {serviceType === "formation" && (
          <Button variant="outline" size="sm" onClick={() => {
            const params = new URLSearchParams({
              ...(company && { nomClient: company }),
              ...(email && { emailCommanditaire: email }),
              ...((firstName || lastName) && { adresseCommanditaire: [firstName, lastName].filter(Boolean).join(" ") }),
              ...(card?.id && { crmCardId: card.id }),
              source: "crm",
            });
            window.open(`/micro-devis?${params.toString()}`, "_blank");
          }}>
            <Receipt className="h-4 w-4 mr-2" />
            Créer un devis formation
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => {
          const url = prompt("URL du devis existant :", quoteUrl);
          if (url !== null) onQuoteUrlChange(url);
        }}>
          <LinkIcon className="h-4 w-4 mr-2" />
          Lier à un devis existant
        </Button>
        {quoteUrl && (
          <Button asChild variant="outline" size="sm">
            <a href={quoteUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Voir le devis</a>
          </Button>
        )}
      </div>

      {/* Sent devis list */}
      <SentDevisSection email={email || null} cardId={card?.id || null} />

      <div>
        <Label>Titre</Label>
        <div className="flex items-center gap-2">
          <EmojiPickerButton emoji={cardEmoji} onEmojiChange={onCardEmojiChange} size="md" />
          <Input value={title} onChange={(e) => onTitleChange(e.target.value)} className="flex-1" />
        </div>
      </div>

      {/* Description with auto-save and AI */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            Description / Notes
            {descriptionSaving && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Enregistrement...</span>}
            {descriptionSaved && !descriptionSaving && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="h-3 w-3" />Enregistré</span>}
          </Label>
        </div>
        <CrmDescriptionEditor content={descriptionHtml} onChange={handleDescriptionChange} cardId={card?.id} />

        {/* Next action checkbox */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Checkbox id="next-action-done" checked={nextActionDone} onCheckedChange={(checked) => onNextActionDoneChange(checked === true)} />
          <div className="flex-1">
            <Label htmlFor="next-action-done" className="text-xs text-muted-foreground mb-1 block">Prochaine action</Label>
            <div className="flex gap-1.5">
              <Input value={nextActionText} onChange={(e) => onNextActionTextChange(e.target.value)} placeholder="Quelle est la prochaine action à faire ?" className={`h-8 text-sm flex-1 ${nextActionDone ? "line-through text-muted-foreground" : ""}`} />
              <Button variant="ghost" size="sm" className="h-8 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50" onClick={handleSuggestNextAction} disabled={nextActionSuggesting} title="Suggérer avec l'IA">
                {nextActionSuggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* AI next action suggestion */}
        {nextActionSuggestion && (
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-purple-700 text-xs">Suggestion IA</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-purple-700" onClick={() => { onNextActionTextChange(nextActionSuggestion); setNextActionSuggestion(null); }}>
                  <Check className="h-3 w-3 mr-0.5" />Appliquer
                </Button>
                <Button variant="ghost" size="sm" className="h-5 px-1" onClick={() => setNextActionSuggestion(null)}><X className="h-3 w-3" /></Button>
              </div>
            </div>
            <p className="text-purple-900">{nextActionSuggestion}</p>
          </div>
        )}

        {/* AI buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleAiAnalysis} disabled={aiAnalyzing || !descriptionHtml.trim()}>
            {aiAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
            Analyser avec l'IA
          </Button>
          <Button variant="outline" size="sm" onClick={handleGenerateQuoteDescription} disabled={quoteGenerating || !descriptionHtml.trim()}>
            {quoteGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSignature className="h-4 w-4 mr-2" />}
            Générer descriptif devis
          </Button>
        </div>

        {/* AI Analysis result */}
        {aiAnalysis && (
          <div className="p-4 bg-purple-50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm flex items-center gap-2 text-purple-700"><Brain className="h-4 w-4" />Analyse IA</h4>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(aiAnalysis)} title="Copier"><FileText className="h-3 w-3" /></Button>
                <Button variant="ghost" size="sm" onClick={() => setAiAnalysis(null)}><X className="h-3 w-3" /></Button>
              </div>
            </div>
            <div className="text-sm whitespace-pre-wrap text-purple-900">{aiAnalysis}</div>
          </div>
        )}

        {/* Quote description result */}
        {quoteDescription && (
          <div className="p-4 bg-emerald-50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm flex items-center gap-2 text-emerald-700"><FileSignature className="h-4 w-4" />Descriptif pour devis</h4>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(quoteDescription)} title="Copier"><FileText className="h-3 w-3" /></Button>
                <Button variant="ghost" size="sm" onClick={() => setQuoteDescription(null)}><X className="h-3 w-3" /></Button>
              </div>
            </div>
            <div className="text-sm whitespace-pre-wrap text-emerald-900">{quoteDescription}</div>
          </div>
        )}
      </div>

      <div>
        <Label>Valeur estimée (€)</Label>
        <Input type="number" min="0" step="0.01" value={estimatedValue} onChange={(e) => onEstimatedValueChange(e.target.value)} />
      </div>

      {/* Confidence score */}
      <div>
        <Label className="flex items-center justify-between">
          <span>Indice de confiance</span>
          <span className={cn(
            "text-xs font-medium px-1.5 py-0.5 rounded",
            confidenceScore === null && "text-muted-foreground",
            confidenceScore !== null && confidenceScore >= 70 && "text-green-700 bg-green-50",
            confidenceScore !== null && confidenceScore >= 40 && confidenceScore < 70 && "text-orange-700 bg-orange-50",
            confidenceScore !== null && confidenceScore < 40 && "text-red-700 bg-red-50",
          )}>
            {confidenceScore !== null ? `${confidenceScore}%` : "Non défini"}
          </span>
        </Label>
        <div className="flex items-center gap-3 mt-1.5">
          <input type="range" min="0" max="100" step="5" value={confidenceScore ?? 50} onChange={(e) => onConfidenceScoreChange(parseInt(e.target.value))} className="flex-1 h-2 accent-primary cursor-pointer" />
          {confidenceScore !== null && (
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground" onClick={() => onConfidenceScoreChange(null)} title="Réinitialiser"><X className="h-3 w-3" /></Button>
          )}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5 px-0.5">
          <span>Peu probable</span>
          <span>Très probable</span>
        </div>
      </div>

      {/* Email section */}
      <div className="border-t pt-4 mt-4">
        <h4 className="font-medium mb-3 flex items-center gap-2"><Mail className="h-4 w-4" />Envoyer un email</h4>
        <div className="space-y-3">
          {/* Email templates */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Modèle</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1 flex-1">
                  <FileText className="h-3.5 w-3.5" />Choisir un modèle
                  <span className="ml-auto">▾</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="p-2 border-b">
                  <p className="text-sm font-medium">Modèles d'email</p>
                  <p className="text-xs text-muted-foreground">Cliquez pour pré-remplir le message</p>
                </div>
                <div className="divide-y">
                  {[
                    { name: "Relance devis", subject: `Suivi de votre demande${company ? ` – ${company}` : ""}`, body: `<p>Bonjour${firstName ? ` ${firstName}` : ""},</p><p>Je reviens vers vous concernant le devis que je vous ai transmis${card?.title ? ` pour votre demande de ${card.title.toLowerCase()}` : ""}.</p><p>Je voulais m'assurer que vous aviez bien reçu tous les éléments et que tout était clair pour vous.</p><p>Je reste à votre disposition pour répondre à vos questions et vous aider à finaliser votre décision.</p><p>Bonne journée,</p>` },
                    { name: "Premier contact", subject: `${company ? company + " – " : ""}Prise de contact SuperTilt`, body: `<p>Bonjour${firstName ? ` ${firstName}` : ""},</p><p>Je me permets de vous contacter suite à votre demande concernant ${card?.title || "notre offre de formation"}.</p><p>Je serais ravi(e) d'échanger avec vous pour mieux comprendre vos besoins et vous proposer la solution la plus adaptée.</p><p>Seriez-vous disponible pour un appel de 15 minutes cette semaine ?</p><p>Bonne journée,</p>` },
                    { name: "Envoi de devis", subject: `Votre devis${company ? ` – ${company}` : ""}`, body: `<p>Bonjour${firstName ? ` ${firstName}` : ""},</p><p>Suite à notre échange, veuillez trouver ci-joint votre devis pour ${card?.title || "la prestation demandée"}.</p><p>Ce document détaille l'ensemble des éléments convenus. N'hésitez pas à me revenir si vous souhaitez apporter des ajustements.</p><p>Dans l'attente de votre retour,</p>` },
                    { name: "Confirmation de formation", subject: `Confirmation de votre inscription${company ? ` – ${company}` : ""}`, body: `<p>Bonjour${firstName ? ` ${firstName}` : ""},</p><p>Je suis ravi(e) de confirmer votre participation à ${card?.title || "la formation"}.</p><p>Vous recevrez prochainement tous les documents nécessaires (convention, programme, modalités pratiques).</p><p>En attendant, n'hésitez pas à me contacter pour toute question.</p><p>À très bientôt,</p>` },
                  ].map((template) => (
                    <button key={template.name} className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors" onClick={() => { onEmailSubjectChange(template.subject); onEmailBodyChange(template.body); }}>
                      <div className="font-medium text-sm">{template.name}</div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
              Destinataire
              {email && email !== emailTo && (
                <Button variant="ghost" size="sm" onClick={() => onEmailToChange(email)} title={`Utiliser ${email}`} className="h-5 px-1.5 text-[10px] text-primary">
                  <Copy className="h-3 w-3 mr-0.5" />Client
                </Button>
              )}
            </Label>
            <Input placeholder="email@exemple.com" value={emailTo} onChange={(e) => onEmailToChange(e.target.value)} className="flex-1" />
          </div>
          <div className="flex gap-2">
            <Input placeholder="Sujet" value={emailSubject} onChange={(e) => onEmailSubjectChange(e.target.value)} className="flex-1" />
            {emailSubjectBeforeAi ? (
              <Button variant="outline" size="sm" onClick={() => { onEmailSubjectChange(emailSubjectBeforeAi); setEmailSubjectBeforeAi(null); }} title="Annuler l'amélioration"><Undo2 className="h-4 w-4" /></Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleImproveEmailSubject} disabled={!emailSubject.trim() || improvingSubject} title="Améliorer avec l'IA">
                {improvingSubject ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <EmailEditor content={emailBody} onChange={(content) => onEmailBodyChange(content)} placeholder="Corps du message..." />
            <div className="flex justify-end gap-2">
              {emailBodyBeforeAi && (
                <Button variant="outline" size="sm" onClick={() => { onEmailBodyChange(emailBodyBeforeAi); setEmailBodyBeforeAi(null); }} title="Annuler l'amélioration">
                  <Undo2 className="h-4 w-4 mr-1" />Annuler IA
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleImproveEmailBody} disabled={!emailBody.trim() || improvingBody} title="Améliorer avec l'IA">
                {improvingBody ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1" />}
                Améliorer avec l'IA
              </Button>
            </div>
          </div>
          <Button onClick={onSendEmail} disabled={!emailTo.trim() || !emailSubject.trim() || isSendingEmail} className="w-full">
            {isSendingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Envoyer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CardDetailsTab;
