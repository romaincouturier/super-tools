import type { PracticePoll } from "@/hooks/usePracticeFeed";

export default function PollDisplay({
  poll,
  onVote,
  disabled,
}: {
  poll: PracticePoll;
  onVote: (pollId: string, optionId: string, currentOptionId: string | null) => void;
  disabled?: boolean;
}) {
  const total = poll.total_votes;
  const voted = poll.my_option_id !== null;

  return (
    <div className="px-4 pb-3 space-y-2">
      {poll.options.map((opt) => {
        const pct = total > 0 ? Math.round((opt.vote_count / total) * 100) : 0;
        const isMine = poll.my_option_id === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => !disabled && onVote(poll.id, opt.id, poll.my_option_id)}
            disabled={disabled}
            className="relative w-full text-left rounded-lg border overflow-hidden transition-colors hover:bg-black/[0.02] disabled:cursor-default"
            style={{ borderColor: isMine ? "var(--st-yellow)" : "rgba(16,24,32,0.12)" }}
          >
            {/* Result bar */}
            {voted && (
              <div
                className="absolute inset-y-0 left-0"
                style={{ width: `${pct}%`, background: isMine ? "rgba(255,209,0,0.35)" : "rgba(16,24,32,0.06)" }}
              />
            )}
            <div className="relative flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm font-medium" style={{ color: "var(--st-ink)" }}>
                {isMine ? "✓ " : ""}{opt.label}
              </span>
              {voted && (
                <span className="text-xs font-semibold shrink-0" style={{ color: "var(--st-ink-muted)" }}>
                  {pct}%
                </span>
              )}
            </div>
          </button>
        );
      })}
      <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
        {total} vote{total > 1 ? "s" : ""}{voted ? " · touchez à nouveau votre choix pour l'annuler" : ""}
      </p>
    </div>
  );
}
