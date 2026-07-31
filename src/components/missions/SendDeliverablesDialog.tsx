import DOMPurify from "dompurify";
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
import { Send, Eye, Mail, FileText, Image as ImageIcon, MessageSquare, Package } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useMissionContacts, useMissionPages, useUpdateMissionPage } from "@/hooks/useMissions";
import { useEntityDocuments } from "@/hooks/useEntityDocuments";
import { useEntityMedia } from "@/hooks/useMedia";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import { MissionContact } from "@/types/missions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

// Templates de relance (2ème envoi et plus) — doivent rester alignés avec
// supabase/functions/send-mission-deliverables/index.ts
const DEFAULT_UPDATE_CONTENT_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

De nouveaux éléments viennent d'être ajoutés aux livrables de la mission "{{mission_title}}".

{{#new_items_html}}Nouveautés depuis mon dernier envoi :
{{new_items_html}}{{/new_items_html}}

Tu retrouves l'ensemble des livrables (anciens et nouveaux) au même endroit :

<p style="margin: 20px 0;"><a href="{{deliverables_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">📦 Accéder aux livrables</a></p>

N'hésite pas à revenir vers moi si tu as la moindre question.

À très bientôt !`;

const DEFAULT_UPDATE_CONTENT_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

De nouveaux éléments viennent d'être ajoutés aux livrables de la mission "{{mission_title}}".

{{#new_items_html}}Nouveautés depuis mon dernier envoi :
{{new_items_html}}{{/new_items_html}}

Vous retrouvez l'ensemble des livrables (anciens et nouveaux) au même endroit :

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
  const { data: pages } = useMissionPages(open ? missionId : null);
  const { data: documents } = useEntityDocuments("mission", open ? missionId : undefined);
  const { data: mediaItems } = useEntityMedia("mission", open ? missionId : undefined);
  const updatePage = useUpdateMissionPage();

  const deliverablePages = useMemo(
    () => (pages || []).filter((p: any) => p.is_deliverable),
    [pages],
  );
  const deliverableDocs = useMemo(
    () => (documents || []).filter((d: any) => d.is_deliverable),
    [documents],
  );
  const deliverableMedia = useMemo(
    () => (mediaItems || []).filter((m: any) => m.is_deliverable),
    [mediaItems],
  );

  // Historique des envois précédents (pour basculer sur le template "nouveautés")
  const { data: previousSends } = useQuery({
    queryKey: ["mission-deliverable-sends", missionId],
    enabled: open && !!missionId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("mission_deliverable_sends") as any)
        .select("contact_id, email, item_keys, sent_at")
        .eq("mission_id", missionId)
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return (data || []) as { contact_id: string | null; email: string; item_keys: string[]; sent_at: string }[];
    },
  });

  const currentItems = useMemo(
    () => [
      ...deliverablePages.map((p: any) => ({ key: `page:${p.id}`, label: p.title || "Page sans titre" })),
      ...deliverableDocs.map((d: any) => ({ key: `doc:${d.id}`, label: d.file_name || d.name || "Document" })),
      ...deliverableMedia.map((m: any) => ({ key: `media:${m.id}`, label: m.title || m.file_name || "Média" })),
    ],
    [deliverablePages, deliverableDocs, deliverableMedia],
  );

  /** Éléments déjà envoyés + nouveautés pour un contact donné. */
  const getSendState = (contact: MissionContact) => {
    const rows = (previousSends || []).filter(
      (r) =>
        (r.contact_id && r.contact_id === contact.id) ||
        (!!contact.email && r.email?.toLowerCase() === contact.email.toLowerCase()),
    );
    if (rows.length === 0) return { isUpdate: false, newItems: currentItems, lastSentAt: null as string | null };
    const known = new Set<string>();
    rows.forEach((r) => (r.item_keys || []).forEach((k) => known.add(k)));
    return {
      isUpdate: true,
      newItems: currentItems.filter((i) => !known.has(i.key)),
      lastSentAt: rows[0].sent_at,
    };
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [subjectUpdate, setSubjectUpdate] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const { loading: sending, invoke: invokeSend } = useEdgeFunction(
    "send-mission-deliverables",
    { errorMessage: "Impossible d'envoyer les emails" },
  );

  const contactsWithEmail = useMemo(
    () => (contacts || []).filter((c) => c.email),
    [contacts]
  );
  // Contacts without email are still rendered (greyed out) so users can see
  // the full mission contact list and understand why their "main contact"
  // isn't selectable — just needs an email.
  const allContacts = useMemo(() => contacts || [], [contacts]);

  // Initialize selection & subject when dialog opens
  useEffect(() => {
    if (open && contactsWithEmail.length > 0) {
      const primary = contactsWithEmail.find((c) => c.is_primary);
      setSelectedIds(new Set(primary ? [primary.id] : [contactsWithEmail[0].id]));
      setSubject(`Vos livrables sont disponibles - ${missionTitle}`);
      setSubjectUpdate(`Nouveaux livrables - ${missionTitle}`);
    }
  }, [open, contactsWithEmail, missionTitle]);

  const selectedContacts = contactsWithEmail.filter((c) => selectedIds.has(c.id));
  const hasUpdateRecipient = selectedContacts.some((c) => getSendState(c).isUpdate);

  // Preview using the first selected contact
  const previewContact = selectedContacts[0];
  const previewHtml = useMemo(() => {
    if (!previewContact) return "";
    const useTu = !(previewContact as any).formal_address; // false (default) = tutoiement
    const state = getSendState(previewContact);
    const template = state.isUpdate
      ? (useTu ? DEFAULT_UPDATE_CONTENT_TU : DEFAULT_UPDATE_CONTENT_VOUS)
      : (useTu ? DEFAULT_CONTENT_TU : DEFAULT_CONTENT_VOUS);
    const link = `${window.location.origin}/mission-info/${missionId}`;
    const newItemsHtml = state.newItems.length
      ? `<ul>${state.newItems.map((i) => `<li>${i.label}</li>`).join("")}</ul>`
      : "";
    const processed = processPreviewTemplate(template, {
      first_name: previewContact.first_name || "",
      mission_title: missionTitle,
      deliverables_link: link,
      new_items_html: newItemsHtml,
      new_items_count: String(state.newItems.length),
    });
    return textToHtmlPreview(processed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewContact, missionId, missionTitle, previousSends, currentItems]);


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
    const recipients = selectedContacts.map((c) => ({
      contact_id: c.id,
      email: c.email!,
      first_name: c.first_name || "",
      formal_address: !!(c as any).formal_address,
    }));

    const result = await invokeSend({
      mission_id: missionId,
      recipients,
      subject,
      subject_update: subjectUpdate,
    });
    if (result !== null) {
      toast({
        title: "Emails envoyés",
        description: `${recipients.length} email(s) de livraison envoyé(s) avec succès.`,
      });
      onOpenChange(false);
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
        ) : allContacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Aucun contact pour cette mission.</p>
            <p className="text-xs mt-1">Ajoutez des contacts dans l'onglet Paramètres de la mission.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Recipients */}
            <div>
              <Label className="text-sm font-medium">Destinataires</Label>
              <div className="mt-2 space-y-2">
                {allContacts.map((contact) => {
                  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
                  const hasEmail = !!contact.email;
                  return (
                    <label
                      key={contact.id}
                      className={`flex items-center gap-3 p-2 rounded-lg ${hasEmail ? "hover:bg-muted/50 cursor-pointer" : "opacity-60 cursor-not-allowed"}`}
                      title={hasEmail ? undefined : "Aucun email pour ce contact — non sélectionnable"}
                    >
                      <Checkbox
                        checked={selectedIds.has(contact.id)}
                        onCheckedChange={() => hasEmail && toggleContact(contact.id)}
                        disabled={!hasEmail}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">
                          {name || "Sans nom"}
                        </span>
                        {contact.is_primary && (
                          <span className="text-xs text-yellow-600 ml-1" title="Contact principal">★</span>
                        )}
                        <span className="text-xs text-muted-foreground ml-2">
                          {hasEmail ? contact.email : <em>aucun email</em>}
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
              {contactsWithEmail.length === 0 && (
                <p className="text-xs text-amber-600 mt-2">
                  Aucun contact n'a d'adresse email. Renseignez l'email dans l'onglet Paramètres pour pouvoir l'envoyer.
                </p>
              )}
            </div>

            {/* Shared content recap */}
            <div className="border rounded-lg p-3 bg-muted/30">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Package className="h-4 w-4" />
                Ce qui sera partagé
              </Label>

              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Pages ({deliverablePages.length})
                  </p>
                  {deliverablePages.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Aucune page marquée comme livrable.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {deliverablePages.map((p: any) => (
                        <li
                          key={p.id}
                          className="flex items-center gap-2 text-sm bg-background rounded px-2 py-1.5"
                        >
                          <span className="flex-1 min-w-0 truncate">
                            {p.icon ? `${p.icon} ` : ""}
                            {p.title || "Sans titre"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updatePage.mutate({
                                id: p.id,
                                missionId,
                                updates: { comments_enabled: !p.comments_enabled },
                              })
                            }
                            disabled={updatePage.isPending}
                            title={
                              p.comments_enabled
                                ? "Fermer les commentaires"
                                : "Ouvrir les commentaires pour les destinataires"
                            }
                            className={`shrink-0 h-6 px-2 flex items-center gap-1 rounded text-xs font-medium transition-colors ${
                              p.comments_enabled
                                ? "bg-sky-100 text-sky-800 hover:bg-sky-200"
                                : "bg-muted text-muted-foreground hover:bg-muted/70"
                            }`}
                          >
                            <MessageSquare className="h-3 w-3" />
                            {p.comments_enabled ? "Commentaires ouverts" : "Commentaires fermés"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Documents ({deliverableDocs.length})
                  </p>
                  {deliverableDocs.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Aucun document livrable.</p>
                  ) : (
                    <ul className="space-y-1">
                      {deliverableDocs.map((d: any) => (
                        <li key={d.id} className="flex items-center gap-2 text-sm">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{d.name || d.file_name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Médias ({deliverableMedia.length})
                  </p>
                  {deliverableMedia.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Aucun média livrable.</p>
                  ) : (
                    <ul className="space-y-1">
                      {deliverableMedia.map((m: any) => (
                        <li key={m.id} className="flex items-center gap-2 text-sm">
                          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{m.title || m.file_name || "Média"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
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
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml, { ADD_ATTR: ["target"] }) }}
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
