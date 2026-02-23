import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AppHeader from "@/components/AppHeader";
import MessageBubble from "@/components/arena/MessageBubble";
import TypingIndicator from "@/components/arena/TypingIndicator";
import { useArenaDiscussion } from "./useArenaDiscussion";

export default function ArenaDiscussion() {
  const ad = useArenaDiscussion();

  const modeLabels: Record<string, string> = {
    exploration: "Exploration",
    decision: "Decision",
    deliverable: "Livrable",
  };

  if (!ad.config) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader />
      {/* Header */}
      <header className="shrink-0 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-6 py-2 sm:py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => window.history.back()}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold">AI Arena</h1>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    ad.config.mode === "decision"
                      ? "bg-amber-500/10 text-amber-500"
                      : ad.config.mode === "deliverable"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-primary/10 text-primary"
                  }`}
                >
                  {modeLabels[ad.config.mode]}
                </span>
              </div>
              <p className="max-w-md truncate text-xs text-muted-foreground">{ad.config.topic}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
              <span>
                Tour {ad.turnNumber}/{ad.config.rules.maxTurns}
              </span>
              <span className="text-border hidden sm:inline">|</span>
              <span className="hidden sm:inline">{ad.totalTokens} tok</span>
              <span className="text-border hidden sm:inline">|</span>
              <span className="font-mono hidden sm:inline">${ad.estimatedCostUsd.toFixed(4)}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-medium ${
                  ad.discussionState === "active"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : ad.discussionState === "stalling"
                      ? "bg-destructive/10 text-destructive"
                      : ad.discussionState === "converging"
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-primary/10 text-primary"
                }`}
              >
                {ad.isRunning
                  ? ad.isPaused
                    ? "Pause"
                    : ad.discussionState === "converging"
                      ? "Convergence"
                      : ad.discussionState === "stalling"
                        ? "Stagne"
                        : "En cours"
                  : "Termine"}
              </span>
            </div>
            {ad.isRunning && (
              <div className="flex flex-wrap gap-1 sm:gap-2">
                <button
                  onClick={ad.handlePause}
                  className="rounded-lg border border-border px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs transition-colors hover:border-border-hover"
                >
                  {ad.isPaused ? "Reprendre" : "Pause"}
                </button>
                {ad.config.mode === "decision" && (
                  <button
                    onClick={ad.forceVote}
                    className="rounded-lg border border-amber-500/30 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-amber-500 transition-colors hover:bg-amber-500/10"
                  >
                    Voter
                  </button>
                )}
                {ad.config.mode === "deliverable" && (
                  <button
                    onClick={ad.forceDeliverable}
                    className="rounded-lg border border-emerald-500/30 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-emerald-500 transition-colors hover:bg-emerald-500/10"
                  >
                    Livrable
                  </button>
                )}
                <button
                  onClick={ad.handleStop}
                  className="rounded-lg border border-destructive/30 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-destructive transition-colors hover:bg-destructive/10"
                >
                  Arreter
                </button>
              </div>
            )}
            {!ad.isRunning && ad.messages.length > 0 && (
              <div className="flex flex-wrap gap-1 sm:gap-2">
                <button
                  onClick={ad.handleCopyAll}
                  className="rounded-lg border border-border px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  title="Copier tous les echanges"
                >
                  {ad.copied ? (
                    <span className="flex items-center gap-1 text-emerald-500">
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="hidden sm:inline">Copie</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      <span className="hidden sm:inline">Copier</span>
                    </span>
                  )}
                </button>
                <button
                  onClick={ad.handleDownloadMd}
                  className="rounded-lg border border-border px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  title="Telecharger en Markdown"
                >
                  <span className="flex items-center gap-1">
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    .md
                  </span>
                </button>
                <button
                  onClick={ad.handleContinue}
                  className="rounded-lg border border-primary/30 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-primary transition-colors hover:bg-primary/10"
                  title="Continuer la discussion (+5 tours)"
                >
                  <span className="flex items-center gap-1">
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="hidden sm:inline">Continuer</span>
                  </span>
                </button>
                <button
                  onClick={ad.goToResults}
                  className="rounded-lg bg-primary px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-white transition-colors hover:bg-primary/90"
                >
                  Resultats
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Agent badges */}
        <div className="flex gap-2 overflow-x-auto px-3 sm:px-6 pb-3">
          {ad.config.agents.map((agent) => (
            <div
              key={agent.id}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs transition-all ${ad.currentSpeaker === agent.id ? "border-transparent" : "border-border"}`}
              style={
                ad.currentSpeaker === agent.id
                  ? { borderColor: agent.color, backgroundColor: agent.color + "15" }
                  : {}
              }
            >
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: agent.color }} />
              <span style={ad.currentSpeaker === agent.id ? { color: agent.color } : {}}>
                {agent.name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {agent.provider === "openai" ? "OAI" : agent.provider === "gemini" ? "Gem" : ""}
              </span>
            </div>
          ))}
        </div>
      </header>

      {/* Key points sidebar (if any) */}
      <div className="relative flex flex-1 overflow-hidden">
        <div
          ref={ad.scrollContainerRef}
          onScroll={ad.handleScroll}
          className="flex-1 overflow-y-auto py-4"
        >
          {ad.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {/* Streaming content */}
          {ad.currentSpeaker &&
            !["synthesis", "deliverable"].includes(ad.currentSpeaker || "") &&
            ad.currentAgent &&
            ad.streamingContent && (
              <div className="arena-fade-in-up mx-4 my-3">
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: ad.currentAgent.color }}
                  >
                    {ad.currentAgent.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: ad.currentAgent.color }}
                      >
                        {ad.currentAgent.name}
                      </span>
                      <span className="text-xs text-muted-foreground">Tour {ad.turnNumber}</span>
                    </div>
                    <div
                      className="rounded-xl rounded-tl-sm border px-4 py-3"
                      style={{ borderColor: ad.currentAgent.color + "40" }}
                    >
                      <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {ad.streamingContent}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Synthesis/Deliverable streaming */}
          {(ad.currentSpeaker === "synthesis" || ad.currentSpeaker === "deliverable") &&
            ad.streamingContent && (
              <div
                className={`arena-fade-in-up mx-4 my-4 rounded-xl border p-5 ${ad.currentSpeaker === "deliverable" ? "border-emerald-500/30 bg-emerald-500/5" : "border-primary/30 bg-primary/5"}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`font-semibold ${ad.currentSpeaker === "deliverable" ? "text-emerald-500" : "text-primary"}`}
                  >
                    {ad.currentSpeaker === "deliverable"
                      ? "Generation du livrable..."
                      : "Synthese en cours..."}
                  </span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{ad.streamingContent}</ReactMarkdown>
                </div>
              </div>
            )}

          {ad.currentSpeaker && !ad.streamingContent && ad.currentAgent && (
            <TypingIndicator agentName={ad.currentAgent.name} agentColor={ad.currentAgent.color} />
          )}

          {ad.error && (
            <div className="mx-4 my-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {ad.error}
            </div>
          )}

          {/* End-of-discussion action bar inline */}
          {!ad.isRunning && ad.messages.length > 0 && (
            <div className="mx-4 my-6 arena-fade-in-up rounded-xl border border-primary/30 bg-primary/5 p-5">
              <p className="mb-4 text-center text-sm font-semibold text-primary">
                Discussion terminee
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={ad.handleCopyAll}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:border-primary hover:text-primary"
                >
                  {ad.copied ? (
                    <>
                      <svg
                        className="h-4 w-4 text-emerald-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-emerald-500">Copie !</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copier les echanges
                    </>
                  )}
                </button>
                <button
                  onClick={ad.handleDownloadMd}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:border-primary hover:text-primary"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Telecharger .md
                </button>
                <button
                  onClick={ad.handleContinue}
                  className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm text-primary transition-colors hover:bg-primary/20"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Continuer (+5 tours)
                </button>
                <button
                  onClick={ad.goToResults}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                >
                  Voir les resultats
                </button>
              </div>

              {/* Feedback */}
              <div className="mt-5 border-t border-primary/20 pt-4">
                {ad.feedbackSent ? (
                  <p className="text-center text-xs text-emerald-500">Merci pour votre retour !</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-center text-xs text-muted-foreground">
                      Comment etait cette discussion ?
                    </p>
                    <div className="flex justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => ad.setRating(star)}
                          className={`p-1 text-lg transition-colors ${
                            ad.rating !== null && star <= ad.rating
                              ? "text-amber-400"
                              : "text-border hover:text-amber-300"
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    {ad.rating !== null && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={ad.feedbackText}
                          onChange={(e) => ad.setFeedbackText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && ad.submitFeedback()}
                          className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs outline-none focus:border-primary"
                          placeholder="Un commentaire ? (optionnel)"
                        />
                        <button
                          onClick={ad.submitFeedback}
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
          )}

          <div ref={ad.messagesEndRef} />
        </div>

        {/* Floating scroll-to-bottom button */}
        {ad.showScrollButton && (
          <button
            onClick={ad.forceScrollToBottom}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full border border-border bg-card/95 backdrop-blur-sm px-3 py-1.5 text-xs text-muted-foreground shadow-lg transition-all hover:text-foreground hover:border-primary"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
            Nouveaux messages
          </button>
        )}

        {/* Key points sidebar */}
        {ad.keyPoints.length > 0 && (
          <div className="hidden w-72 shrink-0 border-l border-border p-4 lg:block">
            <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase">
              Points cles
            </h3>
            <div className="space-y-2">
              {ad.keyPoints.map((point, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="text-muted-foreground">{point}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Step-by-step input -- always visible during discussion */}
      {ad.isRunning && (
        <div className="shrink-0 border-t border-border px-3 sm:px-6 py-3">
          {ad.waitingForUser ? (
            /* Waiting for user: show next speaker recommendation + input */
            <div>
              {/* Next speaker recommendation */}
              {ad.nextSpeakerSuggestion && ad.config && (
                <div className="mb-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs font-medium text-amber-400">
                      Prochain interlocuteur suggere
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {ad.config.agents.map((a) => {
                      const isSuggested = a.id === ad.nextSpeakerSuggestion!.agentId;
                      return (
                        <button
                          key={a.id}
                          onClick={() => ad.handleContinueStep(a.id)}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all ${
                            isSuggested
                              ? "border-primary bg-primary/10 font-semibold text-primary ring-1 ring-primary/30"
                              : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground"
                          }`}
                          title={
                            isSuggested
                              ? ad.nextSpeakerSuggestion!.instruction
                              : `Faire parler ${a.name}`
                          }
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: a.color }}
                          />
                          {a.name}
                          {isSuggested && (
                            <span className="text-[9px] text-primary/70">recommande</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* User input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ad.userInput}
                  onChange={(e) => ad.setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && ad.handleContinueStep()}
                  className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary"
                  placeholder="Ajouter du contexte, corriger une hypothese, recadrer... (optionnel)"
                  autoFocus
                />
                {ad.micSupported && (
                  <button
                    type="button"
                    onClick={ad.voiceToInput}
                    className={`shrink-0 rounded-lg p-2 transition-colors ${
                      ad.isListening
                        ? "bg-destructive/10 text-destructive animate-pulse"
                        : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                    }`}
                    title={ad.isListening ? "Arreter l'ecoute" : "Dicter"}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8m-4-12a3 3 0 00-3 3v4a3 3 0 006 0V8a3 3 0 00-3-3z"
                      />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => ad.handleContinueStep()}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                >
                  {ad.userInput.trim() ? "Envoyer et continuer" : "Continuer"}
                </button>
              </div>
            </div>
          ) : (
            /* Agent is speaking -- show minimal status */
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>L'agent repond...</span>
              <button
                onClick={ad.requestIntermediateSynthesis}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                Synthese intermediaire
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
