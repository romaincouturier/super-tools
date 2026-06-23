import { useState, useRef, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Trash2, BookOpen, FileText, Smile, MessageSquare, Send, Pin, PinOff, RotateCcw, RotateCw, Pencil, Check, X, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import PollDisplay from "@/components/learner/community/PollDisplay";
import GroupMatchingBlock from "@/components/learner/community/GroupMatchingBlock";
import EmojiInsert from "@/components/ui/emoji-insert";
import {
  usePracticeComments,
  useCreatePracticeComment,
  useDeletePracticeComment,
  useUpdatePracticeComment,
  useUpdatePracticePost,
  useRotatePracticePostImage,
  type PracticePost,
} from "@/hooks/usePracticeFeed";
import { authorDisplayName, authorInitialsFromPost } from "@/components/learner/community/authorDisplay";
import ImageLightbox from "@/components/ui/image-lightbox";
import { asciiToEmoji } from "@/lib/asciiEmoji";

/**
 * Render post text supporting [label](url) markdown links and bare URLs.
 * Returns a list of React nodes; non-link segments stay as plain text so
 * `whitespace-pre-wrap` keeps formatting.
 */
function renderPostContent(text: string): (string | JSX.Element)[] {
  const nodes: (string | JSX.Element)[] = [];
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const [, mdLabel, mdUrl, bareUrl] = match;
    const href = mdUrl || bareUrl!;
    const label = mdLabel || href;
    nodes.push(
      <a
        key={`lnk-${key++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
        style={{ color: "var(--st-primary, #2563eb)" }}
      >
        {label}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

const REACTION_EMOJIS = [
  { emoji: "👍", label: "J'aime" },
  { emoji: "❤️", label: "J'adore" },
  { emoji: "😂", label: "Hilarant" },
  { emoji: "🤲", label: "Soutien" },
  { emoji: "👏", label: "Bravo" },
];

/**
 * Re-encode a stored file URL so reserved chars left raw in the path
 * (notably `@` from email folders) don't break the browser's PDF viewer
 * or trigger phishing-style URL warnings.
 */
function safeFileUrl(url: string): string {
  try {
    const u = new URL(url);
    u.pathname = u.pathname
      .split("/")
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join("/");
    return u.toString();
  } catch {
    return url;
  }
}

function StaffBadge() {
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
      style={{ background: "var(--st-ink)", color: "#fff" }}
    >
      Staff
    </span>
  );
}

export default function PracticePostCard({
  post,
  currentEmail,
  isAdmin,
  currentUserName,
  onReact,
  onDelete,
  onVote,
  onSelectTag,
  onPin,
}: {
  post: PracticePost;
  currentEmail: string;
  isAdmin: boolean;
  /** Display name stored on the reply when an admin/trainer comments. */
  currentUserName?: string | null;
  onReact: (postId: string, emoji: string, iReacted: boolean) => void;
  onDelete: (postId: string) => void;
  onVote: (pollId: string, optionId: string, currentOptionId: string | null) => void;
  onSelectTag: (tag: string) => void;
  onPin?: (postId: string, pin: boolean) => void;
}) {
  const [showComments, setShowComments] = useState(post.comment_count > 0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handle = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showEmojiPicker]);
  const [commentText, setCommentText] = useState("");
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(false);
  const { data: comments = [] } = usePracticeComments(showComments ? post.id : null, currentEmail, isAdmin);
  const createComment = useCreatePracticeComment(currentEmail, isAdmin, currentUserName);
  const deleteComment = useDeletePracticeComment(currentEmail, isAdmin);
  const updateComment = useUpdatePracticeComment(currentEmail, isAdmin);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingPost, setEditingPost] = useState(false);
  const [editingPostText, setEditingPostText] = useState("");
  const updatePost = useUpdatePracticePost(currentEmail, isAdmin);
  const { toast } = useToast();
  const rotateImage = useRotatePracticePostImage();

  const displayName = authorDisplayName(post.author_email, post.author_first_name, post.author_last_name);
  const initials = authorInitialsFromPost(post.author_email, post.author_first_name, post.author_last_name);
  const isOwn = (post.author_email || "").toLowerCase() === (currentEmail || "").toLowerCase();
  const canDelete = isOwn || isAdmin;

  const handleComment = async () => {
    if (!commentText.trim()) return;
    try {
      await createComment.mutateAsync({ postId: post.id, content: commentText.trim() });
      setCommentText("");
    } catch {
      toastError(toast, "Impossible d'envoyer le commentaire.");
    }
  };

  const handleFileDownload = async (fileHref: string) => {
    try {
      setDownloadingFile(true);
      const response = await fetch(fileHref);
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = post.file_name || "fichier";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      toastError(toast, "Impossible de télécharger ce fichier.");
    } finally {
      setDownloadingFile(false);
    }
  };

  return (
    <div className="rounded-2xl border space-y-0 overflow-hidden"
      style={{ background: "var(--st-white)", borderColor: post.is_pinned ? "rgba(255,209,0,0.6)" : "rgba(16,24,32,0.08)" }}>
      {/* Pinned banner */}
      {post.is_pinned && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold"
          style={{ background: "rgba(255,209,0,0.15)", color: "var(--st-ink)" }}>
          <Pin size={12} />
          Épinglé
        </div>
      )}
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: post.author_photo_url ? "transparent" : "var(--st-yellow)", color: "#101820" }}>
          {post.author_photo_url
            ? <img src={post.author_photo_url} alt={displayName} className="w-full h-full object-cover" />
            : initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight flex items-center gap-1.5" style={{ color: "var(--st-ink)" }}>
            {displayName}
            {post.author_is_staff && <StaffBadge />}
          </p>
          <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
            {formatDistanceToNow(new Date(post.created_at), { locale: fr, addSuffix: true })}
          </p>
        </div>
        {isAdmin && onPin && (
          <button
            onClick={() => onPin(post.id, !post.is_pinned)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors shrink-0"
            style={{ color: post.is_pinned ? "var(--st-yellow, #FFD100)" : "var(--st-ink-muted)" }}
            title={post.is_pinned ? "Désépingler" : "Épingler"}
          >
            {post.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
        )}
        {canDelete && post.content && (
          <button
            onClick={() => { setEditingPostText(post.content ?? ""); setEditingPost(true); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors shrink-0"
            style={{ color: "var(--st-ink-muted)" }}
            title={isOwn ? "Modifier mon message" : "Modifier (admin)"}
          >
            <Pencil size={14} />
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => onDelete(post.id)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors shrink-0"
            style={{ color: "var(--st-ink-muted)" }}
            title={isOwn ? "Supprimer mon message" : "Supprimer (admin)"}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Lesson origin badge */}
      {post.lesson_id && post.course_id && (
        <a
          href={`/lms/${post.course_id}/player?email=${encodeURIComponent(currentEmail)}&lesson=${post.lesson_id}`}
          className="mx-4 mb-3 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full hover:underline w-fit"
          style={{ background: "rgba(255,209,0,0.15)", color: "var(--st-ink)" }}
          title="Voir la leçon d'origine"
        >
          <BookOpen size={12} />
          <span>Depuis la leçon : <strong>{post.lesson_title ?? "voir"}</strong></span>
        </a>
      )}

      {/* Content */}
      {post.content && !editingPost && (
        <p className="px-4 pb-3 text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--st-ink)" }}>
          {renderPostContent(asciiToEmoji(post.content))}
        </p>
      )}
      {editingPost && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          <textarea
            className="w-full text-sm rounded-lg border px-3 py-2 resize-none focus:outline-none focus:ring-2"
            style={{ borderColor: "rgba(16,24,32,0.15)", minHeight: 80, color: "var(--st-ink)", background: "var(--st-surface, #fff)" }}
            value={editingPostText}
            onChange={(e) => setEditingPostText(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setEditingPost(false)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg hover:bg-black/5 transition-colors"
              style={{ color: "var(--st-ink-muted)" }}
            >
              <X size={13} /> Annuler
            </button>
            <button
              onClick={async () => {
                const trimmed = editingPostText.trim();
                if (!trimmed) return;
                try {
                  await updatePost.mutateAsync({ postId: post.id, content: trimmed });
                  setEditingPost(false);
                } catch (err) {
                  toastError(toast, err);
                }
              }}
              disabled={updatePost.isPending || !editingPostText.trim()}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-50"
              style={{ background: "var(--st-ink)", color: "#fff" }}
            >
              <Check size={13} /> Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Group matching — between text and media */}
      <GroupMatchingBlock postId={post.id} currentEmail={currentEmail} />

      {/* Media: image / video / file */}
      {post.file_url && (() => {
        const fileHref = safeFileUrl(post.file_url);
        const rotation = ((post.file_rotation ?? 0) % 360 + 360) % 360;
        const isRotated = rotation % 180 === 90;
        // Container always uses the ORIGINAL natural aspect so the post box
        // takes the same width/height as a non-rotated image. The image
        // inside is then rotated and sized via container queries to fill it.
        const aspect = naturalSize ? naturalSize.w / naturalSize.h : undefined;
        return post.file_mime?.startsWith("image/") ? (
          <div
            className="relative w-full overflow-hidden flex items-center justify-center"
            style={{
              aspectRatio: aspect,
              maxHeight: 480,
              background: "rgba(16,24,32,0.04)",
              containerType: isRotated ? "size" : undefined,
            }}
          >
            <img
              src={fileHref}
              alt={post.file_name ?? ""}
              onLoad={(e) => setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onClick={() => setLightboxOpen(true)}
              style={{
                width: isRotated ? "100cqh" : "100%",
                height: isRotated ? "100cqw" : "100%",
                objectFit: "contain",
                transform: `rotate(${rotation}deg)`,
                transformOrigin: "center",
                transition: "transform 0.3s ease",
                display: "block",
                cursor: "zoom-in",
              }}
            />
            {lightboxOpen && (
              <ImageLightbox src={fileHref} alt={post.file_name ?? undefined} rotation={rotation} onClose={() => setLightboxOpen(false)} />
            )}
            {isAdmin && (
              <div className="absolute bottom-2 right-2 flex gap-1 z-10">
                <button
                  onClick={() => rotateImage.mutate({ postId: post.id, rotation: (post.file_rotation ?? 0) - 90 })}
                  className="bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                  title="Tourner à gauche"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => rotateImage.mutate({ postId: post.id, rotation: (post.file_rotation ?? 0) + 90 })}
                  className="bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                  title="Tourner à droite"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ) : post.file_mime?.startsWith("video/") ? (
          <video src={fileHref} controls className="w-full" style={{ maxHeight: 480 }} />
        ) : (
          <button
            type="button"
            onClick={() => handleFileDownload(fileHref)}
            disabled={downloadingFile}
            className="flex flex-col items-center justify-center gap-2 w-full px-4 py-10 hover:bg-black/5 transition-colors"
            style={{ background: "rgba(16,24,32,0.04)", color: "var(--st-ink)", minHeight: 220 }}
            title={post.file_name ?? "Télécharger le fichier"}
          >
            <FileText size={48} style={{ color: "var(--st-ink-muted)" }} />
            <span className="text-sm font-medium text-center break-all px-4">
              {post.file_name ?? "Télécharger le fichier"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--st-ink-muted)" }}>
              <Download size={14} />
              {downloadingFile ? "Préparation..." : "Télécharger"}
            </span>
          </button>
        );
      })()}

      {/* Poll */}
      {post.poll && <PollDisplay poll={post.poll} onVote={onVote} />}

      {/* Hashtags */}

      {post.hashtags.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {post.hashtags.map((tag) => (
            <button
              key={tag}
              onClick={() => onSelectTag(tag)}
              className="text-xs px-2 py-0.5 rounded-full font-medium transition-colors hover:bg-black/5"
              style={{ background: "rgba(16,24,32,0.05)", color: "var(--st-ink-muted)" }}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Reaction bar — per-emoji counts + comment count */}
      {(post.reaction_count > 0 || post.comment_count > 0) && (
        <div className="px-4 py-2 flex items-center gap-2 flex-wrap text-xs border-t" style={{ borderColor: "rgba(16,24,32,0.06)", color: "var(--st-ink-muted)" }}>
          <TooltipProvider delayDuration={300}>
            {REACTION_EMOJIS.filter((e) => (post.reactions_by_type?.[e.emoji] ?? 0) > 0).map((e) => {
              const users = post.reactions_by_type_users?.[e.emoji] ?? [];
              const label = users.length <= 5
                ? users.join(", ")
                : `${users.slice(0, 5).join(", ")} +${users.length - 5}`;
              return (
                <Tooltip key={e.emoji}>
                  <TooltipTrigger asChild>
                    <span
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-full cursor-default"
                      style={{
                        background: post.my_reaction_types?.includes(e.emoji) ? "rgba(255,209,0,0.18)" : "rgba(16,24,32,0.05)",
                        fontWeight: post.my_reaction_types?.includes(e.emoji) ? 600 : 400,
                      }}
                    >
                      {e.emoji} {post.reactions_by_type[e.emoji]}
                    </span>
                  </TooltipTrigger>
                  {users.length > 0 && (
                    <TooltipContent side="top" className="max-w-[220px] text-center text-xs">
                      {label}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </TooltipProvider>
          {post.comment_count > 0 && (
            <button onClick={() => setShowComments(v => !v)} className="hover:underline ml-auto" style={{ fontFamily: "inherit" }}>
              {post.comment_count} commentaire{post.comment_count > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex border-t relative" style={{ borderColor: "rgba(16,24,32,0.06)" }}>
        {/* Emoji picker popup */}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-full left-0 mb-2 flex items-center gap-1 px-2 py-1.5 rounded-2xl shadow-lg border z-10"
            style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.1)" }}
          >
            {REACTION_EMOJIS.map((e) => {
              const already = post.my_reaction_types?.includes(e.emoji);
              return (
                <button
                  key={e.emoji}
                  onClick={() => { onReact(post.id, e.emoji, already); setShowEmojiPicker(false); }}
                  title={e.label}
                  className="text-xl leading-none transition-transform hover:scale-125 px-1"
                  style={{
                    fontFamily: "inherit",
                    background: already ? "rgba(255,209,0,0.2)" : "transparent",
                    borderRadius: 8,
                  }}
                >
                  {e.emoji}
                </button>
              );
            })}
          </div>
        )}
        <button
          onClick={() => setShowEmojiPicker(v => !v)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors hover:bg-black/5"
          style={{ color: post.i_reacted ? "var(--st-yellow, #FFD100)" : "var(--st-ink-muted)", fontFamily: "inherit" }}
        >
          <Smile size={16} />
          Réagir
        </button>
        <button
          onClick={() => setShowComments(v => !v)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors hover:bg-black/5 border-l"
          style={{ color: "var(--st-ink-muted)", borderColor: "rgba(16,24,32,0.06)", fontFamily: "inherit" }}
        >
          <MessageSquare size={16} />
          Commenter
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: "rgba(16,24,32,0.06)", background: "var(--st-surface, #F2F4F4)" }}>
          {comments.map((c) => {
            const cName = c.is_staff_reply && c.author_display_name
              ? c.author_display_name
              : authorDisplayName(c.author_email, c.author_first_name, c.author_last_name);
            const cInitials = c.is_staff_reply && c.author_display_name
              ? authorInitialsFromPost("", c.author_display_name.split(" ")[0], c.author_display_name.split(" ")[1])
              : authorInitialsFromPost(c.author_email, c.author_first_name, c.author_last_name);
            const cIsOwn = (c.author_email || "").toLowerCase() === (currentEmail || "").toLowerCase();
            const cCanDelete = cIsOwn || isAdmin;
            const cCanEdit = cIsOwn || isAdmin;
            const isEditing = editingCommentId === c.id;
            const handleDeleteComment = async () => {
              if (!window.confirm("Supprimer ce commentaire ?")) return;
              try {
                await deleteComment.mutateAsync({ commentId: c.id, postId: post.id });
              } catch {
                toastError(toast, "Impossible de supprimer le commentaire.");
              }
            };
            const startEdit = () => {
              setEditingCommentId(c.id);
              setEditingText(c.content);
            };
            const cancelEdit = () => {
              setEditingCommentId(null);
              setEditingText("");
            };
            const saveEdit = async () => {
              const trimmed = editingText.trim();
              if (!trimmed || trimmed === c.content) {
                cancelEdit();
                return;
              }
              try {
                await updateComment.mutateAsync({ commentId: c.id, postId: post.id, content: trimmed });
                cancelEdit();
              } catch {
                toastError(toast, "Impossible de modifier le commentaire.");
              }
            };
            return (
              <div key={c.id} className="flex items-start gap-2 group">
                <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: c.author_photo_url ? "transparent" : (c.is_staff_reply ? "var(--st-ink)" : "var(--st-yellow)"), color: c.is_staff_reply ? "#fff" : "#101820" }}>
                  {c.author_photo_url
                    ? <img src={c.author_photo_url} alt={cName} className="w-full h-full object-cover" />
                    : cInitials}
                </div>
                <div className="flex-1 rounded-xl px-3 py-2" style={{ background: "var(--st-white)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: "var(--st-ink)" }}>{cName}</p>
                      {c.is_staff_reply && <StaffBadge />}
                      <span className="text-[10px] shrink-0" style={{ color: "var(--st-ink-muted)" }}>
                        {formatDistanceToNow(new Date(c.created_at), { locale: fr, addSuffix: true })}
                      </span>
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {cCanEdit && (
                          <button
                            onClick={startEdit}
                            className="p-1 rounded hover:bg-black/5 opacity-60 hover:opacity-100"
                            style={{ color: "var(--st-ink-muted)" }}
                            title="Modifier mon commentaire"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {cCanDelete && (
                          <button
                            onClick={handleDeleteComment}
                            className="p-1 rounded hover:bg-black/5 opacity-60 hover:opacity-100"
                            style={{ color: "var(--st-ink-muted)" }}
                            title={cIsOwn ? "Supprimer mon commentaire" : "Supprimer (admin)"}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="flex-1 text-sm bg-transparent outline-none border-b"
                        style={{ color: "var(--st-ink)", borderColor: "rgba(16,24,32,0.2)", fontFamily: "inherit" }}
                      />
                      <button
                        onClick={saveEdit}
                        disabled={updateComment.isPending || !editingText.trim()}
                        className="p-1 rounded hover:bg-black/5 disabled:opacity-40"
                        style={{ color: "var(--st-ink)" }}
                        title="Enregistrer"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1 rounded hover:bg-black/5"
                        style={{ color: "var(--st-ink-muted)" }}
                        title="Annuler"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm mt-0.5 whitespace-pre-wrap" style={{ color: "var(--st-ink)" }}>{asciiToEmoji(c.content)}</p>
                  )}
                </div>
              </div>
            );
          })}
          {/* Comment input */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-full border px-3 py-1.5"
              style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.12)" }}>
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleComment()}
                placeholder="Ajouter un commentaire..."
                className="flex-1 text-sm bg-transparent outline-none"
                style={{ color: "var(--st-ink)", fontFamily: "inherit" }}
              />
              <EmojiInsert onInsert={(e) => setCommentText((t) => t + e)} />
            </div>
            <button
              onClick={handleComment}
              disabled={!commentText.trim() || createComment.isPending}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
              style={{ background: "var(--st-yellow)", color: "#101820" }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
