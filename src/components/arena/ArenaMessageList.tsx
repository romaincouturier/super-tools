import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message, AgentConfig } from "@/lib/arena/types";
import MessageBubble from "@/components/arena/MessageBubble";
import TypingIndicator from "@/components/arena/TypingIndicator";

interface ArenaMessageListProps {
  messages: Message[];
  currentSpeaker: string | null;
  currentAgent: AgentConfig | undefined;
  streamingContent: string;
  turnNumber: number;
  error: string | null;
}

export default function ArenaMessageList({
  messages,
  currentSpeaker,
  currentAgent,
  streamingContent,
  turnNumber,
  error,
}: ArenaMessageListProps) {
  return (
    <>
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {/* Streaming content from agent */}
      {currentSpeaker && !["synthesis", "deliverable"].includes(currentSpeaker || "") && currentAgent && streamingContent && (
        <StreamingAgentMessage
          agent={currentAgent}
          streamingContent={streamingContent}
          turnNumber={turnNumber}
        />
      )}

      {/* Synthesis/Deliverable streaming */}
      {(currentSpeaker === "synthesis" || currentSpeaker === "deliverable") && streamingContent && (
        <StreamingSynthesis
          type={currentSpeaker}
          streamingContent={streamingContent}
        />
      )}

      {currentSpeaker && !streamingContent && currentAgent && (
        <TypingIndicator agentName={currentAgent.name} agentColor={currentAgent.color} />
      )}

      {error && (
        <div className="mx-4 my-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      )}
    </>
  );
}

function StreamingAgentMessage({
  agent,
  streamingContent,
  turnNumber,
}: {
  agent: AgentConfig;
  streamingContent: string;
  turnNumber: number;
}) {
  return (
    <div className="arena-fade-in-up mx-4 my-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: agent.color }}>
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: agent.color }}>{agent.name}</span>
            <span className="text-xs text-muted-foreground">Tour {turnNumber}</span>
          </div>
          <div className="rounded-xl rounded-tl-sm border px-4 py-3" style={{ borderColor: agent.color + "40" }}>
            <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StreamingSynthesis({
  type,
  streamingContent,
}: {
  type: "synthesis" | "deliverable";
  streamingContent: string;
}) {
  const isDeliverable = type === "deliverable";
  return (
    <div className={`arena-fade-in-up mx-4 my-4 rounded-xl border p-5 ${isDeliverable ? "border-emerald-500/30 bg-emerald-500/5" : "border-primary/30 bg-primary/5"}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className={`font-semibold ${isDeliverable ? "text-emerald-500" : "text-primary"}`}>
          {isDeliverable ? "Generation du livrable..." : "Synthese en cours..."}
        </span>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
      </div>
    </div>
  );
}
