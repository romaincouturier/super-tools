import { useState } from "react";
import {
  usePracticePosts,
  useCreatePracticePost,
  usePracticeComments,
  useCreatePracticeComment,
  useDeletePracticePost,
  useDeletePracticeComment,
} from "@/hooks/usePracticeFeed";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import EmojiInsert from "@/components/ui/emoji-insert";

interface Props {
  courseId: string;
  lessonId: string;
  learnerEmail: string;
  learnerName: string;
}

function initials(email: string, first?: string | null, last?: string | null) {
  const f = (first || "").trim();
  const l = (last || "").trim();
  if (f || l) return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase() || email[0].toUpperCase();
  return email[0]?.toUpperCase() ?? "?";
}
function displayName(email: string, first?: string | null, last?: string | null) {
  const name = `${first ?? ""} ${last ?? ""}`.trim();
  return name || email;
}

function PostThread({
  post,
  learnerEmail,
  onDelete,
}: {
  post: any;
  learnerEmail: string;
  onDelete: (id: string) => void;
}) {
  const { data: comments = [] } = usePracticeComments(post.id, learnerEmail);
  const createComment = useCreatePracticeComment(learnerEmail);
  const deleteComment = useDeletePracticeComment(learnerEmail, false);
  const [text, setText] = useState("");
  const { toast } = useToast();
  const isOwn = post.author_email === learnerEmail;

  const handleSend = async () => {
    if (!text.trim()) return;
    try {
      await createComment.mutateAsync({ postId: post.id, content: text.trim() });
      setText("");
    } catch {
      toast({ title: "Erreur lors de l'envoi", variant: "destructive" });
    }
  };

  return (
    <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-3">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold shrink-0">
          {post.author_photo_url
            ? <img src={post.author_photo_url} alt="" className="w-full h-full rounded-full object-cover" />
            : initials(post.author_email, post.author_first_name, post.author_last_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{displayName(post.author_email, post.author_first_name, post.author_last_name)}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { locale: fr, addSuffix: true })}
            </span>
          </div>
          {post.content && <p className="whitespace-pre-wrap mt-1">{post.content}</p>}
          {post.file_url && post.file_mime?.startsWith("image/") && (
            <img src={post.file_url} alt="" className="mt-2 rounded-md max-h-60" />
          )}
        </div>
        {isOwn && (
          <button
            onClick={() => onDelete(post.id)}
            className="p-1 rounded hover:bg-black/5 text-muted-foreground"
            title="Supprimer mon message"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {comments.length > 0 && (
        <div className="space-y-2 pl-10">
          {comments.map((c) => {
            const cOwn = c.author_email === learnerEmail;
            return (
              <div key={c.id} className="bg-background rounded-md px-3 py-2 flex items-start justify-between gap-2 group">
                <div className="min-w-0">
                  <div className="text-xs font-medium">
                    {displayName(c.author_email, c.author_first_name, c.author_last_name)}
                  </div>
                  <p className="text-sm">{c.content}</p>
                </div>
                {cOwn && (
                  <button
                    onClick={async () => {
                      if (!window.confirm("Supprimer ce commentaire ?")) return;
                      try { await deleteComment.mutateAsync({ commentId: c.id, postId: post.id }); }
                      catch { toast({ title: "Erreur", variant: "destructive" }); }
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/5 text-muted-foreground shrink-0"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 pl-10">
        <div className="flex-1 flex items-center gap-1 bg-background border rounded-full px-3 py-1.5">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Répondre..."
            className="flex-1 text-sm bg-transparent outline-none"
          />
          <EmojiInsert onInsert={(e) => setText((t) => t + e)} size={14} />
        </div>
        <Button size="sm" onClick={handleSend} disabled={!text.trim() || createComment.isPending}>
          <Send className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

export default function LessonComments({ courseId, lessonId, learnerEmail }: Props) {
  const { data: posts = [] } = usePracticePosts(learnerEmail, 50, { lessonId });
  const createPost = useCreatePracticePost(learnerEmail);
  const deletePost = useDeletePracticePost(learnerEmail, false);
  const [content, setContent] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!content.trim()) return;
    try {
      await createPost.mutateAsync({
        content: content.trim(),
        file: null,
        courseId,
        lessonId,
      });
      setContent("");
      toast({ title: "Message publié dans la communauté !" });
      // Notify admin (preserves prior behaviour)
      try {
        await supabase.functions.invoke("notify-lms-comment", {
          body: {
            lessonId,
            courseId,
            learnerEmail,
            learnerName: learnerEmail,
            comment: content.trim(),
          },
        });
      } catch (e) {
        console.warn("Failed to notify admin:", e);
      }
    } catch {
      toast({ title: "Erreur lors de l'envoi", variant: "destructive" });
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!window.confirm("Supprimer ce message ?")) return;
    try { await deletePost.mutateAsync(id); }
    catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  return (
    <div className="border-t pt-4 mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageCircle className="w-4 h-4" />
        {posts.length > 0 ? `${posts.length} message(s) de la communauté` : "Laisser un commentaire"}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {posts.map((p) => (
            <PostThread key={p.id} post={p} learnerEmail={learnerEmail} onDelete={handleDeletePost} />
          ))}

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Textarea
                placeholder="Partagez une question ou un retour avec la communauté..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={2}
                className="pr-10"
              />
              <div className="absolute bottom-2 right-2">
                <EmojiInsert onInsert={(e) => setContent((t) => t + e)} />
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!content.trim() || createPost.isPending}
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
