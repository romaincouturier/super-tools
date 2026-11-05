import { cn } from "@/lib/utils";
import type { SocialChannel } from "@/services/socialContents";

interface ChannelFilterBarProps {
  channels: SocialChannel[];
  hiddenChannelIds: ReadonlySet<string>;
  onToggle: (channelId: string) => void;
}

export default function ChannelFilterBar({ channels, hiddenChannelIds, onToggle }: ChannelFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Canaux affichés">
      <span className="text-xs text-muted-foreground mr-1">Réseau</span>
      {channels.map((c) => {
        const visible = !hiddenChannelIds.has(c.id);
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={visible}
            onClick={() => onToggle(c.id)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
              visible ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground line-through",
            )}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
