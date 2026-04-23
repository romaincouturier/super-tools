import { useRef, useEffect, useState, type KeyboardEvent, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Send, Square, Plus, Loader2, User, History, Trash2, MessageSquare, Copy, Check, RefreshCw, Search, PanelRight, ThumbsUp, ThumbsDown, Paperclip, X, FileText, ImageIcon, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAgentChat, type ChatMessage, type ChatAttachment } from "@/hooks/useAgentChat";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { supabase } from "@/integrations/supabase/client";
import { resolveContentType } from "@/lib/file-utils";
import { useAgentFeedback } from "@/hooks/useAgentFeedback";
import { useAgentConversations } from "@/hooks/useAgentConversations";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import ModuleLayout from "@/components/ModuleLayout";
import DailyTodoPanel from "@/components/dashboard/DailyTodoPanel";
import UpcomingCalendarPanel from "@/components/dashboard/UpcomingCalendarPanel";
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
  const navigate = useNavigate();
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
  const { submitFeedback } = useAgentFeedback();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [showRightPanel, setShowRightPanel] = useState(true);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const mimeType = resolveContentType(file);
        const isImage = mimeType.startsWith("image/");
        const ext = file.name.split(".").pop() || "bin";
        const path = `agent/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("media").upload(path, file, { contentType: mimeType });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
        setAttachments((prev) => [...prev, {
          url: urlData.publicUrl,
          name: file.name,
          type: isImage ? "image" : "document",
          mimeType,
        }]);
      }
    } catch {
      // silently ignore upload errors
    }
    setUploading(false);
    if (e.target) e.target.value = "";
  }, []);

  const handleSend = () => {
    if ((!input.trim() && !attachments.length) || isLoading) return;
    sendMessage(input || "Analyse ces fichiers", attachments.length ? attachments : undefined);
    setInput("");
    setAttachments([]);
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

  const handleFeedback = useCallback(async (messageIdx: number, rating: "up" | "down") => {
    let userPrompt = "";
    for (let i = messageIdx - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userPrompt = messages[i].content;
        break;
      }
    }
    await submitFeedback({
      conversationId,
      rating,
      userPrompt,
      assistantResponse: messages[messageIdx].content,
    });
  }, [messages, conversationId, submitFeedback]);

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
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/arena")}
                className="gap-1.5"
                title="Lancer une conversation avec plusieurs agents en parallèle"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden md:inline">Multi-agents</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleNewConversation} className="gap-1.5">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nouvelle conversation</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hidden lg:flex"
                onClick={() => setShowRightPanel(!showRightPanel)}
              >
                <PanelRight className="w-4 h-4" />
              </Button>
            </div>
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
                      isLastAssistant={!isLoading && msg.role === "assistant" && idx === (() => { for (let i = messages.length - 1; i >= 0; i--) { if (messages[i].role === "assistant") return i; } return -1; })()}
                      onRegenerate={regenerateLastResponse}
                      onFeedback={(rating) => handleFeedback(idx, rating)}
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
            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="max-w-3xl mx-auto flex flex-wrap gap-2 mb-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs">
                    {att.type === "image" ? <ImageIcon className="h-3 w-3 text-purple-600" /> : <FileText className="h-3 w-3 text-blue-600" />}
                    <span className="truncate max-w-[120px]">{att.name}</span>
                    <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="max-w-3xl mx-auto flex gap-2 items-end">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-[44px]"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || uploading}
              >
                {uploading ? <Spinner /> : <Paperclip className="w-4 h-4" />}
              </Button>
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
                  disabled={!input.trim() && !attachments.length}
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

        {/* Right panel: Todo + Calendar */}
        {showRightPanel && (
          <aside className="hidden lg:flex flex-col w-80 shrink-0 border-l bg-muted/20 p-4 gap-4 overflow-y-auto">
            <Card className="p-4 min-h-0 flex flex-col overflow-hidden">
              <UpcomingCalendarPanel />
            </Card>
            <Card className="p-4 min-h-0 flex flex-col overflow-hidden">
              <DailyTodoPanel />
            </Card>
          </aside>
        )}
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
  onFeedback,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
  isLastAssistant?: boolean;
  onRegenerate?: () => void;
  onFeedback?: (rating: "up" | "down") => void;
}) {
  const isUser = message.role === "user";
  const { copied, copy } = useCopyToClipboard();
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(null);

  if (!isUser && !message.content) return null;

  const handleCopy = () => {
    copy(message.content, { silent: true });
  };

  const handleFeedback = (rating: "up" | "down") => {
    if (feedbackGiven) return;
    setFeedbackGiven(rating);
    onFeedback?.(rating);
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
            <div>
              {message.attachments && message.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {message.attachments.map((att, i) => (
                    att.type === "image" ? (
                      <img key={i} src={att.url} alt={att.name} className="max-h-32 rounded-md" />
                    ) : (
                      <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs underline opacity-80">
                        <FileText className="h-3 w-3" />
                        {att.name}
                      </a>
                    )
                  ))}
                </div>
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_table]:w-full [&_table]:border-collapse [&_th]:px-2 [&_th]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:text-left [&_td]:px-2 [&_td]:py-1 [&_td]:border [&_td]:border-border [&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_code]:text-xs [&_a]:text-primary [&_a]:underline [&_ul]:pl-4 [&_ol]:pl-4">
              <ReactMarkdown>{message.content}</ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
              )}
            </div>
          )}
        </div>
        {/* Action buttons — visible on hover */}
        {!isStreaming && message.content && (
          <div className={cn(
            "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
            isUser && "flex-row-reverse",
          )}>
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Copier"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {!isUser && (
              <>
                <button
                  onClick={() => handleFeedback("up")}
                  disabled={!!feedbackGiven}
                  className={cn(
                    "p-1 rounded transition-colors",
                    feedbackGiven === "up"
                      ? "text-green-600"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    feedbackGiven && feedbackGiven !== "up" && "opacity-30",
                  )}
                  title="Bonne réponse"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleFeedback("down")}
                  disabled={!!feedbackGiven}
                  className={cn(
                    "p-1 rounded transition-colors",
                    feedbackGiven === "down"
                      ? "text-red-600"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    feedbackGiven && feedbackGiven !== "down" && "opacity-30",
                  )}
                  title="Mauvaise réponse"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
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
              </>
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
        <Spinner />
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
