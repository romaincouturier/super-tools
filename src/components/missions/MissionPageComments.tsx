import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageSquare, Trash2, CheckCircle2, CornerDownRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useConfirm } from "@/hooks/useConfirm";
import { cn } from "@/lib/utils";
import { sanitizeLmsHtml } from "@/lib/sanitizeLmsHtml";
import { splitHtmlIntoBlocks } from "@/lib/missionPageBlocks";
import {
  buildThreads,
  partitionThreads,
  canDeleteComment,
  type CommentThread as Thread,
} from "@/lib/missionPageComments";
import {
  useMissionPageComments,
  useMissionPageCommentActions,
} from "@/hooks/useMissionPageComments";
import type {
  MissionContactByToken,
  MissionPageCommentPublic,
  MissionPagePublic,
} from "@/lib/supabase-rpc";

interface MissionPageCommentsProps {
  missionId: string;
  page: MissionPagePublic;
  /** Contact identifié par le token du lien reçu par email. */
  contact: MissionContactByToken | null;
  contactToken: string | null;
  /** Membre Supertilt connecté : peut répondre, supprimer et clore un fil. */
  isStaff: boolean;
}

const MissionPageComments = ({
  missionId,
  page,
  contact,
  contactToken,
  isStaff,
}: MissionPageCommentsProps) => {
  const { confirm, ConfirmDialog } = useConfirm();
  const { data: allComments } = useMissionPageComments(missionId, page.comments_enabled);
  const { loading, addComment, deleteComment, resolveThread } = useMissionPageCommentActions(
    missionId,
    contactToken,
  );
  const [openBlockId, setOpenBlockId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const blocks = useMemo(() => splitHtmlIntoBlocks(sanitizeLmsHtml(page.content || "")), [page.content]);
  const pageComments = useMemo(
    () => (allComments || []).filter((c) => c.page_id === page.id),
    [allComments, page.id],
  );

  const { byBlock, detached, resolved } = useMemo(() => {
    const blockIds = new Set(blocks.map((b) => b.id));
    return partitionThreads(buildThreads(pageComments), blockIds);
  }, [pageComments, blocks]);

  const canComment = page.comments_enabled && (isStaff || !!contact);

  const handleDelete = async (commentId: string) => {
    const ok = await confirm({
      title: "Supprimer ce commentaire ?",
      description: "Il ne sera plus visible par les autres lecteurs de la page.",
      confirmText: "Supprimer",
      variant: "destructive",
    });
    if (ok) await deleteComment(commentId);
  };

  const canDelete = (comment: MissionPageCommentPublic) =>
    canDeleteComment(comment, { isStaff, contactId: contact?.id ?? null });

  const renderThread = (thread: Thread, quoted?: string | null) => (
    <ThreadView
      key={thread.root.id}
      thread={thread}
      quoted={quoted}
      isStaff={isStaff}
      canComment={canComment}
      loading={loading}
      canDelete={canDelete}
      onDelete={handleDelete}
      onResolve={(isResolved) => resolveThread(thread.root.id, isResolved)}
      onReply={(body) =>
        addComment({
          pageId: page.id,
          body,
          blockId: thread.root.block_id,
          quotedText: thread.root.quoted_text,
          parentCommentId: thread.root.id,
        })
      }
    />
  );

  return (
    <article className="border rounded-lg p-5 bg-card">
      <ConfirmDialog />
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
        {page.icon && <span aria-hidden>{page.icon}</span>}
        <span>{page.title || "Sans titre"}</span>
        {page.comments_enabled && pageComments.length > 0 && (
          <Badge variant="secondary" className="text-xs font-normal">
            <MessageSquare className="h-3 w-3 mr-1" />
            {pageComments.length}
          </Badge>
        )}
      </h3>

      {!page.comments_enabled ? (
        <div
          className="prose prose-sm max-w-none prose-headings:font-semibold prose-img:rounded-lg prose-img:my-3 prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: sanitizeLmsHtml(page.content || "") }}
        />
      ) : (
        <>
          {!canComment && (
            <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              Ouvrez le lien reçu par email pour commenter cette page.
            </div>
          )}

          {blocks.map((block) => {
            const blockThreads = byBlock.get(block.id) || [];
            const isOpen = openBlockId === block.id;
            return (
              <div key={block.id} className="group relative">
                <div className="flex items-start gap-2">
                  <div
                    className="prose prose-sm max-w-none flex-1 min-w-0 prose-headings:font-semibold prose-img:rounded-lg prose-img:my-3 prose-a:text-primary"
                    dangerouslySetInnerHTML={{ __html: block.html }}
                  />
                  <button
                    type="button"
                    onClick={() => setOpenBlockId(isOpen ? null : block.id)}
                    title="Commenter ce passage"
                    aria-label="Commenter ce passage"
                    className={cn(
                      "shrink-0 mt-1 h-7 min-w-7 px-1.5 flex items-center gap-1 rounded-md text-xs transition-colors",
                      "text-muted-foreground hover:bg-muted hover:text-foreground",
                      // Toujours visible au doigt et dès qu'il y a un fil ;
                      // au survol seulement sur les blocs vierges en desktop.
                      blockThreads.length > 0 || isOpen
                        ? "bg-muted/60 text-foreground"
                        : "sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {blockThreads.length > 0 && blockThreads.length}
                  </button>
                </div>

                {(blockThreads.length > 0 || isOpen) && (
                  <div className="ml-0 sm:ml-6 mb-4 space-y-2">
                    {blockThreads.map((thread) => renderThread(thread))}
                    {isOpen && canComment && (
                      <Composer
                        loading={loading}
                        authorLabel={isStaff ? "Supertilt" : contactLabel(contact)}
                        placeholder="Votre commentaire sur ce passage..."
                        onSubmit={async (body) => {
                          const ok = await addComment({
                            pageId: page.id,
                            body,
                            blockId: block.id,
                            quotedText: block.text.slice(0, 300),
                          });
                          if (ok) setOpenBlockId(null);
                          return ok;
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {detached.length > 0 && (
            <div className="mt-6 pt-4 border-t space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Commentaires sur une version précédente
              </p>
              {detached.map((thread) => renderThread(thread, thread.root.quoted_text))}
            </div>
          )}

          {resolved.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowResolved(!showResolved)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {resolved.length} conversation{resolved.length > 1 ? "s" : ""} terminée
                {resolved.length > 1 ? "s" : ""}
              </button>
              {showResolved && (
                <div className="mt-2 space-y-2 opacity-70">
                  {resolved.map((thread) => renderThread(thread, thread.root.quoted_text))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
};

// ── Fil de discussion ───────────────────────────────────────────────

const ThreadView = ({
  thread,
  quoted,
  isStaff,
  canComment,
  loading,
  canDelete,
  onDelete,
  onResolve,
  onReply,
}: {
  thread: Thread;
  quoted?: string | null;
  isStaff: boolean;
  canComment: boolean;
  loading: boolean;
  canDelete: (comment: MissionPageCommentPublic) => boolean;
  onDelete: (commentId: string) => void;
  onResolve: (resolved: boolean) => void;
  onReply: (body: string) => Promise<boolean>;
}) => {
  const [replying, setReplying] = useState(false);

  return (
    <div className="border rounded-lg bg-muted/30 p-3 text-sm">
      {quoted && (
        <blockquote className="mb-2 border-l-2 pl-2 text-xs text-muted-foreground italic line-clamp-2">
          {quoted}
        </blockquote>
      )}

      <CommentView comment={thread.root} canDelete={canDelete(thread.root)} onDelete={onDelete} />

      {thread.replies.map((reply) => (
        <div key={reply.id} className="mt-3 pl-3 border-l">
          <CommentView comment={reply} canDelete={canDelete(reply)} onDelete={onDelete} />
        </div>
      ))}

      <div className="mt-2 flex items-center gap-3">
        {canComment && !thread.root.is_resolved && (
          <button
            type="button"
            onClick={() => setReplying(!replying)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <CornerDownRight className="h-3 w-3" />
            Répondre
          </button>
        )}
        {isStaff && (
          <button
            type="button"
            onClick={() => onResolve(!thread.root.is_resolved)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <CheckCircle2 className="h-3 w-3" />
            {thread.root.is_resolved ? "Rouvrir" : "Marquer terminé"}
          </button>
        )}
      </div>

      {replying && (
        <div className="mt-2">
          <Composer
            loading={loading}
            placeholder="Votre réponse..."
            onSubmit={async (body) => {
              const ok = await onReply(body);
              if (ok) setReplying(false);
              return ok;
            }}
          />
        </div>
      )}
    </div>
  );
};

const CommentView = ({
  comment,
  canDelete,
  onDelete,
}: {
  comment: MissionPageCommentPublic;
  canDelete: boolean;
  onDelete: (commentId: string) => void;
}) => (
  <div>
    <div className="flex items-center gap-2 mb-0.5">
      <span className="font-medium">{comment.author_name}</span>
      {comment.is_staff && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          Supertilt
        </Badge>
      )}
      <span className="text-xs text-muted-foreground">
        {format(parseISO(comment.created_at), "d MMM à HH:mm", { locale: fr })}
      </span>
      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(comment.id)}
          title="Supprimer"
          aria-label="Supprimer le commentaire"
          className="ml-auto text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
    <p className="whitespace-pre-wrap leading-relaxed">{comment.body}</p>
  </div>
);

// ── Saisie ──────────────────────────────────────────────────────────

const Composer = ({
  loading,
  placeholder,
  authorLabel,
  onSubmit,
}: {
  loading: boolean;
  placeholder: string;
  authorLabel?: string;
  onSubmit: (body: string) => Promise<boolean>;
}) => {
  const [value, setValue] = useState("");

  const submit = async () => {
    const body = value.trim();
    if (!body) return;
    const ok = await onSubmit(body);
    if (ok) setValue("");
  };

  return (
    <div className="border rounded-lg bg-background p-2 space-y-2">
      {authorLabel && (
        <p className="text-xs text-muted-foreground">Vous commentez en tant que {authorLabel}</p>
      )}
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="text-sm"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={loading || !value.trim()}>
          {loading && <Spinner className="mr-2" />}
          Envoyer
        </Button>
      </div>
    </div>
  );
};

function contactLabel(contact: MissionContactByToken | null): string {
  if (!contact) return "invité";
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "invité";
}

export default MissionPageComments;
