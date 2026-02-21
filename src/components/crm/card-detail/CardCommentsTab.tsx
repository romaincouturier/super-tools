import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Comment {
  id: string;
  author_email: string;
  content: string;
  created_at: string;
}

interface CardCommentsTabProps {
  comments: Comment[];
  isLoading: boolean;
  newComment: string;
  onNewCommentChange: (value: string) => void;
  onAddComment: () => void;
  onDeleteComment: (id: string) => void;
  isAdding: boolean;
}

const CardCommentsTab = ({
  comments,
  isLoading,
  newComment,
  onNewCommentChange,
  onAddComment,
  onDeleteComment,
  isAdding,
}: CardCommentsTabProps) => {
  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-2">
        <Textarea
          placeholder="Ajouter un commentaire..."
          value={newComment}
          onChange={(e) => onNewCommentChange(e.target.value)}
          rows={2}
        />
        <Button
          onClick={onAddComment}
          disabled={!newComment.trim() || isAdding}
        >
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun commentaire</p>
        )}
        {comments.map((comment) => (
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
                onClick={() => onDeleteComment(comment.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <p className="mt-2 text-sm">{comment.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CardCommentsTab;
