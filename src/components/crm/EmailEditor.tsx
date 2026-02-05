import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  TextQuote,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useEffect, useCallback, useState } from "react";
import { useEmailSnippets, EmailSnippet } from "@/hooks/useEmailSnippets";

interface EmailEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

const EmailEditor = ({
  content,
  onChange,
  placeholder = "Corps du message...",
  className,
}: EmailEditorProps) => {
  const [snippetPopoverOpen, setSnippetPopoverOpen] = useState(false);
  const { data: snippets } = useEmailSnippets();

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
      Underline,
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] p-2 text-sm",
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

  const insertSnippet = (snippet: EmailSnippet) => {
    if (!editor) return;
    editor.chain().focus().insertContent(snippet.content).run();
    setSnippetPopoverOpen(false);
  };

  // Group snippets by category
  const snippetsByCategory = snippets?.reduce((acc, snippet) => {
    const category = snippet.category || "Général";
    if (!acc[category]) acc[category] = [];
    acc[category].push(snippet);
    return acc;
  }, {} as Record<string, EmailSnippet[]>) || {};

  if (!editor) {
    return null;
  }

  return (
    <div className={cn("border rounded-md bg-background", className)}>
      <div className="flex flex-wrap items-center gap-1 p-1.5 border-b bg-muted/30">
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
          pressed={editor.isActive("bulletList")}
          onPressedChange={() =>
            editor.chain().focus().toggleBulletList().run()
          }
          aria-label="Liste à puces"
          className="h-7 w-7 p-0"
        >
          <List className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          onPressedChange={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
          aria-label="Liste numérotée"
          className="h-7 w-7 p-0"
        >
          <ListOrdered className="h-3.5 w-3.5" />
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

        {/* Snippet selector */}
        <Popover open={snippetPopoverOpen} onOpenChange={setSnippetPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              title="Insérer un bloc de texte"
            >
              <TextQuote className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Insérer</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-2 border-b">
              <p className="text-sm font-medium">Blocs de texte</p>
              <p className="text-xs text-muted-foreground">
                Cliquez pour insérer dans l'email
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {Object.entries(snippetsByCategory).map(([category, categorySnippets]) => (
                <div key={category}>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                    {category}
                  </div>
                  {categorySnippets.map((snippet) => (
                    <button
                      key={snippet.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-b-0"
                      onClick={() => insertSnippet(snippet)}
                    >
                      <div className="font-medium">{snippet.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {snippet.content.substring(0, 100)}...
                      </div>
                    </button>
                  ))}
                </div>
              ))}
              {(!snippets || snippets.length === 0) && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Aucun bloc de texte configuré
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
};

export default EmailEditor;
