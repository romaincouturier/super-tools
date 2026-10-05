import { useState } from "react";
import { ThumbsUp, Send } from "lucide-react";
import { useDepositReactions, useToggleStaffDepositReaction, useCreateStaffDepositComment } from "@/hooks/useDepositCommunity";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskEmail } from "@/lib/demoMask";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";

interface Props {
  depositId: string;
}

/**
 * Réactions « J'aime » de la communauté sur un travail publié, avec réaction
 * et commentaire du membre de l'équipe connecté.
 */
export default function DepositCommunityPanel({ depositId }: Props) {
  const { user } = useAuth();
  const myEmail = (user?.email || "").toLowerCase();
  const { isDemoMode } = useDemoMode();
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const { data: reactions = [] } = useDepositReactions(depositId);
  const iReacted = reactions.some((r) => r.author_email.toLowerCase() === myEmail);
  const toggle = useToggleStaffDepositReaction(depositId, myEmail);
  const comment = useCreateStaffDepositComment(depositId, myEmail);

  const onToggle = () =>
    toggle.mutate(iReacted, { onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur") });
  const onComment = (content: string) =>
    comment.mutate(content, {
      onSuccess: () => { setDraft(""); toast({ title: "Commentaire publié" }); },
      onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur"),
    });

  return (
    <div className="space-y-3 rounded-md border p-3 bg-card">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={iReacted ? "default" : "outline"}
          onClick={onToggle}
          disabled={toggle.isPending}
        >
          <ThumbsUp className="h-4 w-4 mr-2" />
          {iReacted ? "Vous aimez" : "J'aime"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {reactions.length} J'aime
          {reactions.length > 0 &&
            ` · ${reactions.map((r) => (isDemoMode ? maskEmail(r.author_email) : r.author_email)).join(", ")}`}
        </span>
      </div>
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Écrire un commentaire visible dans la communauté…"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => draft.trim() && onComment(draft.trim())}
            disabled={!draft.trim() || comment.isPending}
          >
            {comment.isPending ? <Spinner className="mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Commenter
          </Button>
        </div>
      </div>
    </div>
  );
}
