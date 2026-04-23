import { useState } from "react";
import { useLessonComments, usePostLessonComment } from "@/hooks/useLms";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  courseId: string;
  lessonId: string;
  learnerEmail: string;
  learnerName: string;
}

export default function LessonComments({ courseId, lessonId, learnerEmail, learnerName }: Props) {
  const { data: comments = [] } = useLessonComments(lessonId, learnerEmail);
  const postComment = usePostLessonComment();
  const [content, setContent] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!content.trim()) return;
    try {
      await postComment.mutateAsync({
        courseId,
        lessonId,
        learnerEmail,
        learnerName,
        content: content.trim(),
      });
      setContent("");
      toast({ title: "Commentaire envoyé !" });
    } catch {
      toast({ title: "Erreur lors de l'envoi", variant: "destructive" });
    }
  };

  return (
    <div className="border-t pt-4 mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageCircle className="w-4 h-4" />
        {comments.length > 0 ? `${comments.length} commentaire(s)` : "Laisser un commentaire"}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {comments.map((c: any) => (
            <div key={c.id} className="bg-muted/50 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{c.learner_name || c.learner_email}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}

          <div className="flex gap-2">
            <Textarea
              placeholder="Votre commentaire..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={2}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!content.trim() || postComment.isPending}
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
