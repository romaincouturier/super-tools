// CardDetailCommunication
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Mail, FileText, Paperclip, X, Wand2, Undo2, Calendar, ChevronDown, Copy, Pencil, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCrmEmailTemplates, replaceCrmVariables } from "@/hooks/useCrmEmailTemplates";
import { useToast } from "@/hooks/use-toast";
import EmailEditor from "../EmailEditor";
import SentDevisSection from "../SentDevisSection";
import type { CardDetailState, CardDetailHandlers, CardDetails } from "./types";

interface Props {
  state: CardDetailState;
  handlers: CardDetailHandlers;
  details: CardDetails | undefined;
  emailFileInputRef: React.RefObject<HTMLInputElement>;
  selectedTemplateRef: React.MutableRefObject<{ id: string; subject: string; html_content: string } | null>;
}

const CardDetailCommunication = ({ state, handlers, details, emailFileInputRef, selectedTemplateRef }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: crmEmailTemplates } = useCrmEmailTemplates();
  const { toast } = useToast();

  const {
    card, email, firstName, lastName, company,
    emailTo, setEmailTo, emailCc, setEmailCc, emailBcc, setEmailBcc,
    showCcBcc, setShowCcBcc,
    emailSubject, setEmailSubject, emailBody, setEmailBody,
    emailAttachments, setEmailAttachments,
    emailSubjectBeforeAi, emailBodyBeforeAi,
    improvingSubject, improvingBody, sendEmailPending,
  } = state;

  return (
    <div className="space-y-4 mt-6 border-t pt-4">
      <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
        Communication
      </h4>

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
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          {tpl.template_name}
                          {tpl.improvement_count > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] text-purple-600 bg-purple-50 px-1 py-0.5 rounded" title={`Auto-amélioré ${tpl.improvement_count} fois`}>
                              <Sparkles className="h-2.5 w-2.5" />
                              {tpl.improvement_count}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Aucun modèle configuré
                  </div>
                )}
              </div>
              <div className="border-t">
                <button
                  className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
                  onClick={() => navigate("/parametres")}
                >
                  <Pencil className="h-3 w-3" />
                  Configurer les modèles
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* To / Cc / Bcc */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
              À
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
              placeholder="email@exemple.com (séparer par des virgules)"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              className="flex-1"
            />
            {!showCcBcc && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCcBcc(true)}
                className="h-7 px-2 text-xs text-muted-foreground"
              >
                Cc/Cci
              </Button>
            )}
          </div>
          {showCcBcc && (
            <>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap w-6">Cc</Label>
                <Input placeholder="Copie visible (séparer par des virgules)" value={emailCc} onChange={(e) => setEmailCc(e.target.value)} className="flex-1" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap w-6">Cci</Label>
                <Input placeholder="Copie invisible (séparer par des virgules)" value={emailBcc} onChange={(e) => setEmailBcc(e.target.value)} className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowCcBcc(false); setEmailCc(""); setEmailBcc(""); }}
                  className="h-7 w-7 p-0 text-muted-foreground"
                  title="Masquer Cc/Cci"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Subject */}
        <div className="flex gap-2">
          <Input placeholder="Sujet" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="flex-1" />
          {emailSubjectBeforeAi ? (
            <Button variant="outline" size="sm" onClick={handlers.handleUndoSubjectAi} title="Annuler l'amélioration">
              <Undo2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handlers.handleImproveEmailSubject}
              disabled={!emailSubject.trim() || improvingSubject}
              title="Améliorer avec l'IA"
            >
              {improvingSubject ? <Spinner /> : <Wand2 className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {/* Body */}
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
                  .update({ gender } as Record<string, string>)
                  .eq("id", card.id)
                  .then(() => queryClient.invalidateQueries({ queryKey: ["crm-cards"] }));
              }
            }}
          />
          <div className="flex justify-end gap-2">
            {emailBodyBeforeAi && (
              <Button variant="outline" size="sm" onClick={handlers.handleUndoBodyAi} title="Annuler l'amélioration">
                <Undo2 className="h-4 w-4 mr-1" />
                Annuler IA
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handlers.handleImproveEmailBody}
              disabled={!emailBody.trim() || improvingBody}
              title="Améliorer avec l'IA"
            >
              {improvingBody ? <Spinner className="mr-1" /> : <Wand2 className="h-4 w-4 mr-1" />}
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
            onChange={handlers.handleEmailAttachFiles}
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
                  <button type="button" onClick={() => handlers.handleRemoveAttachment(i)} className="ml-0.5 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Send */}
        <div className="flex gap-2">
          <Button
            onClick={handlers.handleSendEmail}
            disabled={!emailTo.trim() || !emailSubject.trim() || sendEmailPending}
            className="flex-1"
          >
            {sendEmailPending ? (
              <>
                <Spinner className="mr-2" />
                Envoi en cours…
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Envoyer{emailAttachments.length > 0 ? ` (${emailAttachments.length} pièce${emailAttachments.length > 1 ? "s" : ""} jointe${emailAttachments.length > 1 ? "s" : ""})` : ""}
              </>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!emailTo.trim() || !emailSubject.trim() || sendEmailPending} className="px-2">
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
                      await (supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> }).from("crm_scheduled_emails").insert({
                        card_id: card.id,
                        recipient_email: emailTo.trim(),
                        subject: emailSubject.trim(),
                        body_html: DOMPurify.sanitize(emailBody),
                        scheduled_at: hours.toISOString(),
                        sender_email: user.email,
                        attachments: emailAttachments.length > 0 ? emailAttachments : null,
                      });
                      toast({ title: "Email programmé", description: `Envoi prévu le ${format(hours, "d MMM yyyy 'à' HH:mm", { locale: fr })}` });
                      setEmailTo(""); setEmailCc(""); setEmailBcc(""); setShowCcBcc(false); setEmailSubject(""); setEmailBody(""); setEmailAttachments([]);
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

      {/* Email & devis history */}
      <SentDevisSection email={email || null} cardId={card?.id || null} emails={details?.emails} />
    </div>
  );
};

export default CardDetailCommunication;
