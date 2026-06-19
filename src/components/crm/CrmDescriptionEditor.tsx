import { EditorContent } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import { tableExtensions } from "@/lib/tiptapTableExtensions";
import { useTiptapEditor } from "@/hooks/useTiptapEditor";
import { useTiptapImagePaste } from "@/hooks/useTiptapImagePaste";
import { transformEmojiImageTags } from "@/lib/tiptapPasteUtils";
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, List, ListOrdered, Undo, Redo, ImageIcon, Mic, Mail, Table as TableIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { useEffect, useCallback, useState, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

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
        const formData = new FormData();
        formData.append("cardId", cardId);
        formData.append("file", file);
        const { data, error } = await supabase.functions.invoke("upload-crm-image", { body: formData });
        if (error) throw error;
        return data?.publicUrl ?? null;
      } catch (err) {
        console.error("Image upload error:", err);
        return null;
      }
    },
    [cardId]
  );

  const handlePaste = useTiptapImagePaste(cardId ? uploadImage : undefined, setImageUploading);

  const { editor, setLink, linkDialog } = useTiptapEditor({
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
      ...tableExtensions("compact"),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[180px] p-3 text-[11px] leading-relaxed [&_ul>li]:list-disc [&_ol>li]:list-decimal marker:text-foreground",
      },
      transformPastedHTML: transformEmojiImageTags,
      handlePaste,
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
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="Insérer un tableau (3×3, en-tête)"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
        >
          <TableIcon className="h-3.5 w-3.5" />
        </Button>

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
            <Spinner />
            Upload de l'image...
          </div>
        </div>
      )}
    </div>
  );
};

export default CrmDescriptionEditor;
