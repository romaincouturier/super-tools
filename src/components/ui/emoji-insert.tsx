import { useState } from "react";
import EmojiPicker, { EmojiClickData, EmojiStyle, Theme } from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onInsert: (emoji: string) => void;
  size?: number;
  className?: string;
  title?: string;
}

/** Small popover button that inserts a chosen emoji into a text field. */
export default function EmojiInsert({ onInsert, size = 16, className, title = "Insérer un emoji" }: Props) {
  const [open, setOpen] = useState(false);

  const handleClick = (data: EmojiClickData) => {
    onInsert(data.emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex items-center justify-center rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors shrink-0",
            className,
          )}
          title={title}
          aria-label={title}
        >
          <Smile size={size} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-0 shadow-xl rounded-xl overflow-clip"
        side="top"
        align="end"
        sideOffset={4}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <EmojiPicker
          onEmojiClick={handleClick}
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
      </PopoverContent>
    </Popover>
  );
}
