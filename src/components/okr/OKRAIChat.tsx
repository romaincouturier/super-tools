import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Target, ShieldAlert, BarChart3, ClipboardCheck, FileSearch, X, Maximize2, Minimize2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  mode?: string;
}

const quickPrompts = [
  {
    icon: BarChart3,
    label: "Résumé exécutif",
    mode: "executive_summary",
    description: "Snapshot complet de vos OKRs",
  },
  {
    icon: ShieldAlert,
    label: "Rapport de risques",
    mode: "risk_report",
    description: "KRs en danger avec plan d'action",
  },
  {
    icon: FileSearch,
    label: "Audit qualité",
    mode: "audit",
    description: "Évaluation de la qualité de vos OKRs",
  },
  {
    icon: Target,
    label: "Focus semaine",
    prompt: "Si je ne pouvais me concentrer que sur 3 objectifs cette semaine, lesquels devraient-ils être et pourquoi ?",
    description: "Priorisation hebdomadaire",
  },
];

interface OKRAIChatProps {
  year: number;
  objectiveId?: string;
}

const OKRAIChat = ({ year, objectiveId }: OKRAIChatProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (prompt?: string, mode?: string) => {
    const userMessage = prompt || input.trim();
    if (!userMessage && !mode) return;

    const newUserMessage: ChatMessage = {
      role: "user",
      content: mode
        ? quickPrompts.find((q) => q.mode === mode)?.label || userMessage
        : userMessage,
      mode,
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("okr-ai-assistant", {
        body: {
          prompt: mode ? undefined : userMessage,
          mode,
          objectiveId,
          year,
        },
      });

      if (error) throw error;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, mode: data.mode },
      ]);
    } catch (error: unknown) {
      toast({
        title: "Erreur IA",
        description: error instanceof Error ? error.message : "Impossible de contacter l'assistant",
        variant: "destructive",
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Désolé, une erreur est survenue. Réessayez." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className={isExpanded ? "fixed inset-4 z-50 flex flex-col" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Mode — Parlez à vos OKRs
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMessages([])}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className={`space-y-3 ${isExpanded ? "flex-1 overflow-y-auto" : ""}`}>
        {/* Quick prompts */}
        {messages.length === 0 && (
          <div className="grid grid-cols-2 gap-2">
            {quickPrompts.map((qp) => {
              const Icon = qp.icon;
              return (
                <button
                  key={qp.mode || qp.label}
                  className="flex items-start gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                  onClick={() => sendMessage(qp.prompt, qp.mode)}
                  disabled={isLoading}
                >
                  <Icon className="h-4 w-4 mt-0.5 text-purple-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{qp.label}</p>
                    <p className="text-xs text-muted-foreground">{qp.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <div className={`space-y-3 ${isExpanded ? "" : "max-h-[400px] overflow-y-auto"}`}>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                      dangerouslySetInnerHTML={{
                        __html: formatMarkdown(msg.content),
                      }}
                    />
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Spinner />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez une question sur vos OKRs..."
            rows={1}
            className="min-h-[40px] resize-none"
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <Spinner />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Simple markdown to HTML converter
function formatMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Lists
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    // Code
    .replace(/`(.+?)`/g, "<code>$1</code>")
    // Line breaks
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    // Wrap in paragraph
    .replace(/^(.+)$/, "<p>$1</p>");
}

export default OKRAIChat;
