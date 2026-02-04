import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Link } from "react-router-dom";
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
  Download,
  User,
  Building2,
  Phone,
  Linkedin,
  CheckCircle2,
  Circle,
  Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import DOMPurify from "dompurify";
import {
  CrmCard,
  CrmTag,
  CrmColumn,
  StatusOperational,
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

const CardDetailDrawer = ({
  card,
  open,
  onOpenChange,
  allTags,
  allColumns,
}: CardDetailDrawerProps) => {
  const { user } = useAuth();
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
  const [statusOperational, setStatusOperational] = useState<StatusOperational>("TODAY");
  const [waitingDate, setWaitingDate] = useState("");
  const [waitingText, setWaitingText] = useState("");
  const [salesStatus, setSalesStatus] = useState<SalesStatus>("OPEN");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [quoteUrl, setQuoteUrl] = useState("");
  const [columnId, setColumnId] = useState("");

  // Comment state
  const [newComment, setNewComment] = useState("");

  // Email state
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // Initialize form when card changes
  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescriptionHtml(card.description_html || "");
      setStatusOperational(card.status_operational);
      setWaitingDate(card.waiting_next_action_date || "");
      setWaitingText(card.waiting_next_action_text || "");
      setSalesStatus(card.sales_status);
      setEstimatedValue(String(card.estimated_value || 0));
      setQuoteUrl(card.quote_url || "");
      setColumnId(card.column_id);
    }
  }, [card]);

  const handleSave = async () => {
    if (!card || !user?.email) return;

    // Validation
    if (statusOperational === "WAITING" && (!waitingDate || !waitingText.trim())) {
      return;
    }

    await updateCard.mutateAsync({
      id: card.id,
      updates: {
        title: title.trim(),
        description_html: DOMPurify.sanitize(descriptionHtml),
        status_operational: statusOperational,
        waiting_next_action_date: statusOperational === "WAITING" ? waitingDate : null,
        waiting_next_action_text: statusOperational === "WAITING" ? waitingText.trim() : null,
        sales_status: salesStatus,
        estimated_value: parseFloat(estimatedValue) || 0,
        quote_url: quoteUrl.trim() || null,
        column_id: columnId,
      },
      actorEmail: user.email,
      oldCard: card,
    });
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
  const availableTags = allTags.filter((t) => !cardTags.some((ct) => ct.id === t.id));
  const tagsByCategory = allTags.reduce((acc, tag) => {
    const cat = tag.category || "Autre";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tag);
    return acc;
  }, {} as Record<string, CrmTag[]>);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span className="truncate">{card.title}</span>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={updateCard.isPending}>
                {updateCard.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </SheetTitle>
        </SheetHeader>

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
            {/* Contact info section */}
            {(card.first_name || card.last_name || card.company || card.email || card.phone || card.linkedin_url) && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contact
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {(card.first_name || card.last_name) && (
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span>{[card.first_name, card.last_name].filter(Boolean).join(" ")}</span>
                    </div>
                  )}
                  {card.company && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      <span>{card.company}</span>
                    </div>
                  )}
                  {card.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <a href={`mailto:${card.email}`} className="text-primary hover:underline">
                        {card.email}
                      </a>
                    </div>
                  )}
                  {card.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <a href={`tel:${card.phone}`} className="text-primary hover:underline">
                        {card.phone}
                      </a>
                    </div>
                  )}
                  {card.linkedin_url && (
                    <div className="col-span-2 flex items-center gap-2">
                      <Linkedin className="h-3 w-3 text-muted-foreground" />
                      <a
                        href={card.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        Profil LinkedIn
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
                {card.service_type && (
                  <Badge variant="secondary" className="mt-2">
                    {card.service_type === "formation" ? "Formation" : "Mission"}
                  </Badge>
                )}
              </div>
            )}

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

            {/* Quote button */}
            <div className="flex gap-2">
              {card.service_type === "formation" ? (
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/micro-devis">
                    <Receipt className="h-4 w-4 mr-2" />
                    Créer un devis formation
                  </Link>
                </Button>
              ) : card.quote_url ? (
                <Button asChild variant="outline" className="flex-1">
                  <a href={card.quote_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Voir le devis
                  </a>
                </Button>
              ) : null}
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

            <div>
              <Label>Description (HTML)</Label>
              <Textarea
                value={descriptionHtml}
                onChange={(e) => setDescriptionHtml(e.target.value)}
                rows={4}
                placeholder="Description de l'opportunité..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Statut opérationnel</Label>
                <Select
                  value={statusOperational}
                  onValueChange={(v) => setStatusOperational(v as StatusOperational)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAY">À traiter</SelectItem>
                    <SelectItem value="WAITING">En attente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Statut commercial</Label>
                <Select
                  value={salesStatus}
                  onValueChange={(v) => setSalesStatus(v as SalesStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">En cours</SelectItem>
                    <SelectItem value="WON">Gagné</SelectItem>
                    <SelectItem value="LOST">Perdu</SelectItem>
                    <SelectItem value="CANCELED">Annulé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {statusOperational === "WAITING" && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-amber-50 rounded-lg">
                <div>
                  <Label>Date prochaine action</Label>
                  <Input
                    type="date"
                    value={waitingDate}
                    onChange={(e) => setWaitingDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Action prévue</Label>
                  <Input
                    value={waitingText}
                    onChange={(e) => setWaitingText(e.target.value)}
                    placeholder="Relancer le client"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <Label>URL Devis</Label>
                <Input
                  value={quoteUrl}
                  onChange={(e) => setQuoteUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
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
  };
  return labels[type] || type;
}

export default CardDetailDrawer;
