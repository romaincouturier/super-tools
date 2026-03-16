import type { AgentConfig } from "@/lib/arena/types";
import type { NextSpeakerSuggestion } from "@/hooks/useArenaDiscussion";

interface ArenaInputBarProps {
  waitingForUser: boolean;
  userInput: string;
  nextSpeakerSuggestion: NextSpeakerSuggestion | null;
  agents: AgentConfig[];
  isListening: boolean;
  micSupported: boolean;
  onSetUserInput: (value: string) => void;
  onContinueStep: (overrideAgentId?: string) => void;
  onVoiceToInput: () => void;
  onRequestIntermediateSynthesis: () => void;
}

export default function ArenaInputBar({
  waitingForUser,
  userInput,
  nextSpeakerSuggestion,
  agents,
  isListening,
  micSupported,
  onSetUserInput,
  onContinueStep,
  onVoiceToInput,
  onRequestIntermediateSynthesis,
}: ArenaInputBarProps) {
  return (
    <div className="shrink-0 border-t border-border px-3 sm:px-6 py-3">
      {waitingForUser ? (
        <div>
          {/* Next speaker recommendation */}
          {nextSpeakerSuggestion && (
            <div className="mb-3">
              <div className="mb-1.5 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-medium text-amber-400">Prochain interlocuteur suggere</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {agents.map((a) => {
                  const isSuggested = a.id === nextSpeakerSuggestion.agentId;
                  return (
                    <button
                      key={a.id}
                      onClick={() => onContinueStep(a.id)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all ${
                        isSuggested
                          ? "border-primary bg-primary/10 font-semibold text-primary ring-1 ring-primary/30"
                          : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground"
                      }`}
                      title={isSuggested ? nextSpeakerSuggestion.instruction : `Faire parler ${a.name}`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                      {a.name}
                      {isSuggested && <span className="text-[9px] text-primary/70">recommande</span>}
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
              value={userInput}
              onChange={(e) => onSetUserInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onContinueStep()}
              className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary"
              placeholder="Ajouter du contexte, corriger une hypothese, recadrer... (optionnel)"
              autoFocus
            />
            {micSupported && (
              <button
                type="button"
                onClick={onVoiceToInput}
                className={`shrink-0 rounded-lg p-2 transition-colors ${
                  isListening ? "bg-destructive/10 text-destructive animate-pulse" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                }`}
                title={isListening ? "Arreter l'ecoute" : "Dicter"}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8m-4-12a3 3 0 00-3 3v4a3 3 0 006 0V8a3 3 0 00-3-3z" />
                </svg>
              </button>
            )}
            <button
              onClick={() => onContinueStep()}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              {userInput.trim() ? "Envoyer et continuer" : "Continuer"}
            </button>
          </div>
        </div>
      ) : (
        /* Agent is speaking -- show minimal status */
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{"L'agent repond..."}</span>
          <button
            onClick={onRequestIntermediateSynthesis}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Synthese intermediaire
          </button>
        </div>
      )}
    </div>
  );
}
