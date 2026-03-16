import type { SessionConfig, DiscussionState, AgentConfig } from "@/lib/arena/types";

interface ArenaHeaderProps {
  config: SessionConfig;
  turnNumber: number;
  totalTokens: number;
  estimatedCostUsd: number;
  discussionState: DiscussionState;
  isRunning: boolean;
  isPaused: boolean;
  currentSpeaker: string | null;
  copied: boolean;
  onPause: () => void;
  onStop: () => void;
  onForceVote: () => void;
  onForceDeliverable: () => void;
  onCopyAll: () => void;
  onDownloadMd: () => void;
  onContinue: () => void;
  onGoToResults: () => void;
  messages: { length: number };
}

const modeLabels: Record<string, string> = {
  exploration: "Exploration",
  decision: "Decision",
  deliverable: "Livrable",
};

export default function ArenaHeader({
  config,
  turnNumber,
  totalTokens,
  estimatedCostUsd,
  discussionState,
  isRunning,
  isPaused,
  currentSpeaker,
  copied,
  onPause,
  onStop,
  onForceVote,
  onForceDeliverable,
  onCopyAll,
  onDownloadMd,
  onContinue,
  onGoToResults,
  messages,
}: ArenaHeaderProps) {
  return (
    <header className="shrink-0 border-b border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-6 py-2 sm:py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold">AI Arena</h1>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                config.mode === "decision" ? "bg-amber-500/10 text-amber-500"
                  : config.mode === "deliverable" ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-primary/10 text-primary"
              }`}>
                {modeLabels[config.mode]}
              </span>
            </div>
            <p className="max-w-md truncate text-xs text-muted-foreground">{config.topic}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <StatusBar
            turnNumber={turnNumber}
            maxTurns={config.rules.maxTurns}
            totalTokens={totalTokens}
            estimatedCostUsd={estimatedCostUsd}
            discussionState={discussionState}
            isRunning={isRunning}
            isPaused={isPaused}
          />
          {isRunning && (
            <RunningControls
              isPaused={isPaused}
              mode={config.mode}
              onPause={onPause}
              onStop={onStop}
              onForceVote={onForceVote}
              onForceDeliverable={onForceDeliverable}
            />
          )}
          {!isRunning && messages.length > 0 && (
            <FinishedControls
              copied={copied}
              onCopyAll={onCopyAll}
              onDownloadMd={onDownloadMd}
              onContinue={onContinue}
              onGoToResults={onGoToResults}
            />
          )}
        </div>
      </div>
      {/* Agent badges */}
      <div className="flex gap-2 overflow-x-auto px-3 sm:px-6 pb-3">
        {config.agents.map((agent) => (
          <AgentBadge key={agent.id} agent={agent} isActive={currentSpeaker === agent.id} />
        ))}
      </div>
    </header>
  );
}

function StatusBar({
  turnNumber,
  maxTurns,
  totalTokens,
  estimatedCostUsd,
  discussionState,
  isRunning,
  isPaused,
}: {
  turnNumber: number;
  maxTurns: number;
  totalTokens: number;
  estimatedCostUsd: number;
  discussionState: DiscussionState;
  isRunning: boolean;
  isPaused: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
      <span>Tour {turnNumber}/{maxTurns}</span>
      <span className="text-border hidden sm:inline">|</span>
      <span className="hidden sm:inline">{totalTokens} tok</span>
      <span className="text-border hidden sm:inline">|</span>
      <span className="font-mono hidden sm:inline">${estimatedCostUsd.toFixed(4)}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-medium ${
        discussionState === "active" ? "bg-emerald-500/10 text-emerald-500"
          : discussionState === "stalling" ? "bg-destructive/10 text-destructive"
            : discussionState === "converging" ? "bg-amber-500/10 text-amber-500"
              : "bg-primary/10 text-primary"
      }`}>
        {isRunning ? (isPaused ? "Pause" : discussionState === "converging" ? "Convergence" : discussionState === "stalling" ? "Stagne" : "En cours") : "Termine"}
      </span>
    </div>
  );
}

function RunningControls({
  isPaused,
  mode,
  onPause,
  onStop,
  onForceVote,
  onForceDeliverable,
}: {
  isPaused: boolean;
  mode: string;
  onPause: () => void;
  onStop: () => void;
  onForceVote: () => void;
  onForceDeliverable: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 sm:gap-2">
      <button onClick={onPause} className="rounded-lg border border-border px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs transition-colors hover:border-border-hover">
        {isPaused ? "Reprendre" : "Pause"}
      </button>
      {mode === "decision" && (
        <button onClick={onForceVote} className="rounded-lg border border-amber-500/30 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-amber-500 transition-colors hover:bg-amber-500/10">
          Voter
        </button>
      )}
      {mode === "deliverable" && (
        <button onClick={onForceDeliverable} className="rounded-lg border border-emerald-500/30 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-emerald-500 transition-colors hover:bg-emerald-500/10">
          Livrable
        </button>
      )}
      <button onClick={onStop} className="rounded-lg border border-destructive/30 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-destructive transition-colors hover:bg-destructive/10">
        Arreter
      </button>
    </div>
  );
}

function FinishedControls({
  copied,
  onCopyAll,
  onDownloadMd,
  onContinue,
  onGoToResults,
}: {
  copied: boolean;
  onCopyAll: () => void;
  onDownloadMd: () => void;
  onContinue: () => void;
  onGoToResults: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 sm:gap-2">
      <button
        onClick={onCopyAll}
        className="rounded-lg border border-border px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        title="Copier tous les echanges"
      >
        {copied ? (
          <span className="flex items-center gap-1 text-emerald-500">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <span className="hidden sm:inline">Copie</span>
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            <span className="hidden sm:inline">Copier</span>
          </span>
        )}
      </button>
      <button
        onClick={onDownloadMd}
        className="rounded-lg border border-border px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        title="Telecharger en Markdown"
      >
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          .md
        </span>
      </button>
      <button
        onClick={onContinue}
        className="rounded-lg border border-primary/30 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-primary transition-colors hover:bg-primary/10"
        title="Continuer la discussion (+5 tours)"
      >
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="hidden sm:inline">Continuer</span>
        </span>
      </button>
      <button onClick={onGoToResults} className="rounded-lg bg-primary px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-white transition-colors hover:bg-primary/90">
        Resultats
      </button>
    </div>
  );
}

function AgentBadge({ agent, isActive }: { agent: AgentConfig; isActive: boolean }) {
  return (
    <div
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs transition-all ${isActive ? "border-transparent" : "border-border"}`}
      style={isActive ? { borderColor: agent.color, backgroundColor: agent.color + "15" } : {}}
    >
      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: agent.color }} />
      <span style={isActive ? { color: agent.color } : {}}>{agent.name}</span>
      <span className="text-[10px] text-muted-foreground">{agent.provider === "openai" ? "OAI" : agent.provider === "gemini" ? "Gem" : ""}</span>
    </div>
  );
}
