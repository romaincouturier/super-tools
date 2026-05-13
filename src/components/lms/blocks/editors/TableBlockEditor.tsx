import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { tableExtensions } from "@/lib/tiptapTableExtensions";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Minus,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Heading as HeadingIcon,
} from "lucide-react";
import type { TableBlockContent } from "@/types/lms-blocks";

interface Props {
  content: TableBlockContent;
  onChange: (content: TableBlockContent) => void;
  slim?: boolean;
}

export default function TableBlockEditor({ content, onChange, slim }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // On garde uniquement les marks/listes utiles dans une cellule.
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      ...tableExtensions("normal"),
    ],
    content: content.html || "",
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none p-3",
      },
    },
    onUpdate: ({ editor }) => {
      onChange({ html: editor.getHTML() });
    },
  });

  // Sync content from prop if it changes externally (peu fréquent — surtout
  // au chargement initial du bloc).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (editor.isFocused) return;
    const current = editor.getHTML();
    if (current !== (content.html || "")) {
      editor.commands.setContent(content.html || "", { emitUpdate: false });
    }
  }, [content.html, editor]);

  if (!editor) return null;

  if (slim) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--st-ink-08)" }}>
        <EditorContent editor={editor} />
      </div>
    );
  }

  const isInTable = editor.isActive("table");

  return (
    <div className="border rounded-md bg-background">
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b bg-muted/30">
        <TbBtn
          title="Ajouter une ligne au-dessus"
          onClick={() => editor.chain().focus().addRowBefore().run()}
          disabled={!isInTable}
          icon={<ArrowUp className="h-3.5 w-3.5" />}
        />
        <TbBtn
          title="Ajouter une ligne en dessous"
          onClick={() => editor.chain().focus().addRowAfter().run()}
          disabled={!isInTable}
          icon={<ArrowDown className="h-3.5 w-3.5" />}
        />
        <TbBtn
          title="Supprimer la ligne"
          onClick={() => editor.chain().focus().deleteRow().run()}
          disabled={!isInTable}
          icon={<Minus className="h-3.5 w-3.5" />}
        />
        <div className="w-px h-5 bg-border mx-0.5" />
        <TbBtn
          title="Ajouter une colonne à gauche"
          onClick={() => editor.chain().focus().addColumnBefore().run()}
          disabled={!isInTable}
          icon={<ArrowLeft className="h-3.5 w-3.5" />}
        />
        <TbBtn
          title="Ajouter une colonne à droite"
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          disabled={!isInTable}
          icon={<ArrowRight className="h-3.5 w-3.5" />}
        />
        <TbBtn
          title="Supprimer la colonne"
          onClick={() => editor.chain().focus().deleteColumn().run()}
          disabled={!isInTable}
          icon={<Plus className="h-3.5 w-3.5 rotate-45" />}
        />
        <div className="w-px h-5 bg-border mx-0.5" />
        <TbBtn
          title="Basculer la cellule en en-tête"
          onClick={() => editor.chain().focus().toggleHeaderCell().run()}
          disabled={!isInTable}
          icon={<HeadingIcon className="h-3.5 w-3.5" />}
        />
        <div className="flex-1" />
        <TbBtn
          title="Supprimer le tableau"
          onClick={() => editor.chain().focus().deleteTable().run()}
          disabled={!isInTable}
          icon={<Trash2 className="h-3.5 w-3.5" />}
          variant="destructive"
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

interface TbBtnProps {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  variant?: "ghost" | "destructive";
}

function TbBtn({ title, onClick, disabled, icon, variant = "ghost" }: TbBtnProps) {
  return (
    <Button
      type="button"
      variant={variant === "destructive" ? "ghost" : "ghost"}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        variant === "destructive"
          ? "h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
          : "h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
      }
    >
      {icon}
    </Button>
  );
}
