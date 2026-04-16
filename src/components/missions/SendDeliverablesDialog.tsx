import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Eye, Mail } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useMissionContacts } from "@/hooks/useMissions";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import { MissionContact } from "@/types/missions";

interface SendDeliverablesDialogProps {
  missionId: string;
  missionTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Default template content matching Parametres.tsx
const DEFAULT_CONTENT_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Bonne nouvelle ! Les livrables de la mission "{{mission_title}}" sont prêts pour toi.

Tu peux les consulter et les télécharger à tout moment en cliquant ci-dessous :

<p style="margin: 20px 0;"><a href="{{deliverables_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">📦 Accéder aux livrables</a></p>

N'hésite pas à revenir vers moi si tu as la moindre question.

À très bientôt !`;

const DEFAULT_CONTENT_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Bonne nouvelle ! Les livrables de la mission "{{mission_title}}" sont disponibles.

Vous pouvez les consulter et les télécharger à tout moment en cliquant ci-dessous :

<p style="margin: 20px 0;"><a href="{{deliverables_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">📦 Accéder aux livrables</a></p>

N'hésitez pas à revenir vers moi si vous avez la moindre question.

Cordialement,`;

function processPreviewTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  // Conditional blocks
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, varName, content) => {
    return variables[varName] ? content : "";
  });
  // Simple variables
  result = result.replace(/\{\{(\w+)\}\}/g, (_m, varName) => variables[varName] || "");
  return result;
}

function textToHtmlPreview(text: string): string {
  if (!text) return "";
  return text
    .split(/\n\n+/)
    .map((p) => {
      // If the paragraph contains HTML tags (like <p>, <a>), keep it as is
      if (/<[a-z][\s\S]*>/i.test(p)) return p;
      const lines = p.split(/\n/).map((l) => l.trim());
      return `<p>${lines.join("<br>")}</p>`;
    })
    .join("");
}

const SendDeliverablesDialog = ({
  missionId,
  missionTitle,
  open,
  onOpenChange,
}: SendDeliverablesDialogProps) => {
  const { toast } = useToast();
  const { data: contacts, isLoading: contactsLoading } = useMissionContacts(missionId);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const contactsWithEmail = useMemo(
    () => (contacts || []).filter((c) => c.email),
    [contacts]
  );

  // Initialize selection & subject when dialog opens
  useEffect(() => {
    if (open && contactsWithEmail.length > 0) {
      const primary = contactsWithEmail.find((c) => c.is_primary);
      setSelectedIds(new Set(primary ? [primary.id] : [contactsWithEmail[0].id]));
      setSubject(`Vos livrables sont disponibles - ${missionTitle}`);
    }
  }, [open, contactsWithEmail, missionTitle]);

  const selectedContacts = contactsWithEmail.filter((c) => selectedIds.has(c.id));

  // Preview using the first selected contact
  const previewContact = selectedContacts[0];
  const previewHtml = useMemo(() => {
    if (!previewContact) return "";
    const useTu = previewContact.language === "fr"; // default tu for fr
    const template = useTu ? DEFAULT_CONTENT_TU : DEFAULT_CONTENT_VOUS;
    const link = `${window.location.origin}/mission-info/${missionId}`;
    const processed = processPreviewTemplate(template, {
      first_name: previewContact.first_name || "",
      mission_title: missionTitle,
      deliverables_link: link,
    });
    return textToHtmlPreview(processed);
  }, [previewContact, missionId, missionTitle]);

  const toggleContact = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (selectedContacts.length === 0) return;
    setSending(true);
    try {
      const recipients = selectedContacts.map((c) => ({
        email: c.email!,
        first_name: c.first_name || "",
        language: c.language || "fr",
      }));

      const { error } = await supabase.functions.invoke("send-mission-deliverables", {
        body: { mission_id: missionId, recipients, subject },
      });

      if (error) throw error;

      toast({
        title: "Emails envoyés",
        description: `${recipients.length} email(s) de livraison envoyé(s) avec succès.`,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        title: "Erreur d'envoi",
        description: err instanceof Error ? err.message : "Impossible d'envoyer les emails",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Envoyer les livrables
          </DialogTitle>
        </DialogHeader>

        {contactsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : contactsWithEmail.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Aucun contact avec email pour cette mission.</p>
            <p className="text-xs mt-1">Ajoutez des contacts avec une adresse email dans l'onglet Paramètres.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Recipients */}
            <div>
              <Label className="text-sm font-medium">Destinataires</Label>
              <div className="mt-2 space-y-2">
                {contactsWithEmail.map((contact) => {
                  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
                  return (
                    <label
                      key={contact.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedIds.has(contact.id)}
                        onCheckedChange={() => toggleContact(contact.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">
                          {name || "Sans nom"}
                        </span>
                        {contact.is_primary && (
                          <span className="text-xs text-yellow-600 ml-1">★</span>
                        )}
                        <span className="text-xs text-muted-foreground ml-2">
                          {contact.email}
                        </span>
                        {contact.role && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({contact.role})
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Subject */}
            <div>
              <Label className="text-sm font-medium">Objet</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Preview */}
            <div>
              <button
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-4 w-4" />
                {showPreview ? "Masquer" : "Afficher"} l'aperçu
              </button>
              {showPreview && previewContact && (
                <div className="mt-2 border rounded-lg p-4 bg-background">
                  <div className="text-xs text-muted-foreground mb-2">
                    Aperçu pour : {previewContact.first_name || previewContact.email}
                  </div>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground italic">
                    + signature email automatique
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || selectedContacts.length === 0}
          >
            {sending ? (
              <Spinner className="mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Envoyer ({selectedContacts.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SendDeliverablesDialog;
