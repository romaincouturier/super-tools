import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { SessionConfig, SessionResult } from "@/lib/arena/types";
import { exportToMarkdown, downloadMarkdown } from "@/lib/arena/export";
import MessageBubble from "@/components/arena/MessageBubble";
import AppHeader from "@/components/AppHeader";

export default function ArenaResults() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [activeTab, setActiveTab] = useState<"synthesis" | "transcript" | "metrics" | "votes" | "deliverable">("synthesis");

  useEffect(() => {
    const configStr = sessionStorage.getItem("ai-arena-config");
    const resultStr = sessionStorage.getItem("ai-arena-result");
    const startTime = Number(sessionStorage.getItem("ai-arena-start-time") || Date.now());
    if (!configStr || !resultStr) { navigate("/arena"); return; }
    try {
      const parsedConfig = JSON.parse(configStr);
      const parsedResult = JSON.parse(resultStr);
      parsedResult.metrics.duration = Date.now() - startTime;
      setConfig(parsedConfig);
      setResult(parsedResult);
    } catch (error) { console.warn("Failed to parse arena results:", error); navigate("/arena"); }
  }, [navigate]);

  const handleExport = () => {
    if (!config || !result) return;
    const markdown = exportToMarkdown(config, result);
    const filename = `ai-arena-${config.topic.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "-")}.md`;
    downloadMarkdown(markdown, filename);
  };

  if (!config || !result) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  const nonSynthesisMessages = result.messages.filter((m) => !m.isSynthesis && !m.isDeliverable);
  const tokensPerAgent = result.metrics.tokensPerAgent;
  const hasVotes = result.votes && result.votes.length > 0;
  const hasDeliverable = !!result.deliverable;

  const tabs = [
    { id: "synthesis" as const, label: "Synthese" },
    ...(hasDeliverable ? [{ id: "deliverable" as const, label: "Livrable" }] : []),
    ...(hasVotes ? [{ id: "votes" as const, label: "Votes" }] : []),
    { id: "transcript" as const, label: "Transcript" },
    { id: "metrics" as const, label: "Metriques" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate("/")} className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold">Resultats</h1>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                  config.mode === "decision" ? "bg-amber-500/10 text-amber-500"
                    : config.mode === "deliverable" ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-primary/10 text-primary"
                }`}>
                  {config.mode === "decision" ? "Decision" : config.mode === "deliverable" ? "Livrable" : "Exploration"}
                </span>
              </div>
              <p className="max-w-md truncate text-xs text-muted-foreground">{config.topic}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate("/arena")} className="rounded-lg border border-border px-3 sm:px-4 py-2 text-xs sm:text-sm transition-colors hover:border-border-hover">
              Nouvelle discussion
            </button>
            <button onClick={handleExport} className="rounded-lg bg-primary px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-primary/90">
              Exporter Markdown
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[80px] rounded-md px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === tab.id ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Synthesis tab */}
        {activeTab === "synthesis" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
              <h2 className="mb-4 text-lg font-semibold text-primary">Synthese de la discussion</h2>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{result.synthesis}</div>
            </div>

            {result.keyPoints.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-3 font-semibold">Points cles</h3>
                <ul className="space-y-2">
                  {result.keyPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-3 font-semibold">Participants</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {config.agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                    style={{ borderLeftColor: agent.color, borderLeftWidth: 3 }}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: agent.color }}>
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{agent.name}</span>
                        <span className="rounded bg-border px-1 py-0.5 text-[9px] text-muted-foreground">{agent.provider}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{agent.role}</div>
                      <div className="text-xs text-muted-foreground">{tokensPerAgent[agent.id] || 0} tokens</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Deliverable tab */}
        {activeTab === "deliverable" && hasDeliverable && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
            <h2 className="mb-4 text-lg font-semibold text-emerald-500">Livrable final</h2>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{result.deliverable}</div>
          </div>
        )}

        {/* Votes tab */}
        {activeTab === "votes" && hasVotes && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Resultats du vote</h2>
            {result.votes!.map((vote) => {
              const agent = config.agents.find((a) => a.id === vote.agentId);
              return (
                <div
                  key={vote.agentId}
                  className="rounded-xl border border-border bg-card p-5"
                  style={{ borderLeftColor: agent?.color || "#888", borderLeftWidth: 4 }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: agent?.color || "#888" }}>
                      {vote.agentName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold" style={{ color: agent?.color }}>{vote.agentName}</span>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">VOTE</span>
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{vote.reasoning}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Transcript tab */}
        {activeTab === "transcript" && (
          <div className="rounded-xl border border-border">
            {result.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}

        {/* Metrics tab */}
        {activeTab === "metrics" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="text-xs font-medium text-muted-foreground">Tours</div>
                <div className="mt-1 text-2xl font-bold">{result.metrics.totalTurns}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="text-xs font-medium text-muted-foreground">Tokens sortie</div>
                <div className="mt-1 text-2xl font-bold">{result.metrics.totalTokens.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="text-xs font-medium text-muted-foreground">Tokens entree</div>
                <div className="mt-1 text-2xl font-bold">{(result.metrics.totalInputTokens || 0).toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="text-xs font-medium text-muted-foreground">Cout estime</div>
                <div className="mt-1 text-2xl font-bold font-mono">${(result.metrics.estimatedCost || 0).toFixed(4)}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="text-xs font-medium text-muted-foreground">Duree</div>
                <div className="mt-1 text-2xl font-bold">{Math.round(result.metrics.duration / 1000)}s</div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold">Tokens par agent</h3>
              <div className="space-y-3">
                {config.agents.map((agent) => {
                  const tokens = tokensPerAgent[agent.id] || 0;
                  const maxTokens = Math.max(...Object.values(tokensPerAgent), 1);
                  const percentage = (tokens / maxTokens) * 100;
                  return (
                    <div key={agent.id}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium" style={{ color: agent.color }}>{agent.name}</span>
                          <span className="rounded bg-border px-1 py-0.5 text-[9px] text-muted-foreground">{agent.provider}/{agent.model.split("-").slice(0, 2).join("-")}</span>
                        </div>
                        <span className="text-muted-foreground">{tokens} tokens</span>
                      </div>
                      <div className="h-2 rounded-full bg-border">
                        <div className="h-full rounded-full transition-all" style={{ width: `${percentage}%`, backgroundColor: agent.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold">Messages par agent</h3>
              <div className="space-y-2">
                {config.agents.map((agent) => {
                  const msgCount = result.messages.filter((m) => m.agentId === agent.id && !m.isVote).length;
                  const voteCount = result.messages.filter((m) => m.agentId === agent.id && m.isVote).length;
                  return (
                    <div key={agent.id} className="flex items-center justify-between text-sm">
                      <span style={{ color: agent.color }}>{agent.name}</span>
                      <span className="text-muted-foreground">
                        {msgCount} messages{voteCount > 0 ? ` + ${voteCount} vote` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
