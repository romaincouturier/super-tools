import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Mention from "@tiptap/extension-mention";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Undo,
  Redo,
  Heading1,
  Heading2,
  Heading3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { useEffect, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Mention suggestion list ──────────────────────────────────────────

interface MentionItem {
  id: string;
  label: string;
}

interface MentionListProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}

const MentionList = forwardRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          const item = items[selectedIndex];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }));

    if (!items.length) return null;

    return (
      <div className="bg-popover border rounded-md shadow-md py-1 max-h-48 overflow-y-auto z-50">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => command(item)}
            className={cn(
              "w-full text-left px-3 py-1.5 text-sm hover:bg-accent",
              index === selectedIndex && "bg-accent"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  }
);
MentionList.displayName = "MentionList";

let cachedProfiles: MentionItem[] | null = null;

async function fetchMentionProfiles(): Promise<MentionItem[]> {
  if (cachedProfiles) return cachedProfiles;
  const { data } = await supabase
    .from("profiles")
    .select("user_id, email, first_name, last_name, display_name")
    .order("first_name");
  cachedProfiles = (data || []).map((p) => ({
    id: p.user_id,
    label:
      p.first_name && p.last_name
        ? `${p.first_name} ${p.last_name}`
        : p.display_name || p.email,
  }));
  return cachedProfiles;
}

const mentionSuggestion = {
  items: async ({ query }: { query: string }) => {
    const profiles = await fetchMentionProfiles();
    return profiles
      .filter((p) => p.label.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 6);
  },
  render: () => {
    let component: ReactRenderer<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }>;
    let popup: TippyInstance[];

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
      },
      onUpdate: (props: any) => {
        component?.updateProps(props);
        if (props.clientRect) {
          popup?.[0]?.setProps({ getReferenceClientRect: props.clientRect });
        }
      },
      onKeyDown: (props: any) => {
        if (props.event.key === "Escape") {
          popup?.[0]?.hide();
          return true;
        }
        return component?.ref?.onKeyDown(props) ?? false;
      },
      onExit: () => {
        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },
};

// ── RichTextEditor ──────────────────────────────────────────────────

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const RichTextEditor = ({
  content,
  onChange,
  placeholder: _placeholder = "Écrivez ici...",
  className,
  minHeight = "200px",
}: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Underline,
      Mention.configure({
        HTMLAttributes: {
          class: "text-primary font-medium bg-primary/10 rounded px-0.5",
        },
        suggestion: mentionSuggestion,
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          `prose prose-sm dark:prose-invert max-w-none focus:outline-none p-3`,
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL du lien:", previousUrl);

    if (url === null) {
      return;
    }

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={cn("border rounded-md bg-background", className)}>
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30">
        <Toggle
          size="sm"
          pressed={editor.isActive("heading", { level: 1 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          aria-label="Titre H1"
        >
          <Heading1 className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("heading", { level: 2 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Titre H2"
        >
          <Heading2 className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("heading", { level: 3 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          aria-label="Titre H3"
        >
          <Heading3 className="h-4 w-4" />
        </Toggle>

        <div className="w-px h-6 bg-border mx-1" />

        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label="Gras"
        >
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italique"
        >
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("underline")}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Souligné"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("strike")}
          onPressedChange={() => editor.chain().focus().toggleStrike().run()}
          aria-label="Barré"
        >
          <Strikethrough className="h-4 w-4" />
        </Toggle>

        <div className="w-px h-6 bg-border mx-1" />

        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: "left" })}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign("left").run()
          }
          aria-label="Aligner à gauche"
        >
          <AlignLeft className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: "center" })}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign("center").run()
          }
          aria-label="Centrer"
        >
          <AlignCenter className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: "right" })}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign("right").run()
          }
          aria-label="Aligner à droite"
        >
          <AlignRight className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: "justify" })}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign("justify").run()
          }
          aria-label="Justifier"
        >
          <AlignJustify className="h-4 w-4" />
        </Toggle>

        <div className="w-px h-6 bg-border mx-1" />

        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          onPressedChange={() =>
            editor.chain().focus().toggleBulletList().run()
          }
          aria-label="Liste à puces"
        >
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          onPressedChange={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
          aria-label="Liste numérotée"
        >
          <ListOrdered className="h-4 w-4" />
        </Toggle>

        <div className="w-px h-6 bg-border mx-1" />

        <Toggle
          size="sm"
          pressed={editor.isActive("link")}
          onPressedChange={setLink}
          aria-label="Lien"
        >
          <LinkIcon className="h-4 w-4" />
        </Toggle>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 w-8 p-0"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
