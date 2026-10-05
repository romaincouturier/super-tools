import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThumbsUp, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const c = supabase as any;

  const { data: reactions = [] } = useQuery<{ author_email: string }[]>({
    queryKey: ["admin-deposit-reactions", depositId],
    queryFn: async () => {
      const { data, error } = await c.from("lms_deposit_reactions").select("author_email").eq("deposit_id", depositId);
      if (error) throw error;
      return data || [];
    },
  });

  const iReacted = reactions.some((r) => r.author_email.toLowerCase() === myEmail);

  const toggle = useMutation({
    mutationFn: async () => {
      if (!myEmail) throw new Error("Session introuvable");
      const q = c.from("lms_deposit_reactions");
      const { error } = iReacted
        ? await q.delete().eq("deposit_id", depositId).eq("author_email", myEmail)
        : await q.insert({ deposit_id: depositId, author_email: myEmail });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-deposit-reactions", depositId] }),
    onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur"),
  });

  const comment = useMutation({
    mutationFn: async (content: string) => {
      if (!myEmail) throw new Error("Session introuvable");
      const { error } = await c.from("lms_deposit_comments").insert({ deposit_id: depositId, author_email: myEmail, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["admin-comments", depositId] });
      toast({ title: "Commentaire publié" });
    },
    onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur"),
  });

  return (
    <div className="space-y-3 rounded-md border p-3 bg-card">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={iReacted ? "default" : "outline"}
          onClick={() => toggle.mutate()}
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
            onClick={() => draft.trim() && comment.mutate(draft.trim())}
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
