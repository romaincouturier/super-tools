import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import type { SessionConfig, AgentConfig, DiscussionMode, UserMode, ApiKeys, Template } from "@/lib/arena/types";
import { AGENT_COLORS } from "@/lib/arena/types";
import { TEMPLATES } from "@/lib/arena/templates";
import { getSavedSessions, deleteSession, type SavedSession } from "@/lib/arena/history";
import { getCustomTemplates, saveCustomTemplate, deleteCustomTemplate, type CustomTemplate } from "@/lib/arena/customTemplates";
import { EXPERT_POOL, type ExpertProfile } from "@/lib/arena/experts";
import { createDefaultAgent } from "@/lib/arena/store";
import { CLAUDE_DEFAULT } from "@/lib/claude-models";
import { callSuggestExperts, loadArenaApiKeys, saveArenaApiKeys } from "@/lib/arena/api";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

export interface UseArenaSetupReturn {
  // State
  topic: string;
  setTopic: React.Dispatch<React.SetStateAction<string>>;
  additionalContext: string;
  setAdditionalContext: React.Dispatch<React.SetStateAction<string>>;
  mode: DiscussionMode;
  setMode: React.Dispatch<React.SetStateAction<DiscussionMode>>;
  userMode: UserMode;
  setUserMode: React.Dispatch<React.SetStateAction<UserMode>>;
  maxTurns: number;
  setMaxTurns: React.Dispatch<React.SetStateAction<number>>;
  maxTokensPerTurn: number;
  language: string;
  setLanguage: React.Dispatch<React.SetStateAction<string>>;
  apiKeys: ApiKeys;
  setApiKeys: React.Dispatch<React.SetStateAction<ApiKeys>>;
  showApiKeys: boolean;
  setShowApiKeys: React.Dispatch<React.SetStateAction<boolean>>;
  selectedTemplate: string | null;
  showAdvanced: boolean;
  setShowAdvanced: React.Dispatch<React.SetStateAction<boolean>>;
  agents: AgentConfig[];
  history: SavedSession[];
  customTemplates: CustomTemplate[];
  showSaveTemplate: boolean;
  setShowSaveTemplate: React.Dispatch<React.SetStateAction<boolean>>;
  newTemplateName: string;
  setNewTemplateName: React.Dispatch<React.SetStateAction<string>>;
  newTemplateDesc: string;
  setNewTemplateDesc: React.Dispatch<React.SetStateAction<string>>;
  isSuggesting: boolean;
  suggestions: { id: string; reason: string; suggestedStance?: string }[];
  showExpertPool: boolean;
  setShowExpertPool: React.Dispatch<React.SetStateAction<boolean>>;
  expertFilter: string;
  setExpertFilter: React.Dispatch<React.SetStateAction<string>>;
  feedbackHistory: { date: string; topic: string; mode: string; rating: number; feedback?: string; cost: number; turns: number }[];
  showSidebar: boolean;
  setShowSidebar: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading: boolean;
  isFirstVisit: boolean;
  setIsFirstVisit: React.Dispatch<React.SetStateAction<boolean>>;
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;

  // Speech recognition
  isListening: boolean;
  micSupported: boolean;
  voiceToTopic: () => void;

  // Computed
  filteredExperts: ExpertProfile[];
  hasRequiredKey: boolean;
  canStart: boolean;
  hasAnyKey: boolean;
  usedProviders: Set<string>;
  modeLabel: Record<DiscussionMode, string>;

  // Handlers
  addAgent: () => void;
  removeAgent: (index: number) => void;
  updateAgent: (index: number, agent: AgentConfig) => void;
  applyTemplate: (templateId: string) => void;
  handleSaveTemplate: () => void;
  handleDeleteCustomTemplate: (id: string) => void;
  handleViewSession: (session: SavedSession) => void;
  handleReuseSession: (session: SavedSession) => void;
  handleDeleteSession: (id: string) => void;
  handleSuggestExperts: () => Promise<void>;
  addExpertFromPool: (expert: ExpertProfile) => void;
  startDiscussion: () => void;
  saveFirstVisitKeys: () => void;
  updateApiKeyAndSave: (key: keyof ApiKeys, value: string) => void;
}

