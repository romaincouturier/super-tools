import { useState, useRef, useEffect } from "react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmojiPickerButtonProps {
  emoji: string | null | undefined;
  onEmojiChange: (emoji: string | null) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const EmojiPickerButton = ({
  emoji,
  onEmojiChange,
  size = "md",
  className,
}: EmojiPickerButtonProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

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
    <div ref={containerRef} className={cn("relative inline-block", className)} data-emoji-picker>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center justify-center rounded hover:bg-muted transition-colors",
          sizeClasses[size],
          !emoji && "text-muted-foreground/40 hover:text-muted-foreground/60"
        )}
        title={emoji ? "Changer l'emoji" : "Ajouter un emoji"}
      >
        {emoji || <Smile className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={Theme.AUTO}
            width={320}
            height={400}
            searchPlaceHolder="Rechercher..."
            previewConfig={{ showPreview: false }}
          />
          {emoji && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-1 text-xs text-muted-foreground"
              onClick={handleRemove}
            >
              Supprimer l'emoji
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmojiPickerButton;
