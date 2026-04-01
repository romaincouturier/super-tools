import { useRef, useEffect, useState, type KeyboardEvent, useCallback } from "react";
import { Bot, Send, Square, Plus, Loader2, User, History, Trash2, MessageSquare, Copy, Check, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAgentChat, type ChatMessage } from "@/hooks/useAgentChat";
import { useAgentConversations } from "@/hooks/useAgentConversations";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import ModuleLayout from "@/components/ModuleLayout";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const SUGGESTIONS = [
  "Combien de devis ai-je envoyés ce mois-ci ?",
  "Quelles opportunités CRM sont en attente de relance ?",
  "Résume mes formations à venir",
  "Retrouve l'email où on parlait d'une remise",
];

const AgentChat = () => {
  const {
    messages,
    isLoading,
    conversationId,
    toolStatus,
    sendMessage,
    newConversation,
    loadConversation,
    cancelRequest,
    regenerateLastResponse,
  } = useAgentChat();
  const { conversations, deleteConversation } = useAgentConversations();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef(false);

  // Auto-send message from ?q= query parameter
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoSentRef.current && messages.length === 0) {
      autoSentRef.current = true;
      setSearchParams({}, { replace: true });
      newConversation();
      sendMessage(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Invalidate conversation list when we get a new conversation
  useEffect(() => {
    if (conversationId) {
      queryClient.invalidateQueries({ queryKey: ["agent-conversations"] });
    }
  }, [conversationId, queryClient]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (text: string) => {
    sendMessage(text);
  };

  const handleLoadConversation = (id: string) => {
    loadConversation(id);
    setShowHistory(false);
  };

  const handleNewConversation = () => {
    newConversation();
    setShowHistory(false);
  };

  const isEmpty = messages.length === 0;

  return (
    <ModuleLayout hideFooter>
      <div className="flex h-full">
        {/* History sidebar */}
        <div
          className={cn(
            "border-r bg-muted/30 flex flex-col transition-all duration-200 overflow-hidden shrink-0",
            showHistory ? "w-72 max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-20 max-md:shadow-xl" : "w-0",
          )}
        >
          <div className="p-3 border-b flex items-center justify-between min-w-[288px]">
            <span className="text-sm font-medium">Conversations</span>
            <Button variant="ghost" size="sm" onClick={handleNewConversation} className="h-7 px-2 gap-1">
              <Plus className="w-3.5 h-3.5" />
              Nouveau
            </Button>
          </div>
          {conversations.length > 3 && (
            <div className="px-3 py-2 border-b min-w-[288px]">
              <div className="flex items-center gap-2 bg-muted/50 rounded-md px-2.5 py-1.5">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="flex-1 bg-transparent outline-none text-xs placeholder:text-muted-foreground"
                />
              </div>
            </div>
          )}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1 min-w-[288px]">
              {conversations.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Aucune conversation
                </p>
              ) : (
                conversations.filter((c) =>
                  !historySearch || (c.title || "").toLowerCase().includes(historySearch.toLowerCase())
                ).map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      "group flex items-start gap-2 p-2 rounded-md cursor-pointer hover:bg-muted transition-colors",
                      conv.id === conversationId && "bg-muted",
                    )}
                    onClick={() => handleLoadConversation(conv.id)}
                  >
                    <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        {conv.title || "Sans titre"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(conv.updated_at), "d MMM yyyy HH:mm", { locale: fr })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation.mutate(conv.id);
                        if (conv.id === conversationId) newConversation();
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="w-4 h-4" />
              </Button>
              <Bot className="w-5 h-5 text-primary" />
              <h1 className="font-semibold text-sm">Agent SuperTools</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={handleNewConversation} className="gap-1.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nouvelle conversation</span>
            </Button>
          </div>

          {/* Messages area */}
          <ScrollArea className="flex-1">
            <div className="max-w-3xl mx-auto px-4 py-6">
              {isEmpty ? (
                <EmptyState onSuggestion={handleSuggestion} />
              ) : (
                <div className="space-y-6">
                  {messages.map((msg, idx) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isStreaming={isLoading && msg === messages[messages.length - 1] && msg.role === "assistant"}
                      isLastAssistant={!isLoading && msg.role === "assistant" && idx === messages.findLastIndex((m) => m.role === "assistant")}
                      onRegenerate={regenerateLastResponse}
                    />
                  ))}
                  {isLoading && !messages.length && <ThinkingIndicator toolStatus={toolStatus} />}
                  {isLoading && messages.length > 0 && messages[messages.length - 1].role === "assistant" && !messages[messages.length - 1].content && (
                    <ThinkingIndicator toolStatus={toolStatus} />
                  )}
                  {isLoading && toolStatus && messages[messages.length - 1]?.content && (
                    <ToolStatusBadge status={toolStatus} />
                  )}
                  <div ref={scrollEndRef} />
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="border-t bg-background px-4 py-3">
            <div className="max-w-3xl mx-auto flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Posez une question sur vos données..."
                className="resize-none min-h-[44px] max-h-[200px]"
                rows={1}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${target.scrollHeight}px`;
                }}
              />
              {isLoading ? (
                <Button variant="destructive" size="icon" onClick={cancelRequest} className="shrink-0">
                  <Square className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              L'agent peut faire des erreurs. Vérifiez les informations importantes.
            </p>
          </div>
        </div>
      </div>
    </ModuleLayout>
  );
};

// ── Sub-components ───────────────────────────────────────────

function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Bot className="w-8 h-8 text-primary" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Agent SuperTools</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          Interrogez vos données, recherchez dans vos emails et notes,
          obtenez des analyses et recommandations.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            onClick={() => onSuggestion(text)}
            className="text-left text-sm p-3 rounded-lg border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming,
  isLastAssistant,
  onRegenerate,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
  isLastAssistant?: boolean;
  onRegenerate?: () => void;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  if (!isUser && !message.content) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("group flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isUser ? "bg-foreground text-background" : "bg-primary/10 text-primary",
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className="flex flex-col gap-1 max-w-[90%] sm:max-w-[85%]">
        <div
          className={cn(
            "rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-sm",
            isUser ? "bg-foreground text-background" : "bg-muted",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_table]:w-full [&_table]:border-collapse [&_th]:px-2 [&_th]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:text-left [&_td]:px-2 [&_td]:py-1 [&_td]:border [&_td]:border-border [&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_code]:text-xs [&_a]:text-primary [&_a]:underline [&_ul]:pl-4 [&_ol]:pl-4">
              <ReactMarkdown>{message.content}</ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
              )}
            </div>
          )}
        </div>
        {/* Action buttons — visible on hover for assistant messages */}
        {!isUser && !isStreaming && message.content && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Copier"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {isLastAssistant && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Régénérer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator({ toolStatus }: { toolStatus: string | null }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-primary" />
      </div>
      <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        {toolStatus || "Réflexion en cours..."}
      </div>
    </div>
  );
}

function ToolStatusBadge({ status }: { status: string }) {
  return (
    <div className="flex gap-3 ml-11">
      <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs text-primary">
        <Loader2 className="w-3 h-3 animate-spin" />
        {status}
      </div>
    </div>
  );
}

export default AgentChat;
