import { useState, type ReactNode } from "react";
import EmojiPicker, { EmojiClickData, EmojiStyle, Theme } from "emoji-picker-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Smile, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmojiPickerButtonProps {
  emoji: string | null | undefined;
  onEmojiChange: (emoji: string | null) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Custom node shown when no emoji is set. Defaults to a Smile icon. */
  fallback?: ReactNode;
}

const EmojiPickerButton = ({
  emoji,
  onEmojiChange,
  size = "md",
  className,
  fallback,
}: EmojiPickerButtonProps) => {
  const [open, setOpen] = useState(false);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiChange(emojiData.emoji);
    setOpen(false);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEmojiChange(null);
    setOpen(false);
  };

  const sizeClasses = {
    sm: "h-6 w-6 text-sm",
    md: "h-8 w-8 text-lg",
    lg: "h-10 w-10 text-2xl",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "flex items-center justify-center rounded hover:bg-muted transition-colors",
            sizeClasses[size],
            !emoji && "text-muted-foreground/40 hover:text-muted-foreground/60",
            className,
          )}
          title={emoji ? "Changer l'emoji" : "Ajouter un emoji"}
        >
          {emoji || fallback || <Smile className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-0 shadow-xl rounded-xl overflow-clip"
        side="bottom"
        align="start"
        sideOffset={4}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          theme={Theme.AUTO}
          emojiStyle={EmojiStyle.NATIVE}
          width={320}
          height={380}
          searchPlaceHolder="Rechercher un emoji..."
          previewConfig={{ showPreview: false }}
          skinTonesDisabled
          lazyLoadEmojis
          
          style={{ "--epr-emoji-size": "18px", "--epr-emoji-padding": "4px" } as React.CSSProperties}
        />
        {emoji && (
          <div className="border-t bg-background px-2 py-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-destructive gap-1.5"
              onClick={handleRemove}
            >
              <X className="h-3 w-3" />
              Supprimer l'emoji
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPickerButton;
