import { Button } from "@/components/ui/button";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, X, Paperclip, MessageSquare, History, Trash2, ImageIcon, FileText } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDeleteComment, useAddAttachment, useDeleteAttachment } from "@/hooks/useCrmBoard";
import EntityMediaManager from "@/components/media/EntityMediaManager";
import QuoteHistorySection from "@/components/quotes/QuoteHistorySection";
import type { CardDetailState, CardDetailHandlers, CardDetails } from "./types";

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

interface Props {
  state: CardDetailState;
  handlers: CardDetailHandlers;
  details: CardDetails | undefined;
  detailsLoading: boolean;
}

const CardDetailTabs = ({ state, handlers, details, detailsLoading }: Props) => {
  const { user } = useAuth();
  const deleteComment = useDeleteComment();
  const addAttachment = useAddAttachment();
  const deleteAttachment = useDeleteAttachment();
  const { card, newComment, setNewComment } = state;

  return (
    <Tabs defaultValue="comments" className="mt-6 border-t pt-4">
      <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-3">
        Compléments
      </h4>
      <TabsList className="grid grid-cols-3 sm:grid-cols-5 w-full">
        <TabsTrigger value="comments"><MessageSquare className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="attachments"><Paperclip className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="quotes"><FileText className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="media"><ImageIcon className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="activity"><History className="h-4 w-4" /></TabsTrigger>
      </TabsList>

      {/* Comments */}
      <TabsContent value="comments" className="space-y-4 mt-4">
        <div className="flex gap-2">
          <VoiceTextarea placeholder="Ajouter un commentaire..." value={newComment} onValueChange={setNewComment} onChange={(e) => setNewComment(e.target.value)} rows={2} />
          <Button onClick={handlers.handleAddComment} disabled={!newComment.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3">
          {detailsLoading && <Spinner />}
          {details?.comments.length === 0 && <p className="text-sm text-muted-foreground">Aucun commentaire</p>}
          {details?.comments.map((comment) => (
            <div key={comment.id} className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium">{comment.author_email}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(comment.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteComment.mutate(comment.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="mt-2 text-sm">{comment.content}</p>
            </div>
          ))}
        </div>
      </TabsContent>

      {/* Attachments */}
      <TabsContent value="attachments" className="space-y-4 mt-4">
        <div>
          <input type="file" id="file-upload" className="hidden" multiple onChange={handlers.handleFileUpload} />
          <Button variant="outline" onClick={() => document.getElementById("file-upload")?.click()} disabled={addAttachment.isPending}>
            {addAttachment.isPending ? <Spinner className="mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Ajouter des fichiers
          </Button>
        </div>
        <div className="space-y-2">
          {detailsLoading && <Spinner />}
          {details?.attachments.length === 0 && <p className="text-sm text-muted-foreground">Aucune pièce jointe</p>}
          {details?.attachments.map((att) => (
            <div key={att.id} className="flex items-center justify-between p-2 bg-muted rounded">
              <button
                className="flex items-center gap-2 hover:text-primary transition-colors text-left min-w-0"
                onClick={() => {
                  // Bucket is public — getPublicUrl is synchronous so the browser
                  // preserves the user-gesture context and won't block the open.
                  const { data } = supabase.storage
                    .from("crm-attachments")
                    .getPublicUrl(att.file_path);
                  if (data?.publicUrl) {
                    const a = document.createElement("a");
                    a.href = data.publicUrl;
                    a.target = "_blank";
                    a.rel = "noopener";
                    a.click();
                  }
                }}
              >
                <Paperclip className="h-4 w-4 shrink-0" />
                <span className="text-sm truncate underline">{att.file_name}</span>
                {att.file_size && <span className="text-xs text-muted-foreground">({Math.round(att.file_size / 1024)} KB)</span>}
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

      {/* Quotes */}
      <TabsContent value="quotes" className="mt-4">
        <QuoteHistorySection cardId={card.id} />
      </TabsContent>

      {/* Media */}
      <TabsContent value="media" className="mt-4">
        <EntityMediaManager sourceType="crm" sourceId={card.id} sourceLabel={card.title} variant="bare" />
      </TabsContent>

      {/* Activity */}
      <TabsContent value="activity" className="space-y-2 mt-4">
        {detailsLoading && <Spinner />}
        {details?.activity.length === 0 && <p className="text-sm text-muted-foreground">Aucune activité</p>}
        {details?.activity.map((log) => (
          <div key={log.id} className="p-2 border-l-2 border-muted pl-4">
            <p className="text-sm">
              <span className="font-medium">{formatActivityType(log.action_type)}</span>
              {log.old_value && log.new_value && (
                <span className="text-muted-foreground"> : {log.old_value} → {log.new_value}</span>
              )}
              {!log.old_value && log.new_value && (
                <span className="text-muted-foreground"> : {log.new_value}</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {log.actor_email} • {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: fr })}
            </p>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
};

export default CardDetailTabs;
