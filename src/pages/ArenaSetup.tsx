import type { DiscussionMode, UserMode } from "@/lib/arena/types";
import { TEMPLATES } from "@/lib/arena/templates";
import type { CustomTemplate } from "@/lib/arena/customTemplates";
import { EXPERT_POOL } from "@/lib/arena/experts";
import AgentCard from "@/components/arena/AgentCard";
import { useArenaSetup } from "@/hooks/useArenaSetup";
import ModuleLayout from "@/components/ModuleLayout";
import { Sparkles } from "lucide-react";

export default function ArenaSetup() {
  const s = useArenaSetup();
  const {
    topic, setTopic, additionalContext, setAdditionalContext,
    mode, setMode, userMode, setUserMode, maxTurns, setMaxTurns,
    maxTokensPerTurn, language, setLanguage, apiKeys, setApiKeys,
    showApiKeys, setShowApiKeys, selectedTemplate, showAdvanced, setShowAdvanced,
    agents, history, customTemplates, showSaveTemplate, setShowSaveTemplate,
    newTemplateName, setNewTemplateName, newTemplateDesc, setNewTemplateDesc,
    isSuggesting, suggestions, showExpertPool, setShowExpertPool,
    expertFilter, setExpertFilter, feedbackHistory, showSidebar, setShowSidebar,
    isLoading, isFirstVisit, setIsFirstVisit, step, setStep,
    isListening, micSupported, voiceToTopic,
    filteredExperts, hasRequiredKey, canStart, hasAnyKey, usedProviders, modeLabel,
    addAgent, removeAgent, updateAgent, applyTemplate,
    handleSaveTemplate, handleDeleteCustomTemplate,
    handleViewSession, handleReuseSession, handleDeleteSession,
    handleSuggestExperts, addExpertFromPool, startDiscussion,
    saveFirstVisitKeys, updateApiKeyAndSave,
  } = s;
  return (
    <ModuleLayout>

      {/* Sub-header with back navigation — same pattern as CRM */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 hidden sm:block">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">AI Arena</h1>
                <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">Discussions Multi-Agents</p>
              </div>
            </div>
          </div>
          {!isLoading && !isFirstVisit && (
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-border px-2 sm:px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden sm:inline">Historique</span>
              {history.length > 0 && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">{history.length}</span>}
            </button>
          )}
        </div>
      </div>

      {/* Sidebar -- history panel */}
      {showSidebar && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowSidebar(false)} />
          {/* Panel */}
          <div className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-border bg-background shadow-xl sm:w-96">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Historique</h2>
              <button onClick={() => setShowSidebar(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-border hover:text-foreground">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {history.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground">Aucune discussion encore.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((session) => (
                    <div key={session.id} className="rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted">
                      <div className="flex items-start gap-2.5">
                        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white ${
                          session.mode === "decision" ? "bg-amber-500" : session.mode === "deliverable" ? "bg-emerald-500" : "bg-primary"
                        }`}>
                          {session.mode === "decision" ? "D" : session.mode === "deliverable" ? "L" : "E"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight">{session.topic}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                            <span>{new Date(session.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                            <span>{session.agentNames.join(", ")}</span>
                            <span>{session.turns} tours · <span className="font-mono">${session.cost.toFixed(4)}</span></span>
                          </div>
                          <div className="mt-2 flex gap-1">
                            <button
                              onClick={() => { handleViewSession(session); setShowSidebar(false); }}
                              className="rounded-lg border border-border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                            >
                              Resultats
                            </button>
                            <button
                              onClick={() => { handleReuseSession(session); setStep(2); setShowSidebar(false); }}
                              className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] text-primary transition-colors hover:bg-primary/20"
                            >
                              Relancer
                            </button>
                            <button
                              onClick={() => handleDeleteSession(session.id)}
                              className="rounded-lg border border-border px-1.5 py-1 text-[10px] text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                            >
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Feedback in sidebar too */}
              {feedbackHistory.length > 0 && (
                <div className="mt-6 border-t border-border pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-muted-foreground">Avis ({feedbackHistory.length})</h3>
                    <span className="text-xs text-muted-foreground">
                      <span className="text-amber-400">{"★".repeat(Math.round(feedbackHistory.reduce((s, f) => s + f.rating, 0) / feedbackHistory.length))}</span> {(feedbackHistory.reduce((s, f) => s + f.rating, 0) / feedbackHistory.length).toFixed(1)}/5
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {feedbackHistory.slice(0, 5).map((fb, i) => (
                      <div key={i} className="rounded-lg border border-border bg-card p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-amber-400 text-[10px]">{"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}</span>
                          <span className="text-[9px] text-muted-foreground">{fb.mode} · {fb.turns}t</span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px]">{fb.topic}</p>
                        {fb.feedback && <p className="mt-0.5 truncate text-[10px] text-muted-foreground italic">{fb.feedback}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Wait for keys to load before deciding which view to show */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : isFirstVisit ? (
          <section className="mx-auto max-w-lg">
            <div className="mb-6 text-center">
              <h2 className="mb-2 text-xl font-bold">Bienvenue sur AI Arena</h2>
              <p className="text-sm text-muted-foreground">Claude (Anthropic) est disponible par défaut. Vous pouvez aussi ajouter des clés OpenAI ou Gemini pour utiliser d'autres providers.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#D97706]" />
                  Anthropic (Claude) — <span className="text-primary">disponible</span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">Clé gérée côté serveur. Aucune configuration nécessaire.</p>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#10A37F]" />
                  OpenAI <span className="text-[10px]">(optionnel)</span>
                </label>
                <input
                  type="password"
                  value={apiKeys.openai || ""}
                  onChange={(e) => setApiKeys({ ...apiKeys, openai: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#4285F4]" />
                  Google Gemini <span className="text-[10px]">(optionnel)</span>
                </label>
                <input
                  type="password"
                  value={apiKeys.gemini || ""}
                  onChange={(e) => setApiKeys({ ...apiKeys, gemini: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  placeholder="AIza..."
                />
              </div>
              <button
                onClick={() => {
                  saveFirstVisitKeys();
                }}
                className="w-full rounded-xl bg-primary py-3 text-center font-semibold text-white transition-colors hover:bg-primary/90"
              >
                Commencer
              </button>
            </div>
          </section>
        ) : (<>

        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {[1, 2].map((s) => (
            <button
              key={s}
              onClick={() => { if (s === 1 || topic.trim()) setStep(s); }}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                step === s
                  ? "bg-primary text-white"
                  : step > s
                    ? "bg-primary/20 text-primary cursor-pointer"
                    : "bg-border text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* -- STEP 1: Topic + Context -- */}
        {step === 1 && (
          <section className="mx-auto max-w-2xl">
            <h2 className="mb-3 text-lg font-semibold">De quoi voulez-vous discuter ?</h2>
            <div className="relative">
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border bg-card px-4 py-3 pr-12 text-sm outline-none focus:border-primary"
                placeholder="Ex: Faut-il migrer notre monolithe vers des microservices ?"
                autoFocus
              />
              {micSupported && (
                <button
                  type="button"
                  onClick={voiceToTopic}
                  className={`absolute right-3 top-3 rounded-lg p-2 transition-colors ${
                    isListening ? "bg-destructive/10 text-destructive animate-pulse" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                  }`}
                  title={isListening ? "Arreter l'ecoute" : "Dicter le sujet"}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8m-4-12a3 3 0 00-3 3v4a3 3 0 006 0V8a3 3 0 00-3-3z" />
                  </svg>
                </button>
              )}
            </div>
            <div className="mt-3">
              <button
                onClick={() => setAdditionalContext(additionalContext ? "" : " ")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {additionalContext !== "" ? "- Retirer le contexte" : "+ Ajouter du contexte supplementaire"}
              </button>
              {additionalContext !== "" && (
                <>
                  <textarea
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    rows={2}
                    className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
                    placeholder="Ex: Budget max 50k, equipe de 5 devs, deadline Q3 2026..."
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">Contraintes, donnees, documents de reference que tous les agents recevront.</p>
                </>
              )}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!topic.trim()}
              className="mt-6 w-full rounded-xl bg-primary py-3 text-center font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Suivant
            </button>
          </section>
        )}

        {/* -- STEP 2: Templates / Suggestions / Agents + Launch -- */}
        {step === 2 && (
          <>
            {/* Topic summary -- clickable to go back */}
            <div className="mb-4 flex items-center gap-2">
              <button onClick={() => setStep(1)} className="text-xs text-muted-foreground hover:text-primary">
                ← Modifier le sujet
              </button>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="truncate text-sm font-medium">{topic}</span>
            </div>

            {/* Suggest experts */}
            {hasAnyKey && (
              <div className="mb-4">
                <button
                  onClick={handleSuggestExperts}
                  disabled={isSuggesting}
                  className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                >
                  {isSuggesting ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Analyse du sujet en cours...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Suggerer des experts pour ce sujet
                    </>
                  )}
                </button>
                <p className="mt-1 text-[10px] text-muted-foreground">L'IA analysera votre sujet et proposera les meilleurs experts ({EXPERT_POOL.length} disponibles)</p>
              </div>
            )}

            {/* Suggestion results */}
            {suggestions.length > 0 && (
              <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <h3 className="mb-2 text-sm font-semibold text-primary">Experts suggeres</h3>
                <div className="space-y-2">
                  {suggestions.map((s) => {
                    const expert = EXPERT_POOL.find((e) => e.id === s.id);
                    if (!expert) return null;
                    return (
                      <div key={s.id} className="flex items-start gap-3 rounded-lg bg-card p-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                          {expert.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{expert.name}</span>
                            <span className="rounded-full bg-border px-1.5 py-0.5 text-[9px] text-muted-foreground">{expert.domain}</span>
                            {s.suggestedStance && s.suggestedStance !== "neutre" && (
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${s.suggestedStance === "pour" ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"}`}>
                                {s.suggestedStance}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">{s.reason}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Templates -- compact pills */}
            <section className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground">Ou choisir un template</h2>
                <button
                  onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                  className="text-[11px] text-muted-foreground transition-colors hover:text-primary"
                >
                  + Sauvegarder
                </button>
              </div>
              {showSaveTemplate && (
                <div className="mb-3 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="w-full sm:w-40 rounded-lg border border-border bg-card px-2 py-1.5 text-xs outline-none focus:border-primary"
                    placeholder="Nom du template"
                  />
                  <input
                    type="text"
                    value={newTemplateDesc}
                    onChange={(e) => setNewTemplateDesc(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-xs outline-none focus:border-primary"
                    placeholder="Description (optionnel)"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveTemplate}
                      disabled={!newTemplateName.trim()}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-40"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => setShowSaveTemplate(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {customTemplates.map((template) => {
                  const isSelected = selectedTemplate === template.id;
                  return (
                    <div key={template.id} className="group relative">
                      <button
                        onClick={() => applyTemplate(template.id)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 font-semibold text-primary"
                            : "border-border bg-card text-foreground hover:border-primary"
                        }`}
                        title={template.description}
                      >
                        {template.name}
                        <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${
                          template.mode === "decision" ? "bg-amber-500/10 text-amber-500"
                            : template.mode === "deliverable" ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-primary/10 text-primary"
                        }`}>{modeLabel[template.mode]}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteCustomTemplate(template.id)}
                        className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-[8px] text-white group-hover:flex"
                        title="Supprimer"
                      >&times;</button>
                    </div>
                  );
                })}
                {TEMPLATES.map((template) => {
                  const isSelected = selectedTemplate === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template.id)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 font-semibold text-primary"
                          : "border-border bg-card text-foreground hover:border-primary"
                      }`}
                      title={template.description}
                    >
                      {template.name}
                      <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${
                        template.mode === "decision" ? "bg-amber-500/10 text-amber-500"
                          : template.mode === "deliverable" ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-primary/10 text-primary"
                      }`}>{modeLabel[template.mode]}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Advanced toggle -- API keys, params, agents */}
            <div className="mb-6">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <svg className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Options avancees
                <span className="text-xs text-muted-foreground">(cles API, parametres, agents, modeles)</span>
              </button>
            </div>

            {showAdvanced && <>
              {/* API Keys -- collapsible */}
              <section className="mb-6">
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      <h2 className="text-sm font-semibold">Cles API</h2>
                      {!showApiKeys && hasAnyKey && (
                        <span className="text-[10px] text-muted-foreground">Memorisees</span>
                      )}
                    </div>
                    <button onClick={() => setShowApiKeys(!showApiKeys)} className="text-xs text-muted-foreground hover:text-foreground">
                      {showApiKeys ? "Masquer" : "Modifier"}
                    </button>
                  </div>
                  {showApiKeys && (
                    <div className="mt-3 space-y-3">
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-2">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <span className="inline-block h-2 w-2 rounded-full bg-[#D97706]" />
                        Claude — <span className="text-primary">disponible (clé serveur)</span>
                      </div>
                    </div>
                      <div>
                        <label className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <span className="inline-block h-2 w-2 rounded-full bg-[#10A37F]" />
                          OpenAI {usedProviders.has("openai") && <span className="text-primary">*requis</span>}
                        </label>
                        <input
                          type="password"
                          value={apiKeys.openai || ""}
                          onChange={(e) => updateApiKeyAndSave("openai", e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          placeholder="sk-..."
                        />
                      </div>
                      <div>
                        <label className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <span className="inline-block h-2 w-2 rounded-full bg-[#4285F4]" />
                          Google (Gemini) {usedProviders.has("gemini") && <span className="text-primary">*requis</span>}
                        </label>
                        <input
                          type="password"
                          value={apiKeys.gemini || ""}
                          onChange={(e) => updateApiKeyAndSave("gemini", e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          placeholder="AIza..."
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">Memorisees dans votre navigateur (localStorage).</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Discussion settings */}
              <section className="mb-8">
                <h2 className="mb-3 text-lg font-semibold">Parametres</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Mode</label>
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value as DiscussionMode)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="exploration">Exploration</option>
                      <option value="decision">Decision</option>
                      <option value="deliverable">Livrable</option>
                    </select>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {mode === "exploration" && "Discussion ouverte, brainstorming"}
                      {mode === "decision" && "Debat contradictoire + vote final"}
                      {mode === "deliverable" && "Production iterative d'un document"}
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Mode utilisateur</label>
                    <select
                      value={userMode}
                      onChange={(e) => setUserMode(e.target.value as UserMode)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="observer">Observateur</option>
                      <option value="interventionist">Interventionniste</option>
                      <option value="director">Directeur</option>
                    </select>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {userMode === "observer" && "Vous regardez sans intervenir"}
                      {userMode === "interventionist" && "Vous pouvez envoyer des messages, recadrer ou relancer"}
                      {userMode === "director" && "Controle total : pause, synthese, vote anticipe"}
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Tours max</label>
                    <input
                      type="number"
                      value={maxTurns}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") { setMaxTurns(0 as unknown as number); return; }
                        setMaxTurns(Number(val));
                      }}
                      onBlur={() => setMaxTurns(Math.max(3, Math.min(50, maxTurns || 10)))}
                      min={3}
                      max={50}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Langue</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="fr">Francais</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Agents */}
              <section className="mb-8">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Participants ({agents.length}/6)</h2>
                  <div className="flex gap-2">
                    {agents.length < 6 && (
                      <>
                        <button
                          onClick={() => setShowExpertPool(!showExpertPool)}
                          className="rounded-lg border border-primary/30 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/10"
                        >
                          + Expert du pool
                        </button>
                        <button
                          onClick={addAgent}
                          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                        >
                          + Agent vide
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">Minimum 2, maximum 6. Chacun peut utiliser un provider et modele differents.</p>

                {/* Expert pool browser */}
                {showExpertPool && (
                  <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-primary">Pool d'experts ({EXPERT_POOL.length})</h3>
                      <button onClick={() => setShowExpertPool(false)} className="text-xs text-muted-foreground hover:text-foreground">Fermer</button>
                    </div>
                    <input
                      type="text"
                      value={expertFilter}
                      onChange={(e) => setExpertFilter(e.target.value)}
                      className="mb-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                      placeholder="Rechercher par nom, domaine, expertise, tag..."
                    />
                    <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                      {filteredExperts.map((expert) => {
                        const alreadyAdded = agents.some((a) => a.expertId === expert.id);
                        return (
                          <button
                            key={expert.id}
                            onClick={() => !alreadyAdded && addExpertFromPool(expert)}
                            disabled={alreadyAdded || agents.length >= 6}
                            className={`rounded-lg border p-3 text-left transition-all ${
                              alreadyAdded
                                ? "border-primary/30 bg-primary/5 opacity-60"
                                : "border-border bg-card hover:border-primary hover:bg-muted"
                            } disabled:cursor-not-allowed`}
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <span className="text-sm font-medium">{expert.name}</span>
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                                expert.domain === "tech" ? "bg-blue-500/10 text-blue-500"
                                  : expert.domain === "business" ? "bg-amber-500/10 text-amber-500"
                                    : expert.domain === "creative" ? "bg-violet-500/10 text-violet-500"
                                      : expert.domain === "human" ? "bg-emerald-500/10 text-emerald-500"
                                        : expert.domain === "data" ? "bg-cyan-500/10 text-cyan-500"
                                          : expert.domain === "academic" ? "bg-rose-500/10 text-rose-500"
                                            : "bg-border text-muted-foreground"
                              }`}>
                                {expert.domain}
                              </span>
                              {alreadyAdded && <span className="text-[9px] text-primary">ajoute</span>}
                            </div>
                            <p className="text-[10px] text-muted-foreground">{expert.title}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {agents.map((agent, index) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      index={index}
                      onUpdate={(a) => updateAgent(index, a)}
                      onRemove={() => removeAgent(index)}
                      canRemove={agents.length > 2}
                      apiKeys={apiKeys}
                      mode={mode}
                    />
                  ))}
                </div>
              </section>
            </>}

            {/* Launch button */}
            <div className="sticky bottom-0 border-t border-border bg-background py-4">
              <button
                onClick={startDiscussion}
                disabled={!canStart}
                className="w-full rounded-xl bg-primary py-3 text-center font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Lancer la discussion
              </button>
              {!hasRequiredKey && (
                <p className="mt-2 text-center text-xs text-destructive">
                  Cle API manquante pour le provider des agents.
                </p>
              )}
            </div>

          </>
        )}
        </>)}
      </main>
    </ModuleLayout>
  );
}
