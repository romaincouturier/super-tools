import { Sparkles } from "lucide-react";
import { useDepositFeedback } from "@/hooks/useLmsWorkDeposit";

interface Props {
  depositId: string;
  learnerEmail: string;
}

/**
 * Read-only display of SuperTilt feedback on a deposit. The post/edit/delete
 * controls live in the BO (Stage 4); the learner only consumes here.
 */
export default function DepositFeedbackList({ depositId, learnerEmail }: Props) {
  const { data: items = [], isLoading } = useDepositFeedback(depositId, learnerEmail);
  if (isLoading || items.length === 0) return null;

  return (
    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span className="font-semibold">Retour SuperTilt</span>
      </div>
      <ul className="space-y-3">
        {items.map((f) => (
          <li key={f.id} className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {new Date(f.created_at).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
            <p className="text-sm whitespace-pre-wrap break-words">{f.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
