import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type {
  SessionConfig,
  Message,
  ApiKeys,
  OrchestratorDecision,
  VoteResult,
  DiscussionState,
} from "@/lib/arena/types";
import { estimateCost } from "@/lib/arena/types";
import { buildSlidingContext } from "@/lib/arena/store";
import { exportToMarkdown, downloadMarkdown } from "@/lib/arena/export";
import { saveSession } from "@/lib/arena/history";
import { callOrchestrate, callOrchestratorApi } from "@/lib/arena/api";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { v4 as uuidv4 } from "uuid";

function buildSystemPrompt(agent: SessionConfig["agents"][0], config: SessionConfig): string {
  const modeInstr = {
    exploration: "Discussion ouverte et exploratoire.",
    decision: `Debat contradictoire. ${agent.stance === "pour" ? "Tu DEFENDS la position." : agent.stance === "contre" ? "Tu ATTAQUES la position." : "Tu es NEUTRE et analyses les deux cotes."}`,
    deliverable:
      "Discussion orientee vers la production d'un livrable concret. Concentre-toi sur les contributions constructives.",
  };

  // Rich expert context
  const expertContext: string[] = [];
  if (agent.frameworks && agent.frameworks.length > 0) {
    expertContext.push(`Tes frameworks et references : ${agent.frameworks.join(", ")}`);
  }
  if (agent.biases) {
    expertContext.push(`Tes biais connus (sois-en conscient) : ${agent.biases}`);
  }
  if (agent.style) {
    expertContext.push(`Ton style de communication : ${agent.style}`);
  }

  // Context files
  const filesContext =
    agent.contextFiles && agent.contextFiles.length > 0
      ? `\n\nDocuments de reference que tu as lu :\n${agent.contextFiles.map((f) => `--- ${f.name} ---\n${f.content.slice(0, 8000)}`).join("\n\n")}`
      : "";

  return `Tu participes a une discussion de groupe sur le sujet suivant :
${config.topic}

${config.additionalContext ? `Contexte additionnel : ${config.additionalContext}` : ""}

Mode : ${modeInstr[config.mode]}

Ton role : ${agent.role || "Participant"}
Ta personnalite : ${agent.personality || "Neutre et constructif"}
${agent.stance ? `Ta position initiale : ${agent.stance}` : ""}
${expertContext.length > 0 ? `\n${expertContext.join("\n")}` : ""}

Regles de la discussion :
- LONGUEUR : Vise 250 a 400 mots maximum par intervention. Sois dense et percutant, pas exhaustif.
- TERMINE TOUJOURS tes idees -- mieux vaut 2 arguments complets que 5 inacheves. Conclus toujours proprement.
- REAGIS aux interventions precedentes : cite les noms des autres participants, dis si tu es d'accord ou non, et POURQUOI.
- NE REPETE PAS ce qui a ete dit. Si un point a deja ete fait, dis "comme l'a dit [nom]" et ajoute de la valeur.
- RELIE toujours tes points au SUJET CENTRAL de la discussion. Ne pars pas dans des tangentes.
- Structure ta reponse : commence par ta position claire, puis developpe 2-3 arguments cles. Pas de listes interminables.
- Adresse-toi directement aux autres participants par leur nom.
- Utilise tes frameworks de reference quand c'est pertinent, sans les forcer.
- Langue : ${config.rules.language === "fr" ? "francais" : "anglais"}${filesContext}`;
}

function computeTokensPerAgent(messages: Message[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const msg of messages) {
    if (!msg.isUser && !msg.isSynthesis && !msg.isDeliverable && msg.tokenCount) {
      result[msg.agentId] = (result[msg.agentId] || 0) + msg.tokenCount;
    }
  }
  return result;
}

