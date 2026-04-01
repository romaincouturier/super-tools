import { useRef, useEffect, useState, type KeyboardEvent } from "react";
import { Bot, Send, Square, Plus, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAgentChat, type ChatMessage } from "@/hooks/useAgentChat";
import ModuleLayout from "@/components/ModuleLayout";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS = [
  "Combien de devis ai-je envoyés ce mois-ci ?",
  "Quelles opportunités CRM sont en attente de relance ?",
  "Résume mes formations à venir",
  "Retrouve l'email où on parlait d'une remise",
];

const AgentChat = () => {
  const { messages, isLoading, sendMessage, newConversation, cancelRequest } =
    useAgentChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Auto-focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
    // Reset textarea height
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

  const isEmpty = messages.length === 0;

  return (
    <ModuleLayout hideFooter>
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <h1 className="font-semibold text-sm">Agent SuperTools</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={newConversation} className="gap-1.5">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouvelle conversation</span>
        </Button>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="max-w-3xl mx-auto px-4 py-6">
          {isEmpty ? (
            <EmptyState onSuggestion={handleSuggestion} />
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && <ThinkingIndicator />}
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isUser ? "bg-foreground text-background" : "bg-primary/10 text-primary",
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div
        className={cn(
          "rounded-xl px-4 py-3 max-w-[85%] text-sm",
          isUser
            ? "bg-foreground text-background"
            : "bg-muted",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_th]:px-2 [&_td]:px-2">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-primary" />
      </div>
      <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Réflexion en cours...
      </div>
    </div>
  );
}

export default AgentChat;
