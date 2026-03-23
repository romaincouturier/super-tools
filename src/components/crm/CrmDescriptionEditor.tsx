import { EditorContent } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import { useTiptapEditor } from "@/hooks/useTiptapEditor";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  Undo,
  Redo,
  ImageIcon,
  Loader2,
  Mic,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { useEffect, useCallback, useState, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { registerMediaEntry } from "@/hooks/useMedia";
import { resolveContentType } from "@/lib/file-utils";

interface CrmDescriptionEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  cardId?: string;
}

const CrmDescriptionEditor = ({
  content,
  onChange,
  placeholder: _placeholder = "Notez ici tous les échanges, informations et détails importants...",
  className,
  cardId,
}: CrmDescriptionEditorProps) => {
  const [imageUploading, setImageUploading] = useState(false);
  const timestampInsertedRef = useRef(false);

  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      if (!cardId) return null;
      try {
        const contentType = resolveContentType(file);
        const ext = contentType.split("/")[1] || "png";
        const fileName = `${cardId}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from("crm-attachments")
          .upload(fileName, file, { contentType });
        if (error) throw error;
        const { data: urlData } = supabase.storage
          .from("crm-attachments")
          .getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;
        await registerMediaEntry({
          file_url: publicUrl,
          file_name: file.name,
          file_type: "image",
          mime_type: contentType,
          file_size: file.size,
          source_type: "crm",
          source_id: cardId,
        });
        return publicUrl;
      } catch (err) {
        console.error("Image upload error:", err);
        return null;
      }
    },
    [cardId]
  );

  const { editor, setLink } = useTiptapEditor({
    content,
    onChange,
    extraExtensions: [
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: "max-w-full rounded",
        },
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[180px] p-3 text-[11px] leading-relaxed [&_ul>li]:list-disc [&_ol>li]:list-decimal marker:text-foreground",
      },
      // Convert emoji <img> tags (from email clients) back to their text characters
      transformPastedHTML(html: string) {
        return html.replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, (match, alt) => {
          // If alt text is short and contains non-ASCII chars, it's likely an emoji
          if (alt && alt.length <= 8 && /[^\x00-\x7F]/.test(alt)) {
            return alt;
          }
          return match;
        });
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items || !cardId) return false;

        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) continue;

            setImageUploading(true);
            uploadImage(file).then((url) => {
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
    onFocus: ({ editor }: { editor: Editor }) => {
      if (timestampInsertedRef.current) return;
      timestampInsertedRef.current = true;
      const now = format(new Date(), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr });
      const stampHtml = `<p>--- ${now} ---</p><p></p>`;
      editor.chain().focus("start").insertContent(stampHtml).run();
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  const insertStamp = useCallback((label: string) => {
    if (!editor) return;
    const now = format(new Date(), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr });
    const stampHtml = `<p>---</p><p>${label} le ${now}</p><p>---</p>`;

    // Insert at the very beginning of the document
    editor
      .chain()
      .focus("start")
      .insertContent(stampHtml)
      .run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={cn("border rounded-md bg-background relative", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => insertStamp("Message vocal laissé")}
          title="Ajouter un horodatage de message vocal"
          className="h-7 px-1.5 text-muted-foreground hover:text-foreground"
        >
          <Mic className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => insertStamp("Relance mail")}
          title="Ajouter un horodatage de relance mail"
          className="h-7 px-1.5 text-muted-foreground hover:text-foreground"
        >
          <Mail className="h-3.5 w-3.5" />
        </Button>

        <div className="w-px h-5 bg-border mx-0.5" />

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

        <div className="w-px h-5 bg-border mx-0.5" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-7 w-7 p-0"
        >
          <Undo className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-7 w-7 p-0"
        >
          <Redo className="h-3.5 w-3.5" />
        </Button>

        <div className="flex-1" />

        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <ImageIcon className="h-3 w-3" />
          Ctrl+V pour coller une image
        </span>
      </div>

      <EditorContent editor={editor} />

      {/* Image upload overlay */}
      {imageUploading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-md z-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Upload de l'image...
          </div>
        </div>
      )}
    </div>
  );
};

export default CrmDescriptionEditor;
