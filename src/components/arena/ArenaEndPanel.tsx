interface ArenaEndPanelProps {
  copied: boolean;
  rating: number | null;
  feedbackText: string;
  feedbackSent: boolean;
  onCopyAll: () => void;
  onDownloadMd: () => void;
  onContinue: () => void;
  onGoToResults: () => void;
  onSetRating: (value: number | null) => void;
  onSetFeedbackText: (value: string) => void;
  onSubmitFeedback: () => void;
}

export default function ArenaEndPanel({
  copied,
  rating,
  feedbackText,
  feedbackSent,
  onCopyAll,
  onDownloadMd,
  onContinue,
  onGoToResults,
  onSetRating,
  onSetFeedbackText,
  onSubmitFeedback,
}: ArenaEndPanelProps) {
  return (
    <div className="mx-4 my-6 arena-fade-in-up rounded-xl border border-primary/30 bg-primary/5 p-5">
      <p className="mb-4 text-center text-sm font-semibold text-primary">Discussion terminee</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onCopyAll}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:border-primary hover:text-primary"
        >
          {copied ? (
            <>
              <svg className="h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <span className="text-emerald-500">Copie !</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Copier les echanges
            </>
          )}
        </button>
        <button
          onClick={onDownloadMd}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:border-primary hover:text-primary"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Telecharger .md
        </button>
        <button
          onClick={onContinue}
          className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm text-primary transition-colors hover:bg-primary/20"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Continuer (+5 tours)
        </button>
        <button
          onClick={onGoToResults}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
        >
          Voir les resultats
        </button>
      </div>

      {/* Feedback */}
      <div className="mt-5 border-t border-primary/20 pt-4">
        {feedbackSent ? (
          <p className="text-center text-xs text-emerald-500">Merci pour votre retour !</p>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-xs text-muted-foreground">Comment etait cette discussion ?</p>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => onSetRating(star)}
                  className={`p-1 text-lg transition-colors ${
                    rating !== null && star <= rating ? "text-amber-400" : "text-border hover:text-amber-300"
                  }`}
                >
                  &#9733;
                </button>
              ))}
            </div>
            {rating !== null && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={feedbackText}
                  onChange={(e) => onSetFeedbackText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onSubmitFeedback()}
                  className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs outline-none focus:border-primary"
                  placeholder="Un commentaire ? (optionnel)"
                />
                <button
                  onClick={onSubmitFeedback}
                  className="rounded-lg bg-primary/20 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/30"
                >
                  Envoyer
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