export function useArenaDiscussion() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");
  const [turnNumber, setTurnNumber] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalInputTokens, setTotalInputTokens] = useState(0);
  const [estimatedCostUsd, setEstimatedCostUsd] = useState(0);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [discussionState, setDiscussionState] = useState<DiscussionState>("active");
  const [votes, setVotes] = useState<VoteResult[]>([]);
  const [interventionType, setInterventionType] = useState<"message" | "recadrer" | "relancer">(
    "message",
  );
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const lang = config?.rules.language === "fr" ? "fr-FR" : "en-US";
  const {
    isListening,
    isSupported: micSupported,
    startListening,
    stopListening,
  } = useSpeechRecognition(lang);
  const voiceToInput = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }
    startListening((text) => setUserInput((prev) => (prev ? prev + " " + text : text)));
  }, [isListening, startListening, stopListening]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userHasScrolledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const pauseRef = useRef(false);
  const userMessagesRef = useRef<Message[]>([]);
  const [waitingForUser, setWaitingForUser] = useState(false);
  const continueResolverRef = useRef<((overrideAgentId?: string) => void) | null>(null);
  const [nextSpeakerSuggestion, setNextSpeakerSuggestion] = useState<{
    agentId: string;
    agentName: string;
    instruction: string;
  } | null>(null);
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    pauseRef.current = isPaused;
  }, [isPaused]);

  // Step-by-step: pause after each agent turn and wait for user to continue
  const waitForUserContinue = useCallback(
    (suggestion?: {
      agentId: string;
      agentName: string;
      instruction: string;
    }): Promise<string | undefined> => {
      return new Promise((resolve) => {
        continueResolverRef.current = resolve as (overrideAgentId?: string) => void;
        setNextSpeakerSuggestion(suggestion || null);
        setWaitingForUser(true);
      });
    },
    [],
  );

  const handleContinueStep = useCallback(
    (overrideAgentId?: string) => {
      // If user typed something, inject it as a message first
      if (userInput.trim() && config) {
        const userMessage: Message = {
          id: uuidv4(),
          agentId: "user",
          agentName: "Utilisateur",
          agentColor: "#6B7280",
          content: userInput.trim(),
          turnNumber: turnNumber,
          timestamp: Date.now(),
          isUser: true,
        };
        userMessagesRef.current.push(userMessage);
        setMessages((prev) => [...prev, userMessage]);
        setUserInput("");
      }
      // Reset auto-scroll so next agent response scrolls into view
      userHasScrolledRef.current = false;
      setWaitingForUser(false);
      setNextSpeakerSuggestion(null);
      if (continueResolverRef.current) {
        continueResolverRef.current(overrideAgentId);
        continueResolverRef.current = null;
      }
    },
    [userInput, config, turnNumber],
  );

  // Smart auto-scroll: only scroll down if user is near the bottom
  const scrollToBottom = useCallback(() => {
    if (!userHasScrolledRef.current) {
      requestAnimationFrame(() => {
        const el = scrollContainerRef.current;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Detect user scroll
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const scrolledAway = distanceFromBottom > 150;
    userHasScrolledRef.current = scrolledAway;
    setShowScrollButton(scrolledAway);
  }, []);

  const forceScrollToBottom = useCallback(() => {
    userHasScrolledRef.current = false;
    setShowScrollButton(false);
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // Persist messages to sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem("ai-arena-messages", JSON.stringify(messages));
      sessionStorage.setItem("ai-arena-turn", String(turnNumber));
    }
  }, [messages, turnNumber]);

  // Fetch user ID for per-user history isolation
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id);
    });
  }, []);

  useEffect(() => {
    const configStr = sessionStorage.getItem("ai-arena-config");
    const keysStr =
      sessionStorage.getItem("ai-arena-api-keys") || localStorage.getItem("ai-arena-api-keys");
    if (!configStr) {
      navigate("/arena");
      return;
    }
    try {
      setConfig(JSON.parse(configStr));
      if (keysStr) setApiKeys(JSON.parse(keysStr));
      const savedMessages = sessionStorage.getItem("ai-arena-messages");
      const savedTurn = sessionStorage.getItem("ai-arena-turn");
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages) as Message[];
        if (parsed.length > 0) {
          setMessages(parsed);
          setTurnNumber(savedTurn ? parseInt(savedTurn, 10) : parsed.length);
          setWaitingForUser(true);
        }
      }
    } catch (error) {
      console.warn("Failed to parse arena session data:", error);
      navigate("/arena");
    }
  }, [navigate]);

  const getApiKey = useCallback(
    (provider: string): string => {
      if (provider === "openai") return apiKeys.openai || "";
      if (provider === "gemini") return apiKeys.gemini || "";
      return "server-managed";
    },
    [apiKeys],
  );

  const streamResponse = useCallback(
    async (
      response: Response,
      agentId: string,
      existingContent: string = "",
    ): Promise<{ content: string; outputTokens: number; inputTokens: number }> => {
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullContent = existingContent;
      let outputTokens = 0;
      let inputTokens = 0;
      let sseBuffer = "";

      setCurrentSpeaker(agentId);
      if (!existingContent) {
        setStreamingContent("");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            if (!data) continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "content") {
                fullContent += parsed.text;
                setStreamingContent(fullContent);
              } else if (parsed.type === "usage") {
                outputTokens = parsed.outputTokens || 0;
                inputTokens = parsed.inputTokens || 0;
              } else if (parsed.type === "error") {
                throw new Error(parsed.message);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      return { content: fullContent, outputTokens, inputTokens };
    },
    [],
  );

  const callAgent = useCallback(
    async (
      agentConfig: SessionConfig["agents"][0],
      instruction: string,
      history: Message[],
    ): Promise<{ content: string; outputTokens: number; inputTokens: number }> => {
      const apiKey = getApiKey(agentConfig.provider);
      const systemPrompt = agentConfig.systemPrompt || buildSystemPrompt(agentConfig, config!);
      const contextHistory = buildSlidingContext(history);

      const response = await callOrchestrate(
        {
          provider: agentConfig.provider,
          apiKey,
          model: agentConfig.model,
          systemPrompt,
          turnInstruction: instruction,
          history: contextHistory,
          topic: config!.topic,
          maxTokens: 4096,
        },
        abortRef.current?.signal,
      );

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || `HTTP ${response.status}`);
      }

      const result = await streamResponse(response, agentConfig.id);

      setCurrentSpeaker(null);
      setStreamingContent("");
      return result;
    },
    [config, getApiKey, streamResponse],
  );

  const callOrchestrator = useCallback(
    async (history: Message[], turn: number): Promise<OrchestratorDecision> => {
      if (!config) throw new Error("No config");
      const orchKey = "server-managed";
      const orchProvider = "claude" as const;
      if (!orchKey) {
        const agentIndex = (turn - 1) % config.agents.length;
        return {
          nextSpeaker: config.agents[agentIndex].id,
          instruction: "Continue la discussion.",
          discussionState: turn >= config.rules.maxTurns * 0.9 ? "ready_to_conclude" : "active",
          keyPointsSoFar: [],
          turnNumber: turn,
        };
      }

      try {
        const contextHistory = buildSlidingContext(history, 15);
        const response = await callOrchestratorApi(
          {
            apiKey: orchKey,
            provider: orchProvider,
            topic: config.topic,
            mode: config.mode,
            agents: config.agents.map((a) => ({
              id: a.id,
              name: a.name,
              role: a.role,
              personality: a.personality,
              stance: a.stance,
            })),
            history: contextHistory,
            turnNumber: turn,
            maxTurns: config.rules.maxTurns,
            language: config.rules.language,
          },
          abortRef.current?.signal,
        );

        if (!response.ok) throw new Error("Orchestrator failed");
        const decision = await response.json();
        return { ...decision, turnNumber: turn };
      } catch (error) {
        console.warn("Orchestrator call failed, using round-robin fallback:", error);
        const agentIndex = (turn - 1) % config.agents.length;
        return {
          nextSpeaker: config.agents[agentIndex].id,
          instruction: "Continue la discussion avec ton point de vue.",
          discussionState: "active" as DiscussionState,
          keyPointsSoFar: [],
          turnNumber: turn,
        };
      }
    },
    [config],
  );

  const runVoting = useCallback(
    async (allMessages: Message[]): Promise<VoteResult[]> => {
      if (!config) return [];
      const voteResults: VoteResult[] = [];

      for (const agent of config.agents) {
        const apiKey = getApiKey(agent.provider);
        const contextHistory = buildSlidingContext(allMessages, 10);

        const voteInstruction = `La phase de debat est terminee. Tu dois maintenant VOTER.
Donne ta decision finale sous forme structuree :
1. TON VOTE : une reponse claire et directe a la question/sujet
2. TES ARGUMENTS : les 2-3 arguments principaux qui justifient ta position
Sois concis et tranche.`;

        const systemPrompt =
          buildSystemPrompt(agent, config) +
          "\n\nIMPORTANT: C'est la phase de vote final. Tu dois donner une reponse claire et argumentee.";

        try {
          const response = await callOrchestrate(
            {
              provider: agent.provider,
              apiKey,
              model: agent.model,
              systemPrompt,
              turnInstruction: voteInstruction,
              history: contextHistory,
              topic: config.topic,
              maxTokens: 400,
            },
            abortRef.current?.signal,
          );

          if (!response.ok) continue;

          const reader = response.body?.getReader();
          if (!reader) continue;

          const decoder = new TextDecoder();
          let voteContent = "";

          setCurrentSpeaker(agent.id);
          setStreamingContent("");

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === "content") {
                    voteContent += parsed.text;
                    setStreamingContent(voteContent);
                  }
                } catch {
                  /* intentionally empty – skip malformed SSE chunks */
                }
              }
            }
          }

          const voteMsg: Message = {
            id: uuidv4(),
            agentId: agent.id,
            agentName: agent.name,
            agentColor: agent.color,
            provider: agent.provider,
            content: voteContent,
            turnNumber: 999,
            timestamp: Date.now(),
            isVote: true,
          };

          allMessages.push(voteMsg);
          setMessages([...allMessages]);

          voteResults.push({
            agentId: agent.id,
            agentName: agent.name,
            vote: voteContent.slice(0, 200),
            reasoning: voteContent,
          });
        } catch (error) {
          console.warn("Vote collection failed for agent:", agent.id, error);
        }
      }

      setCurrentSpeaker(null);
      setStreamingContent("");
      return voteResults;
    },
    [config, getApiKey],
  );

  const generateFinalOutput = useCallback(
    async (allMessages: Message[], outputType: "synthesis" | "deliverable"): Promise<string> => {
      if (!config) return "";
      const finalKey =
        getApiKey(config.agents[0].provider) ||
        apiKeys.claude ||
        apiKeys.openai ||
        apiKeys.gemini ||
        "";
      const model = config.agents[0].model;
      const contextHistory = buildSlidingContext(allMessages, 25);
      const langLabel = config.rules.language === "fr" ? "francais" : "anglais";

      const prompts: Record<string, { system: string; instruction: string; tokens: number }> = {
        synthesis: {
          system: `Tu es un expert en synthese de discussions de groupe. Produis une synthese STRUCTUREE et ACTIONNABLE. Reponds en ${langLabel}.

Ta synthese doit contenir :
1. RESUME EXECUTIF (3-5 lignes) : la reponse a la question de depart en une phrase, puis les conclusions cles
2. POINTS DE CONSENSUS : ce sur quoi tous les experts sont d'accord
3. POINTS DE DESACCORD : les positions divergentes et pourquoi
4. RECOMMANDATIONS CONCRETES : les 3-5 actions a retenir
5. QUESTIONS OUVERTES : ce qui reste a explorer

IMPORTANT : Si un livrable a deja ete produit, NE PAS repeter son contenu. Concentre-toi sur les dynamiques de la discussion et les meta-enseignements.`,
          instruction: `Produis la synthese finale de cette discussion sur "${config.topic}". Rappel : reponds au SUJET CENTRAL, pas aux tangentes.`,
          tokens: 2500,
        },
        deliverable: {
          system: `Tu es un expert en redaction de documents professionnels. A partir de la discussion suivante, produis le LIVRABLE FINAL demande. Reponds en ${langLabel}.

REGLES CRITIQUES pour le livrable :
1. Le document DOIT repondre directement au SUJET CENTRAL de la discussion
2. Structure avec des titres clairs (##), des sous-sections, et des points actionables
3. Integre les MEILLEURES contributions de chaque participant -- cite-les quand c'est pertinent
4. Le document doit etre COMPLET et DIRECTEMENT UTILISABLE -- pas de sections tronquees
5. Termine par des recommandations concretes et des prochaines etapes
6. Ne liste pas tout ce qui a ete dit -- SYNTHETISE et STRUCTURE les idees en un document coherent`,
          instruction: `Produis le livrable final et COMPLET sur le sujet "${config.topic}". Le document doit etre structure, exhaustif et directement exploitable. TERMINE toutes les sections -- aucune section ne doit etre laissee vide ou tronquee.`,
          tokens: 4000,
        },
      };

      const { system, instruction, tokens } = prompts[outputType];

      setCurrentSpeaker(outputType === "deliverable" ? "deliverable" : "synthesis");
      setStreamingContent("");

      const response = await callOrchestrate({
        provider: config.agents[0].provider,
        apiKey: finalKey,
        model,
        systemPrompt: system,
        turnInstruction: instruction,
        history: contextHistory,
        topic: config.topic,
        maxTokens: tokens,
      });

      if (!response.ok) return "";

      const reader = response.body?.getReader();
      if (!reader) return "";

      const decoder = new TextDecoder();
      let content = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "content") {
                content += parsed.text;
                setStreamingContent(content);
              }
            } catch {
              /* intentionally empty – skip malformed SSE chunks */
            }
          }
        }
      }

      setCurrentSpeaker(null);
      setStreamingContent("");
      return content;
    },
    [config, apiKeys, getApiKey],
  );

  const runDiscussion = useCallback(async () => {
    if (!config) return;
    setIsRunning(true);
    setError(null);
    abortRef.current = new AbortController();

    sessionStorage.removeItem("ai-arena-messages");
    sessionStorage.removeItem("ai-arena-turn");

    const allMessages: Message[] = [];
    let currentTurn = 0;
    let tokensUsed = 0;
    let inputTokensUsed = 0;
    let costAccumulated = 0;

    let pendingDecision: OrchestratorDecision | null = null;

    try {
      for (let turn = 0; turn < config.rules.maxTurns; turn++) {
        currentTurn = turn + 1;
        setTurnNumber(currentTurn);

        while (pauseRef.current) {
          await new Promise((r) => setTimeout(r, 500));
        }
        if (abortRef.current?.signal.aborted) throw new Error("Discussion arretee");

        let decision: OrchestratorDecision;
        if (pendingDecision) {
          decision = pendingDecision;
          pendingDecision = null;
        } else {
          decision = await callOrchestrator(allMessages, currentTurn);
        }
        setDiscussionState(decision.discussionState);
        if (decision.keyPointsSoFar?.length) setKeyPoints(decision.keyPointsSoFar);

        if (decision.discussionState === "ready_to_conclude" && currentTurn > 3) {
          break;
        }

        const agent =
          config.agents.find((a) => a.id === decision.nextSpeaker) ||
          config.agents[turn % config.agents.length];

        const pendingUserMessages = userMessagesRef.current;
        if (pendingUserMessages.length > 0) {
          allMessages.push(...pendingUserMessages);
          setMessages([...allMessages]);
          userMessagesRef.current = [];
        }

        const { content, outputTokens, inputTokens } = await callAgent(
          agent,
          decision.instruction,
          allMessages,
        );

        tokensUsed += outputTokens;
        inputTokensUsed += inputTokens;
        const turnCost = estimateCost(agent.model, inputTokens, outputTokens);
        costAccumulated += turnCost;
        setTotalTokens(tokensUsed);
        setTotalInputTokens(inputTokensUsed);
        setEstimatedCostUsd(costAccumulated);

        const message: Message = {
          id: uuidv4(),
          agentId: agent.id,
          agentName: agent.name,
          agentColor: agent.color,
          provider: agent.provider,
          content,
          turnNumber: currentTurn,
          timestamp: Date.now(),
          tokenCount: outputTokens,
          inputTokens,
        };
        allMessages.push(message);
        setMessages([...allMessages]);

        if (turn < config.rules.maxTurns - 1) {
          const nextDecision = await callOrchestrator(allMessages, currentTurn + 1);

          if (config.userMode === "observer") {
            await new Promise((r) => setTimeout(r, 800));
            if (abortRef.current?.signal.aborted) throw new Error("Discussion arretee");
          } else {
            const suggestedAgent = config.agents.find((a) => a.id === nextDecision.nextSpeaker);

            const overrideId = await waitForUserContinue(
              suggestedAgent
                ? {
                    agentId: suggestedAgent.id,
                    agentName: suggestedAgent.name,
                    instruction: nextDecision.instruction,
                  }
                : undefined,
            );
            if (abortRef.current?.signal.aborted) throw new Error("Discussion arretee");

            if (overrideId && overrideId !== nextDecision.nextSpeaker) {
              nextDecision.nextSpeaker = overrideId;
              const overrideAgent = config.agents.find((a) => a.id === overrideId);
              nextDecision.instruction = `Donne ton point de vue sur ce qui vient d'etre dit par rapport au sujet central : ${config.topic}`;
              if (overrideAgent) {
                nextDecision.instruction = `${overrideAgent.name}, reagis aux echanges precedents et donne ton point de vue sur le sujet central : ${config.topic}`;
              }
            }
          }
          pendingDecision = nextDecision;
        }
      }

      let voteResults: VoteResult[] = [];
      let deliverableContent = "";

      if (config.mode === "decision") {
        voteResults = await runVoting(allMessages);
        setVotes(voteResults);
      }

      if (config.mode === "deliverable") {
        deliverableContent = await generateFinalOutput(allMessages, "deliverable");
        const delivMsg: Message = {
          id: uuidv4(),
          agentId: "deliverable",
          agentName: "Livrable",
          agentColor: "#10B981",
          content: deliverableContent,
          turnNumber: currentTurn + 1,
          timestamp: Date.now(),
          isDeliverable: true,
        };
        allMessages.push(delivMsg);
        setMessages([...allMessages]);
      }

      const synthesis = await generateFinalOutput(allMessages, "synthesis");
      const synthMsg: Message = {
        id: uuidv4(),
        agentId: "synthesis",
        agentName: "Synthese",
        agentColor: "#3B82F6",
        content: synthesis,
        turnNumber: currentTurn + 2,
        timestamp: Date.now(),
        isSynthesis: true,
      };
      allMessages.push(synthMsg);
      setMessages([...allMessages]);

      const result = {
        messages: allMessages,
        synthesis,
        keyPoints,
        votes: voteResults,
        deliverable: deliverableContent || undefined,
        metrics: {
          totalTurns: currentTurn,
          tokensPerAgent: computeTokensPerAgent(allMessages),
          totalTokens: tokensUsed,
          totalInputTokens: inputTokensUsed,
          estimatedCost: costAccumulated,
          duration: 0,
        },
      };
      sessionStorage.setItem("ai-arena-result", JSON.stringify(result));

      try {
        saveSession(config, result, userId);
      } catch (error) {
        console.warn("Failed to auto-save session to history:", error);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        /* ok */
      } else setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsRunning(false);
      setCurrentSpeaker(null);
      setStreamingContent("");
    }
  }, [
    config,
    callAgent,
    callOrchestrator,
    runVoting,
    generateFinalOutput,
    keyPoints,
    waitForUserContinue,
    userId,
  ]);

  useEffect(() => {
    if (config && !isRunning && messages.length === 0 && !error) {
      sessionStorage.setItem("ai-arena-start-time", String(Date.now()));
      runDiscussion();
    }
  }, [config, isRunning, messages.length, error, runDiscussion]);

  const handlePause = () => setIsPaused(!isPaused);

  const handleStop = () => {
    if (abortRef.current) abortRef.current.abort();
    setIsRunning(false);
    if (config && messages.length > 0) {
      const startTime = Number(sessionStorage.getItem("ai-arena-start-time") || Date.now());
      const result = {
        messages,
        synthesis:
          messages.find((m) => m.isSynthesis)?.content || "Discussion arretee avant la synthese.",
        keyPoints,
        votes,
        deliverable: messages.find((m) => m.isDeliverable)?.content || undefined,
        metrics: {
          totalTurns: turnNumber,
          tokensPerAgent: computeTokensPerAgent(messages),
          totalTokens,
          totalInputTokens,
          estimatedCost: estimatedCostUsd,
          duration: Date.now() - startTime,
        },
      };
      sessionStorage.setItem("ai-arena-result", JSON.stringify(result));
    }
  };

  const handleUserIntervention = () => {
    if (!userInput.trim() || !config) return;

    let content = userInput.trim();
    if (interventionType === "recadrer") {
      content = `[RECADRAGE] ${content}`;
    } else if (interventionType === "relancer") {
      content = `[RELANCE] ${content}`;
    }

    const userMessage: Message = {
      id: uuidv4(),
      agentId: "user",
      agentName: "Utilisateur",
      agentColor: "#6B7280",
      content,
      turnNumber: turnNumber,
      timestamp: Date.now(),
      isUser: true,
    };
    userMessagesRef.current.push(userMessage);
    setMessages((prev) => [...prev, userMessage]);
    setUserInput("");
  };

  const requestIntermediateSynthesis = async () => {
    if (!config || !isRunning) return;
    const synthContent = await generateFinalOutput(messages, "synthesis");
    const synthMsg: Message = {
      id: uuidv4(),
      agentId: "synthesis-intermediate",
      agentName: "Synthese intermediaire",
      agentColor: "#8B5CF6",
      content: synthContent,
      turnNumber: turnNumber,
      timestamp: Date.now(),
      isSynthesis: true,
    };
    setMessages((prev) => [...prev, synthMsg]);
  };

  const forceVote = async () => {
    if (!config || !isRunning) return;
    handleStop();
    const voteResults = await runVoting(messages);
    setVotes(voteResults);
    const synthesis = await generateFinalOutput(messages, "synthesis");
    const synthMsg: Message = {
      id: uuidv4(),
      agentId: "synthesis",
      agentName: "Synthese",
      agentColor: "#3B82F6",
      content: synthesis,
      turnNumber: turnNumber + 1,
      timestamp: Date.now(),
      isSynthesis: true,
    };
    setMessages((prev) => [...prev, synthMsg]);
  };

  const forceDeliverable = async () => {
    if (!config || !isRunning) return;
    handleStop();
    const deliverable = await generateFinalOutput(messages, "deliverable");
    const delivMsg: Message = {
      id: uuidv4(),
      agentId: "deliverable",
      agentName: "Livrable",
      agentColor: "#10B981",
      content: deliverable,
      turnNumber: turnNumber + 1,
      timestamp: Date.now(),
      isDeliverable: true,
    };
    setMessages((prev) => [...prev, delivMsg]);
  };

  const buildResult = useCallback(() => {
    const startTime = Number(sessionStorage.getItem("ai-arena-start-time") || Date.now());
    return {
      messages,
      synthesis: messages.find((m) => m.isSynthesis)?.content || "",
      keyPoints,
      votes,
      deliverable: messages.find((m) => m.isDeliverable)?.content || undefined,
      metrics: {
        totalTurns: turnNumber,
        tokensPerAgent: computeTokensPerAgent(messages),
        totalTokens,
        totalInputTokens,
        estimatedCost: estimatedCostUsd,
        duration: Date.now() - startTime,
      },
    };
  }, [messages, keyPoints, votes, turnNumber, totalTokens, totalInputTokens, estimatedCostUsd]);

  const goToResults = () => {
    const result = buildResult();
    sessionStorage.setItem("ai-arena-result", JSON.stringify(result));
    navigate("/arena/results");
  };

  const handleCopyAll = async () => {
    if (!config) return;
    const result = buildResult();
    const md = exportToMarkdown(config, result);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMd = () => {
    if (!config) return;
    const result = buildResult();
    const md = exportToMarkdown(config, result);
    const slug = config.topic
      .slice(0, 40)
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-");
    downloadMarkdown(md, `ai-arena-${slug}.md`);
  };

  const handleContinue = useCallback(async () => {
    if (!config || isRunning) return;
    const extendedConfig = {
      ...config,
      rules: { ...config.rules, maxTurns: config.rules.maxTurns + 5 },
    };
    setConfig(extendedConfig);
    sessionStorage.setItem("ai-arena-config", JSON.stringify(extendedConfig));

    setIsRunning(true);
    setError(null);
    abortRef.current = new AbortController();

    const allMessages = [...messages];
    let currentTurn = turnNumber;
    let tokensUsed = totalTokens;
    let inputTokensUsed = totalInputTokens;
    let costAccumulated = estimatedCostUsd;

    try {
      for (let i = 0; i < 5; i++) {
        currentTurn += 1;
        setTurnNumber(currentTurn);

        while (pauseRef.current) {
          await new Promise((r) => setTimeout(r, 500));
        }
        if (abortRef.current?.signal.aborted) throw new Error("Discussion arretee");

        const decision = await callOrchestrator(allMessages, currentTurn);
        setDiscussionState(decision.discussionState);
        if (decision.keyPointsSoFar?.length) setKeyPoints(decision.keyPointsSoFar);

        if (decision.discussionState === "ready_to_conclude") break;

        const agent =
          config.agents.find((a) => a.id === decision.nextSpeaker) ||
          config.agents[i % config.agents.length];

        const pendingUserMessages = userMessagesRef.current;
        if (pendingUserMessages.length > 0) {
          allMessages.push(...pendingUserMessages);
          setMessages([...allMessages]);
          userMessagesRef.current = [];
        }

        const { content, outputTokens, inputTokens } = await callAgent(
          agent,
          decision.instruction,
          allMessages,
        );

        tokensUsed += outputTokens;
        inputTokensUsed += inputTokens;
        const turnCost = estimateCost(agent.model, inputTokens, outputTokens);
        costAccumulated += turnCost;
        setTotalTokens(tokensUsed);
        setTotalInputTokens(inputTokensUsed);
        setEstimatedCostUsd(costAccumulated);

        const message: Message = {
          id: uuidv4(),
          agentId: agent.id,
          agentName: agent.name,
          agentColor: agent.color,
          provider: agent.provider,
          content,
          turnNumber: currentTurn,
          timestamp: Date.now(),
          tokenCount: outputTokens,
          inputTokens,
        };
        allMessages.push(message);
        setMessages([...allMessages]);

        if (i < 4) {
          await waitForUserContinue();
          if (abortRef.current?.signal.aborted) throw new Error("Discussion arretee");
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        /* ok */
      } else setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsRunning(false);
      setCurrentSpeaker(null);
      setStreamingContent("");
    }
  }, [
    config,
    isRunning,
    messages,
    turnNumber,
    totalTokens,
    totalInputTokens,
    estimatedCostUsd,
    callAgent,
    callOrchestrator,
    waitForUserContinue,
  ]);

  const submitFeedback = useCallback(() => {
    if (rating === null || !config) return;
    const entry = {
      date: new Date().toISOString(),
      topic: config.topic,
      mode: config.mode,
      agents: config.agents.map((a) => ({ name: a.name, model: a.model, provider: a.provider })),
      turns: turnNumber,
      cost: estimatedCostUsd,
      rating,
      feedback: feedbackText.trim() || undefined,
    };
    try {
      const existing = JSON.parse(localStorage.getItem("ai-arena-feedback") || "[]");
      existing.push(entry);
      if (existing.length > 50) existing.splice(0, existing.length - 50);
      localStorage.setItem("ai-arena-feedback", JSON.stringify(existing));
    } catch {
      /* intentionally empty – localStorage feedback is best-effort */
    }
    setFeedbackSent(true);
  }, [rating, feedbackText, config, turnNumber, estimatedCostUsd]);

  const currentAgent = config?.agents.find((a) => a.id === currentSpeaker) || null;

  return {
    config,
    messages,
    isRunning,
    isPaused,
    currentSpeaker,
    streamingContent,
    error,
    userInput,
    setUserInput,
    turnNumber,
    totalTokens,
    totalInputTokens,
    estimatedCostUsd,
    keyPoints,
    discussionState,
    votes,
    interventionType,
    setInterventionType,
    copied,
    rating,
    setRating,
    feedbackText,
    setFeedbackText,
    feedbackSent,
    showScrollButton,
    waitingForUser,
    nextSpeakerSuggestion,
    isListening,
    micSupported,
    voiceToInput,
    messagesEndRef,
    scrollContainerRef,
    currentAgent,
    handlePause,
    handleStop,
    handleUserIntervention,
    handleContinueStep,
    requestIntermediateSynthesis,
    forceVote,
    forceDeliverable,
    handleCopyAll,
    handleDownloadMd,
    handleContinue,
    goToResults,
    submitFeedback,
    forceScrollToBottom,
    handleScroll,
  };
}
