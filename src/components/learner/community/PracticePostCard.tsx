import { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Trash2, BookOpen, FileText, Smile, MessageSquare, Send, Pin, PinOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import PollDisplay from "@/components/learner/community/PollDisplay";
import EmojiInsert from "@/components/ui/emoji-insert";
import {
  usePracticeComments,
  useCreatePracticeComment,
  useDeletePracticeComment,
  type PracticePost,
} from "@/hooks/usePracticeFeed";
import { authorDisplayName, authorInitialsFromPost } from "@/components/learner/community/authorDisplay";

const REACTION_EMOJIS = [
  { emoji: "👍", label: "J'aime" },
  { emoji: "❤️", label: "J'adore" },
  { emoji: "😂", label: "Hilarant" },
  { emoji: "🤲", label: "Soutien" },
  { emoji: "👏", label: "Bravo" },
];

function StaffBadge() {
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
      style={{ background: "var(--st-ink)", color: "#fff" }}
    >
      Formateur
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
  const { data: comments = [] } = usePracticeComments(showComments ? post.id : null, currentEmail, isAdmin);
  const createComment = useCreatePracticeComment(currentEmail, isAdmin, currentUserName);
  const deleteComment = useDeletePracticeComment(currentEmail, isAdmin);
  const { toast } = useToast();

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
          <p className="text-sm font-semibold leading-tight" style={{ color: "var(--st-ink)" }}>{displayName}</p>
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
      {post.content && (
        <p className="px-4 pb-3 text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--st-ink)" }}>
          {post.content}
        </p>
      )}

      {/* Media: image / video / file */}
      {post.file_url && (
        post.file_mime?.startsWith("image/") ? (
          <img src={post.file_url} alt={post.file_name ?? ""} className="w-full" style={{ maxHeight: 480, objectFit: "cover" }} />
        ) : post.file_mime?.startsWith("video/") ? (
          <video src={post.file_url} controls className="w-full" style={{ maxHeight: 480 }} />
        ) : (
          <a href={post.file_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 mx-4 mb-3 px-3 py-2.5 rounded-xl border text-sm font-medium hover:bg-black/5"
            style={{ borderColor: "rgba(16,24,32,0.12)", color: "var(--st-ink)" }}>
            <FileText size={16} /> {post.file_name ?? "Voir le fichier"}
          </a>
        )
      )}

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
          {REACTION_EMOJIS.filter((e) => (post.reactions_by_type?.[e.emoji] ?? 0) > 0).map((e) => (
            <span
              key={e.emoji}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
              style={{
                background: post.my_reaction_types?.includes(e.emoji) ? "rgba(255,209,0,0.18)" : "rgba(16,24,32,0.05)",
                fontWeight: post.my_reaction_types?.includes(e.emoji) ? 600 : 400,
              }}
            >
              {e.emoji} {post.reactions_by_type[e.emoji]}
            </span>
          ))}
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
            const handleDeleteComment = async () => {
              if (!window.confirm("Supprimer ce commentaire ?")) return;
              try {
                await deleteComment.mutateAsync({ commentId: c.id, postId: post.id });
              } catch {
                toastError(toast, "Impossible de supprimer le commentaire.");
              }
            };
            return (
              <div key={c.id} className="flex items-start gap-2 group">
                <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: c.is_staff_reply ? "var(--st-ink)" : (c.author_photo_url ? "transparent" : "var(--st-yellow)"), color: c.is_staff_reply ? "#fff" : "#101820" }}>
                  {!c.is_staff_reply && c.author_photo_url
                    ? <img src={c.author_photo_url} alt={cName} className="w-full h-full object-cover" />
                    : cInitials}
                </div>
                <div className="flex-1 rounded-xl px-3 py-2" style={{ background: "var(--st-white)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: "var(--st-ink)" }}>{cName}</p>
                      {c.is_staff_reply && <StaffBadge />}
                    </div>
                    {cCanDelete && (
                      <button
                        onClick={handleDeleteComment}
                        className="p-1 rounded hover:bg-black/5 shrink-0 opacity-60 hover:opacity-100"
                        style={{ color: "var(--st-ink-muted)" }}
                        title={cIsOwn ? "Supprimer mon commentaire" : "Supprimer (admin)"}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: "var(--st-ink)" }}>{c.content}</p>
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
