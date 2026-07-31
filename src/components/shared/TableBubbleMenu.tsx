import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Rows3,
  Columns3,
  Heading as HeadingIcon,
  Merge,
  Split,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Barre contextuelle façon Notion/Google Docs : elle n'apparaît que lorsque le
 * curseur est dans un tableau, ancrée juste au-dessus de la cellule courante.
 * Le redimensionnement des colonnes se fait au drag sur la bordure (extension
 * Table configurée avec `resizable: true`, poignées stylées dans index.css).
 */
const TableBubbleMenu = ({ editor }: { editor: Editor | null }) => {
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: e }) => e.isEditable && e.isActive("table")}
      options={{ placement: "top", offset: 8 }}
      className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
    >
      <Btn t="Ligne au-dessus" onClick={() => editor.chain().focus().addRowBefore().run()}>
        <ArrowUp className="h-3.5 w-3.5" />
      </Btn>
      <Btn t="Ligne en dessous" onClick={() => editor.chain().focus().addRowAfter().run()}>
        <ArrowDown className="h-3.5 w-3.5" />
      </Btn>
      <Btn t="Supprimer la ligne" onClick={() => editor.chain().focus().deleteRow().run()}>
        <Rows3 className="h-3.5 w-3.5" />
        <MinusDot />
      </Btn>

      <Sep />

      <Btn t="Colonne à gauche" onClick={() => editor.chain().focus().addColumnBefore().run()}>
        <ArrowLeft className="h-3.5 w-3.5" />
      </Btn>
      <Btn t="Colonne à droite" onClick={() => editor.chain().focus().addColumnAfter().run()}>
        <ArrowRight className="h-3.5 w-3.5" />
      </Btn>
      <Btn t="Supprimer la colonne" onClick={() => editor.chain().focus().deleteColumn().run()}>
        <Columns3 className="h-3.5 w-3.5" />
        <MinusDot />
      </Btn>

      <Sep />

      <Btn t="Basculer en en-tête" onClick={() => editor.chain().focus().toggleHeaderCell().run()}>
        <HeadingIcon className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        t="Fusionner les cellules"
        onClick={() => editor.chain().focus().mergeCells().run()}
        disabled={!editor.can().mergeCells()}
      >
        <Merge className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        t="Scinder la cellule"
        onClick={() => editor.chain().focus().splitCell().run()}
        disabled={!editor.can().splitCell()}
      >
        <Split className="h-3.5 w-3.5" />
      </Btn>

      <Sep />

      <Btn t="Supprimer le tableau" destructive onClick={() => editor.chain().focus().deleteTable().run()}>
        <Trash2 className="h-3.5 w-3.5" />
      </Btn>
    </BubbleMenu>
  );
};

const MinusDot = () => (
  <span className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-destructive" />
);

const Sep = () => <div className="mx-0.5 h-5 w-px bg-border" />;

const Btn = ({
  children,
  t,
  onClick,
  disabled,
  destructive,
}: {
  children: React.ReactNode;
  t: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) => (
  <button
    type="button"
    title={t}
    aria-label={t}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={cn(
      "relative flex h-7 w-7 items-center justify-center rounded transition-colors",
      destructive
        ? "text-destructive hover:bg-destructive/10"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
      disabled && "pointer-events-none opacity-30",
    )}
  >
    {children}
  </button>
);

export default TableBubbleMenu;
