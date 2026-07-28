import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageSquare, Trash2, CheckCircle2, CornerDownRight, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useConfirm } from "@/hooks/useConfirm";
import { cn } from "@/lib/utils";
import { sanitizeLmsHtml } from "@/lib/sanitizeLmsHtml";
import { splitHtmlIntoBlocks } from "@/lib/missionPageBlocks";
import { clearHighlights, highlightQuote, MARK_ATTR } from "@/lib/missionPageHighlights";
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

interface PendingSelection {
  blockId: string;
  quotedText: string;
  top: number;
}

const CARD_GAP = 12;

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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [showResolved, setShowResolved] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [selection, setSelection] = useState<PendingSelection | null>(null);
  const [draft, setDraft] = useState<PendingSelection | null>(null);
  const [anchors, setAnchors] = useState<Record<string, number>>({});
  const [isWide, setIsWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const html = useMemo(() => sanitizeLmsHtml(page.content || ""), [page.content]);
  const blocks = useMemo(() => splitHtmlIntoBlocks(html), [html]);
  const pageComments = useMemo(
    () => (allComments || []).filter((c) => c.page_id === page.id),
    [allComments, page.id],
  );

  const { byBlock, detached, resolved } = useMemo(() => {
    const blockIds = new Set(blocks.map((b) => b.id));
    return partitionThreads(buildThreads(pageComments), blockIds);
  }, [pageComments, blocks]);

  /** Fils ouverts et ancrés, dans l'ordre du document. */
  const anchoredThreads = useMemo(() => {
    const list: Thread[] = [];
    for (const block of blocks) {
      for (const thread of byBlock.get(block.id) || []) list.push(thread);
    }
    return list;
  }, [blocks, byBlock]);

  const canComment = page.comments_enabled && (isStaff || !!contact);

  // ── Surlignage des citations + calcul des ancres ──────────────────
  const computeAnchors = useCallback(() => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container) return;

    clearHighlights(content);
    const containerTop = container.getBoundingClientRect().top;
    const raw: { id: string; top: number }[] = [];

    for (const thread of anchoredThreads) {
      const blockEl = content.querySelector<HTMLElement>(
        `[data-block-id="${CSS.escape(thread.root.block_id || "")}"]`,
      );
      if (!blockEl) continue;
      const mark = thread.root.quoted_text
        ? highlightQuote(blockEl, thread.root.quoted_text, thread.root.id)
        : null;
      const target = mark || blockEl;
      raw.push({ id: thread.root.id, top: target.getBoundingClientRect().top - containerTop });
    }

    if (draft) {
      raw.push({ id: "__draft__", top: draft.top });
    }

    raw.sort((a, b) => a.top - b.top);
    const next: Record<string, number> = {};
    let cursor = 0;
    for (const item of raw) {
      const top = Math.max(item.top, cursor);
      next[item.id] = top;
      const height = cardRefs.current.get(item.id)?.offsetHeight ?? 120;
      cursor = top + height + CARD_GAP;
    }
    setAnchors((prev) => {
      const same =
        Object.keys(prev).length === Object.keys(next).length &&
        Object.keys(next).every((k) => Math.abs((prev[k] ?? -1) - next[k]) < 1);
      return same ? prev : next;
    });
  }, [anchoredThreads, draft]);

  useLayoutEffect(() => {
    if (!page.comments_enabled) return;
    if (!isWide) {
      // En colonne étroite, on surligne quand même les passages cités.
      const content = contentRef.current;
      if (!content) return;
      clearHighlights(content);
      for (const thread of anchoredThreads) {
        const blockEl = content.querySelector<HTMLElement>(
          `[data-block-id="${CSS.escape(thread.root.block_id || "")}"]`,
        );
        if (blockEl && thread.root.quoted_text) {
          highlightQuote(blockEl, thread.root.quoted_text, thread.root.id);
        }
      }
      return;
    }
    computeAnchors();
  }, [computeAnchors, anchoredThreads, isWide, page.comments_enabled, html]);

  useEffect(() => {
    if (!isWide || !page.comments_enabled) return;
    const onResize = () => computeAnchors();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [computeAnchors, isWide, page.comments_enabled]);

  // Marque active
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    content.querySelectorAll<HTMLElement>(`mark[${MARK_ATTR}]`).forEach((mark) => {
      mark.toggleAttribute("data-active", mark.getAttribute(MARK_ATTR) === activeThreadId);
    });
  }, [activeThreadId, anchors]);

  // Clic sur un surlignage → active le fil correspondant
  const handleContentClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const mark = (event.target as HTMLElement).closest?.(`mark[${MARK_ATTR}]`);
    if (mark) setActiveThreadId(mark.getAttribute(MARK_ATTR));
  };

  // ── Sélection de texte ────────────────────────────────────────────
  const handleSelection = useCallback(() => {
    if (!canComment) return;
    const content = contentRef.current;
    const container = containerRef.current;
    const sel = window.getSelection();
    if (!content || !container || !sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!content.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }
    const text = sel.toString().replace(/\s+/g, " ").trim();
    if (text.length < 2) {
      setSelection(null);
      return;
    }
    const startEl =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as HTMLElement)
        : range.startContainer.parentElement;
    const blockEl = startEl?.closest<HTMLElement>("[data-block-id]");
    if (!blockEl) {
      setSelection(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    setSelection({
      blockId: blockEl.dataset.blockId!,
      quotedText: text.slice(0, 300),
      top: rect.top - container.getBoundingClientRect().top,
    });
  }, [canComment]);

  const openDraft = () => {
    if (!selection) return;
    setDraft(selection);
    setActiveThreadId("__draft__");
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  // ── Actions ───────────────────────────────────────────────────────
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

  const registerCard = (id: string) => (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  };

  const renderThread = (thread: Thread, options?: { positioned?: boolean }) => (
    <ThreadView
      key={thread.root.id}
      ref={options?.positioned ? registerCard(thread.root.id) : undefined}
      thread={thread}
      quoted={thread.root.quoted_text}
      isStaff={isStaff}
      canComment={canComment}
      loading={loading}
      active={activeThreadId === thread.root.id}
      onActivate={() => setActiveThreadId(thread.root.id)}
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
      style={
        options?.positioned
          ? { position: "absolute", top: anchors[thread.root.id] ?? 0, left: 0, right: 0 }
          : undefined
      }
    />
  );

  const draftCard = draft && canComment && (
    <div
      ref={registerCard("__draft__")}
      className="rounded-lg border border-primary/40 bg-card p-3 text-sm shadow-sm"
      style={isWide ? { position: "absolute", top: anchors["__draft__"] ?? draft.top, left: 0, right: 0 } : undefined}
    >
      <div className="flex items-start gap-2 mb-2">
        <blockquote className="flex-1 border-l-2 border-primary/50 pl-2 text-xs text-muted-foreground italic line-clamp-3">
          {draft.quotedText}
        </blockquote>
        <button
          type="button"
          onClick={() => setDraft(null)}
          aria-label="Annuler le commentaire"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <Composer
        loading={loading}
        autoFocus
        authorLabel={isStaff ? "Supertilt" : contactLabel(contact)}
        placeholder="Votre commentaire sur ce passage..."
        onSubmit={async (body) => {
          const ok = await addComment({
            pageId: page.id,
            body,
            blockId: draft.blockId,
            quotedText: draft.quotedText,
          });
          if (ok) setDraft(null);
          return ok;
        }}
      />
    </div>
  );

  const content = (
    <div
      ref={contentRef}
      onMouseUp={handleSelection}
      onTouchEnd={handleSelection}
      onClick={handleContentClick}
      className="prose prose-sm max-w-none prose-headings:font-semibold prose-img:rounded-lg prose-img:my-3 prose-a:text-primary"
    >
      {blocks.map((block) => (
        <div key={block.id} data-block-id={block.id} dangerouslySetInnerHTML={{ __html: block.html }} />
      ))}
    </div>
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
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <>
          {!canComment ? (
            <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              Ouvrez le lien reçu par email pour commenter cette page.
            </div>
          ) : (
            <div className="mb-4 text-xs text-muted-foreground">
              Sélectionnez un passage du texte pour le commenter.
            </div>
          )}

          <div ref={containerRef} className="relative lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
            <div className="relative min-w-0">
              {content}

              {selection && canComment && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={openDraft}
                  className="absolute z-20 -translate-y-full flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground shadow-md"
                  style={{ top: selection.top - 6, right: 0 }}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Commenter
                </button>
              )}
            </div>

            {/* Marge des commentaires */}
            <aside className={cn("relative mt-6 lg:mt-0 space-y-3", isWide && "lg:space-y-0")}>
              {isWide ? (
                <>
                  {anchoredThreads.map((thread) => renderThread(thread, { positioned: true }))}
                  {draftCard}
                </>
              ) : (
                <>
                  {draftCard}
                  {anchoredThreads.map((thread) => renderThread(thread))}
                </>
              )}
              {anchoredThreads.length === 0 && !draft && (
                <p className="text-xs text-muted-foreground italic hidden lg:block">
                  Aucun commentaire sur cette page.
                </p>
              )}
            </aside>
          </div>

          {detached.length > 0 && (
            <div className="mt-6 pt-4 border-t space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Commentaires sur une version précédente
              </p>
              {detached.map((thread) => renderThread(thread))}
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
                  {resolved.map((thread) => renderThread(thread))}
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

interface ThreadViewProps {
  thread: Thread;
  quoted?: string | null;
  isStaff: boolean;
  canComment: boolean;
  loading: boolean;
  active?: boolean;
  onActivate?: () => void;
  canDelete: (comment: MissionPageCommentPublic) => boolean;
  onDelete: (commentId: string) => void;
  onResolve: (resolved: boolean) => void;
  onReply: (body: string) => Promise<boolean>;
  style?: React.CSSProperties;
}

const ThreadView = ({
  ref,
  thread,
  quoted,
  isStaff,
  canComment,
  loading,
  active,
  onActivate,
  canDelete,
  onDelete,
  onResolve,
  onReply,
  style,
}: ThreadViewProps & { ref?: (el: HTMLDivElement | null) => void }) => {
  const [replying, setReplying] = useState(false);

  return (
    <div
      ref={ref}
      style={style}
      onClick={onActivate}
      className={cn(
        "rounded-lg border bg-card p-3 text-sm transition-shadow",
        active ? "border-primary/50 shadow-md" : "shadow-sm hover:shadow",
      )}
    >
      {quoted && (
        <blockquote className="mb-2 border-l-2 border-primary/40 pl-2 text-xs text-muted-foreground italic line-clamp-2">
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
            autoFocus
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
  autoFocus,
  onSubmit,
}: {
  loading: boolean;
  placeholder: string;
  authorLabel?: string;
  autoFocus?: boolean;
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
    <div className="space-y-2">
      {authorLabel && (
        <p className="text-xs text-muted-foreground">Vous commentez en tant que {authorLabel}</p>
      )}
      <Textarea
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
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
