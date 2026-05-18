import { useState } from "react";
import { EditorContent } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import { useTiptapEditor } from "@/hooks/useTiptapEditor";
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, List, ListOrdered, ImageIcon, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { uploadWatchFile } from "@/hooks/useWatch";
import { useTiptapImagePaste } from "@/hooks/useTiptapImagePaste";
import { transformEmojiImageTags } from "@/lib/tiptapPasteUtils";
import { mentionSuggestion } from "@/lib/tiptapMentionSuggestion";

interface WatchRichEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Rich text editor for the "Texte" tab of the Watch add dialog.
 *
 * Preserves formatting (bold/italic/underline/lists/links) and images
 * when the user pastes content: HTML paste keeps the markup, and pasted
 * image files are uploaded to the `watch` Storage bucket and inserted
 * as `<img src>` nodes.
 *
 * Image tags coming from email clients (alt text = emoji) are converted
 * back to plain emoji characters, matching the CRM editor behaviour.
 */
const WatchRichEditor = ({ content, onChange, className }: WatchRichEditorProps) => {
  const [imageUploading, setImageUploading] = useState(false);
  const handlePaste = useTiptapImagePaste(uploadWatchFile, setImageUploading);

  const { editor, setLink } = useTiptapEditor({
    content,
    onChange,
    extraExtensions: [
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: { class: "max-w-full rounded my-2" },
      }),
      Mention.configure({
        HTMLAttributes: {
          class: "text-primary font-medium bg-primary/10 rounded px-0.5",
        },
        suggestion: mentionSuggestion,
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[160px] p-3 leading-relaxed [&_ul>li]:list-disc [&_ol>li]:list-decimal marker:text-foreground",
      },
      transformPastedHTML: transformEmojiImageTags,
      handlePaste,
    },
  });

  if (!editor) return (
    <div className={cn("border rounded-md bg-background", className)}>
      <div className="h-[38px] border-b bg-muted/30" />
      <div className="min-h-[160px] p-3" />
    </div>
  );

  return (
    <div className={cn("border rounded-md bg-background relative", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label="Gras"
          className="h-7 w-7 p-0"
        >
          <Bold className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italique"
          className="h-7 w-7 p-0"
        >
          <Italic className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("underline")}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Souligné"
          className="h-7 w-7 p-0"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </Toggle>

        <div className="w-px h-5 bg-border mx-0.5" />

        <Toggle
          size="sm"
          pressed={editor.isActive("link")}
          onPressedChange={setLink}
          aria-label="Lien"
          className="h-7 w-7 p-0"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </Toggle>

        <div className="w-px h-5 bg-border mx-0.5" />

        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Liste à puces"
          className="h-7 w-7 p-0"
        >
          <List className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Liste numérotée"
          className="h-7 w-7 p-0"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Toggle>

        <div className="flex-1" />

        <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <span className="flex items-center gap-0.5">
            <AtSign className="h-3 w-3" />
            tapez @ pour taguer
          </span>
          <span className="opacity-40">·</span>
          <span className="flex items-center gap-0.5">
            <ImageIcon className="h-3 w-3" />
            collez texte + images
          </span>
        </span>
      </div>

      <EditorContent editor={editor} />

      {imageUploading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-md z-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Upload de l'image…
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchRichEditor;

/** Strip HTML tags to get a plain-text representation (for length checks, AI processing, etc.). */
export function stripWatchHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}