export function useArenaSetup(): UseArenaSetupReturn {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [mode, setMode] = useState<DiscussionMode>("exploration");
  const [userMode, setUserMode] = useState<UserMode>("observer");
  const [maxTurns, setMaxTurns] = useState(10);
  const [maxTokensPerTurn, setMaxTokensPerTurn] = useState(1500);
  const [language, setLanguage] = useState("fr");
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ claude: "", openai: "", gemini: "" });
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [agents, setAgents] = useState<AgentConfig[]>([
    createDefaultAgent(0),
    createDefaultAgent(1),
  ]);
  const [history, setHistory] = useState<SavedSession[]>([]);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ id: string; reason: string; suggestedStance?: string }[]>([]);
  const [showExpertPool, setShowExpertPool] = useState(false);
  const [expertFilter, setExpertFilter] = useState("");
  const [feedbackHistory, setFeedbackHistory] = useState<{ date: string; topic: string; mode: string; rating: number; feedback?: string; cost: number; turns: number }[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id;
      setUserId(uid);
      setHistory(getSavedSessions(uid));
    });
    setCustomTemplates(getCustomTemplates());
    try {
      const fb = JSON.parse(localStorage.getItem("ai-arena-feedback") || "[]");
      setFeedbackHistory(fb.reverse());
    } catch { /* ignore */ }
    // Load persisted API keys via loadArenaApiKeys
    loadArenaApiKeys().then((saved) => {
      setApiKeys(saved);
      // Claude is always available via server-side key, skip onboarding
      setShowApiKeys(false);
      setIsFirstVisit(false);
      setStep(1); // go straight to topic
      // Adapt default agents to available provider if user has OpenAI/Gemini keys
      if (saved.openai || saved.gemini) {
        const p: "claude" | "openai" | "gemini" = saved.openai ? "openai" : "gemini";
        // Keep claude as default, just load saved keys
      }
      setIsLoading(false);
    }).catch(() => {
      // Claude is still available server-side even on error
      setShowApiKeys(false);
      setIsFirstVisit(false);
      setStep(1);
      setIsLoading(false);
    });
  }, []);

  const { isListening, isSupported: micSupported, startListening, stopListening } = useSpeechRecognition(language === "fr" ? "fr-FR" : "en-US");

  const voiceToTopic = useCallback(() => {
    if (isListening) { stopListening(); return; }
    startListening((text) => setTopic((prev) => prev ? prev + " " + text : text));
  }, [isListening, startListening, stopListening]);

  const addAgent = () => {
    if (agents.length >= 6) return;
    setAgents([...agents, createDefaultAgent(agents.length)]);
  };

  const removeAgent = (index: number) => {
    if (agents.length <= 2) return;
    setAgents(agents.filter((_, i) => i !== index));
  };

  const updateAgent = (index: number, agent: AgentConfig) => {
    const updated = [...agents];
    updated[index] = agent;
    setAgents(updated);
  };

  const applyTemplate = (templateId: string) => {
    const template: Template | undefined = TEMPLATES.find((t) => t.id === templateId) || customTemplates.find((t) => t.id === templateId);
    if (!template) return;
    setSelectedTemplate(templateId);
    setMode(template.mode);
    setMaxTurns(template.rules.maxTurns);
    setMaxTokensPerTurn(template.rules.maxTokensPerTurn);
    setLanguage(template.rules.language);
    // Adapt agents to available provider
    const availableProvider: "claude" | "openai" | "gemini" = "claude";
    const defaultModel = CLAUDE_DEFAULT;
    setAgents(
      template.agents.map((a, i) => ({
        ...a,
        id: uuidv4(),
        provider: availableProvider,
        model: defaultModel,
        color: a.color || AGENT_COLORS[i % AGENT_COLORS.length],
      }))
    );
  };

  const handleSaveTemplate = () => {
    if (!newTemplateName.trim()) return;
    const id = "custom-" + Date.now().toString(36);
    const template = saveCustomTemplate({
      id,
      name: newTemplateName.trim(),
      description: newTemplateDesc.trim() || `Template personnalise avec ${agents.length} agents`,
      mode,
      agents: agents.map(({ id: _id, ...rest }) => rest),
      rules: { maxTurns, maxTokensPerTurn, language },
    });
    setCustomTemplates([template, ...customTemplates.filter((t) => t.id !== id)]);
    setShowSaveTemplate(false);
    setNewTemplateName("");
    setNewTemplateDesc("");
    setSelectedTemplate(id);
  };

  const handleDeleteCustomTemplate = (id: string) => {
    deleteCustomTemplate(id);
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
    if (selectedTemplate === id) setSelectedTemplate(null);
  };

  const handleViewSession = (session: SavedSession) => {
    sessionStorage.setItem("ai-arena-config", JSON.stringify(session.config));
    sessionStorage.setItem("ai-arena-result", JSON.stringify(session.result));
    sessionStorage.setItem("ai-arena-start-time", String(new Date(session.date).getTime()));
    navigate("/arena/results");
  };

  const handleReuseSession = (session: SavedSession) => {
    const c = session.config;
    setTopic(c.topic);
    setAdditionalContext(c.additionalContext || "");
    setMode(c.mode);
    setUserMode(c.userMode);
    setMaxTurns(c.rules.maxTurns);
    setMaxTokensPerTurn(c.rules.maxTokensPerTurn);
    setLanguage(c.rules.language);
    setAgents(c.agents.map((a, i) => ({ ...a, id: uuidv4(), color: a.color || AGENT_COLORS[i % AGENT_COLORS.length] })));
    setSelectedTemplate(null);
  };

  const handleDeleteSession = (id: string) => {
    deleteSession(id, userId);
    setHistory((prev) => prev.filter((s) => s.id !== id));
  };

  const expertToAgent = (expert: ExpertProfile, index: number, stance?: string): AgentConfig => {
    const p: "claude" | "openai" | "gemini" = "claude";
    const m = CLAUDE_DEFAULT;
    return {
      id: uuidv4(),
      name: expert.name,
      provider: p,
      model: m,
      role: `${expert.title} - ${expert.expertise.slice(0, 80)}`,
      personality: expert.personality,
      stance: (stance as AgentConfig["stance"]) || expert.defaultStance,
      color: AGENT_COLORS[index % AGENT_COLORS.length],
      expertId: expert.id,
      frameworks: expert.frameworks,
      biases: expert.biases,
      style: expert.style,
    };
  };

  const handleSuggestExperts = async () => {
    const suggestKey = "server-managed"; // Claude key is server-side
    const suggestProvider = "claude" as const;
    if (!topic.trim()) return;
    setIsSuggesting(true);
    setSuggestions([]);
    try {
      const res = await callSuggestExperts({
        apiKey: suggestKey,
        provider: suggestProvider,
        topic,
        mode,
        language,
      });
      const data = await res.json();
      if (data.experts && data.experts.length > 0) {
        setSuggestions(data.experts);
        // Auto-apply suggestions
        const newAgents = data.experts.map((s: { id: string; suggestedStance?: string }, i: number) => {
          const expert = EXPERT_POOL.find((e) => e.id === s.id);
          if (!expert) return createDefaultAgent(i);
          return expertToAgent(expert, i, s.suggestedStance);
        });
        setAgents(newAgents);
        setSelectedTemplate(null);
        if (data.suggestedMode && data.suggestedMode !== mode) {
          setMode(data.suggestedMode);
        }
      }
    } catch { /* ignore */ }
    setIsSuggesting(false);
  };

  const addExpertFromPool = (expert: ExpertProfile) => {
    if (agents.length >= 6) return;
    setAgents([...agents, expertToAgent(expert, agents.length)]);
    setShowExpertPool(false);
    setSelectedTemplate(null);
  };

  const filteredExperts = expertFilter.trim()
    ? EXPERT_POOL.filter((e) => {
        const q = expertFilter.toLowerCase();
        return e.name.toLowerCase().includes(q) ||
          e.title.toLowerCase().includes(q) ||
          e.domain.includes(q) ||
          e.tags.some((t) => t.includes(q));
      })
    : EXPERT_POOL;

  // At least one provider key + topic + agents named
  const hasRequiredKey = agents.every((a) => {
    if (a.provider === "claude") return true; // Server-side key
    if (a.provider === "openai") return !!apiKeys.openai?.trim();
    if (a.provider === "gemini") return !!apiKeys.gemini?.trim();
    return false;
  });
  const canStart = topic.trim().length > 0 && hasRequiredKey && agents.every((a) => a.name.trim().length > 0);
  const hasAnyKey = true; // Claude is always available via server key

  const startDiscussion = () => {
    if (!canStart) return;
    const config: SessionConfig = {
      topic,
      additionalContext: additionalContext || undefined,
      mode,
      userMode,
      agents,
      rules: { maxTurns, maxTokensPerTurn, language },
    };
    sessionStorage.setItem("ai-arena-config", JSON.stringify(config));
    sessionStorage.setItem("ai-arena-api-keys", JSON.stringify(apiKeys));
    // Persist keys via saveArenaApiKeys
    saveArenaApiKeys(apiKeys);
    setIsFirstVisit(false);
    navigate("/arena/discussion");
  };

  const modeLabel: Record<DiscussionMode, string> = {
    exploration: "Exploration",
    decision: "Decision",
    deliverable: "Livrable",
  };

  const usedProviders = new Set(agents.map((a) => a.provider));

  const saveFirstVisitKeys = () => {
    saveArenaApiKeys(apiKeys);
    setIsFirstVisit(false);
    setShowApiKeys(false);
    setStep(1);
  };

  const updateApiKeyAndSave = (key: keyof ApiKeys, value: string) => {
    const k = { ...apiKeys, [key]: value };
    setApiKeys(k);
    saveArenaApiKeys(k);
  };

  return {
    // State
    topic,
    setTopic,
    additionalContext,
    setAdditionalContext,
    mode,
    setMode,
    userMode,
    setUserMode,
    maxTurns,
    setMaxTurns,
    maxTokensPerTurn,
    language,
    setLanguage,
    apiKeys,
    setApiKeys,
    showApiKeys,
    setShowApiKeys,
    selectedTemplate,
    showAdvanced,
    setShowAdvanced,
    agents,
    history,
    customTemplates,
    showSaveTemplate,
    setShowSaveTemplate,
    newTemplateName,
    setNewTemplateName,
    newTemplateDesc,
    setNewTemplateDesc,
    isSuggesting,
    suggestions,
    showExpertPool,
    setShowExpertPool,
    expertFilter,
    setExpertFilter,
    feedbackHistory,
    showSidebar,
    setShowSidebar,
    isLoading,
    isFirstVisit,
    setIsFirstVisit,
    step,
    setStep,

    // Speech recognition
    isListening,
    micSupported,
    voiceToTopic,

    // Computed
    filteredExperts,
    hasRequiredKey,
    canStart,
    hasAnyKey,
    usedProviders,
    modeLabel,

    // Handlers
    addAgent,
    removeAgent,
    updateAgent,
    applyTemplate,
    handleSaveTemplate,
    handleDeleteCustomTemplate,
    handleViewSession,
    handleReuseSession,
    handleDeleteSession,
    handleSuggestExperts,
    addExpertFromPool,
    startDiscussion,
    saveFirstVisitKeys,
    updateApiKeyAndSave,
  };
}
