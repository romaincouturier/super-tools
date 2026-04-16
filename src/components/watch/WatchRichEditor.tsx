import { useCallback, useState } from "react";
import { EditorContent } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import { useTiptapEditor } from "@/hooks/useTiptapEditor";
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, List, ListOrdered, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { uploadWatchFile } from "@/hooks/useWatch";

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

  const uploadPastedImage = useCallback(async (file: File): Promise<string | null> => {
    try {
      return await uploadWatchFile(file);
    } catch (err) {
      console.error("Image paste upload error:", err);
      return null;
    }
  }, []);

  const { editor, setLink } = useTiptapEditor({
    content,
    onChange,
    extraExtensions: [
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: { class: "max-w-full rounded my-2" },
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[160px] p-3 leading-relaxed [&_ul>li]:list-disc [&_ol>li]:list-decimal marker:text-foreground",
      },
      // Convert <img alt="🎉"> wrappers (Gmail style) back to their emoji text.
      transformPastedHTML(html: string) {
        return html.replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, (match, alt) => {
          if (alt && alt.length <= 8 && /[^\x00-\x7F]/.test(alt)) return alt;
          return match;
        });
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of Array.from(items) as DataTransferItem[]) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) continue;

            setImageUploading(true);
            uploadPastedImage(file).then((url) => {
              setImageUploading(false);
              if (url) {
                const node = view.state.schema.nodes.image.create({ src: url });
                const tr = view.state.tr.replaceSelectionWith(node);
                view.dispatch(tr);
              }
            });
            return true;
          }
        }
        return false;
      },
    },
  });

  if (!editor) return null;

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

        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <ImageIcon className="h-3 w-3" />
          Collez du contenu riche (texte + images)
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
