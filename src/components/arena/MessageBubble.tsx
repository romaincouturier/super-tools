import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/lib/arena/types";

interface MessageBubbleProps {
  message: Message;
}

const providerBadge: Record<string, string> = {
  openai: "OAI",
  gemini: "Gem",
};

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-blockquote:my-2 prose-pre:my-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  if (message.isSynthesis) {
    return (
      <div className="arena-fade-in-up mx-4 my-4 rounded-xl border border-blue-500/30 bg-blue-500/5 p-5">
        <div className="mb-2 flex items-center gap-2">
          <svg className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="font-semibold text-blue-500">{message.agentName || "Synthese finale"}</span>
        </div>
        <MarkdownContent content={message.content} />
      </div>
    );
  }

  if (message.isDeliverable) {
    return (
      <div className="arena-fade-in-up mx-4 my-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <div className="mb-2 flex items-center gap-2">
          <svg className="h-5 w-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-semibold text-emerald-500">Livrable final</span>
        </div>
        <MarkdownContent content={message.content} />
      </div>
    );
  }

  if (message.isVote) {
    return (
      <div className="arena-fade-in-up mx-4 my-3">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: message.agentColor }}
          >
            {message.agentName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: message.agentColor }}>
                {message.agentName}
              </span>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                VOTE
              </span>
            </div>
            <div
              className="rounded-xl rounded-tl-sm border-2 px-4 py-3"
              style={{ borderColor: message.agentColor + "60" }}
            >
              <MarkdownContent content={message.content} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (message.isUser) {
    return (
      <div className="arena-fade-in-up mx-4 my-3 flex justify-end">
        <div className="max-w-[75%] rounded-xl rounded-br-sm bg-primary/20 px-4 py-3">
          <div className="mb-1 text-xs font-medium text-primary">Vous (intervention)</div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
        </div>
      </div>
    );
  }

  const badge = message.provider ? providerBadge[message.provider] : undefined;

  return (
    <div className="arena-fade-in-up mx-4 my-3">
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: message.agentColor }}
        >
          {message.agentName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: message.agentColor }}>
              {message.agentName}
            </span>
            {badge && (
              <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground">{badge}</span>
            )}
            <span className="text-xs text-muted-foreground">Tour {message.turnNumber}</span>
            {message.tokenCount ? (
              <span className="text-xs text-muted-foreground">{message.tokenCount} tok</span>
            ) : null}
          </div>
          <div
            className="rounded-xl rounded-tl-sm border px-4 py-3"
            style={{ borderColor: message.agentColor + "40" }}
          >
            <MarkdownContent content={message.content} />
          </div>
        </div>
      </div>
    </div>
  );
}
