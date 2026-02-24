import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  Link as LinkIcon,
  TextQuote,
  User,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { useEmailSnippets, EmailSnippet } from "@/hooks/useEmailSnippets";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

interface SlashMenuItem {
  label: string;
  description: string;
  icon: React.ReactNode;
  value: string;
}

interface EmailEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  variables?: Record<string, string | undefined | null>;
}

const EmailEditor = ({
  content,
  onChange,
  placeholder = "Corps du message...",
  className,
  variables,
}: EmailEditorProps) => {
  const [snippetPopoverOpen, setSnippetPopoverOpen] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [slashQuery, setSlashQuery] = useState("");
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const slashStartRef = useRef<number | null>(null);
  const { data: snippets } = useEmailSnippets();

  // Build slash menu items from variables
  const slashItems = useMemo<SlashMenuItem[]>(() => {
    const items: SlashMenuItem[] = [];
    const fullName = [variables?.first_name, variables?.last_name].filter(Boolean).join(" ");
    if (fullName) {
      items.push({ label: "Nom du client", description: fullName, icon: <User className="h-3.5 w-3.5" />, value: fullName });
    }
    if (variables?.first_name) {
      items.push({ label: "Prénom", description: variables.first_name, icon: <User className="h-3.5 w-3.5" />, value: variables.first_name });
    }
    if (variables?.last_name) {
      items.push({ label: "Nom de famille", description: variables.last_name, icon: <User className="h-3.5 w-3.5" />, value: variables.last_name });
    }
    if (variables?.company) {
      items.push({ label: "Entreprise", description: variables.company, icon: <Building2 className="h-3.5 w-3.5" />, value: variables.company });
    }
    return items;
  }, [variables]);

  const filteredSlashItems = useMemo(() => {
    if (!slashQuery) return slashItems;
    const q = slashQuery.toLowerCase();
    return slashItems.filter(
      (item) => item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    );
  }, [slashItems, slashQuery]);

  // Slash command extension
  const SlashCommand = useMemo(() => Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey("slashCommand"),
          props: {
            handleKeyDown(view, event) {
              if (event.key === "/" && !slashMenuOpen) {
                const { from } = view.state.selection;
                const coords = view.coordsAtPos(from);
                const editorRect = view.dom.getBoundingClientRect();
                setSlashMenuPos({
                  top: coords.bottom - editorRect.top + 4,
                  left: Math.min(coords.left - editorRect.left, editorRect.width - 230),
                });
                slashStartRef.current = from;
                setSlashQuery("");
                setSelectedSlashIndex(0);
                setSlashMenuOpen(true);
              }
              return false;
            },
          },
        }),
      ];
    },
  }), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
      SlashCommand,
    ],
    content,
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[200px] p-3 text-sm leading-relaxed",
      },
      handleKeyDown: (_view, event) => {
        if (!slashMenuOpen) return false;

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedSlashIndex((i) => Math.min(i + 1, filteredSlashItems.length - 1));
          return true;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedSlashIndex((i) => Math.max(i - 1, 0));
          return true;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          const item = filteredSlashItems[selectedSlashIndex];
          if (item) selectSlashItem(item);
          return true;
        }
        if (event.key === "Escape" || event.key === " ") {
          setSlashMenuOpen(false);
          return event.key === "Escape";
        }
        if (event.key === "Backspace") {
          if (slashQuery.length > 0) {
            setSlashQuery((q) => q.slice(0, -1));
          } else {
            setSlashMenuOpen(false);
          }
          return false;
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          setSlashQuery((q) => q + event.key);
          setSelectedSlashIndex(0);
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  const selectSlashItem = useCallback((item: SlashMenuItem) => {
    if (!editor) return;
    // Delete from "/" to current cursor position
    const { from } = editor.state.selection;
    const start = slashStartRef.current ?? from - 1 - slashQuery.length;
    editor.chain().focus().deleteRange({ from: start, to: from }).insertContent(item.value).run();
    setSlashMenuOpen(false);
  }, [editor, slashQuery]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL du lien:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const insertSnippet = (snippet: EmailSnippet) => {
    if (!editor) return;
    const htmlContent = snippet.content
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => `<p>${line || "<br>"}</p>`)
      .join("");
    editor.chain().focus().insertContent(htmlContent).run();
    setSnippetPopoverOpen(false);
  };

  const snippetsByCategory = snippets?.reduce((acc, snippet) => {
    const category = snippet.category || "Général";
    if (!acc[category]) acc[category] = [];
    acc[category].push(snippet);
    return acc;
  }, {} as Record<string, EmailSnippet[]>) || {};

  if (!editor) return null;

  return (
    <div className={cn("border rounded-md bg-background relative", className)}>
      <div className="flex items-center gap-1 p-1.5 border-b bg-muted/30">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={setLink}
          title="Insérer un lien"
        >
          <LinkIcon className="h-3.5 w-3.5" />
          Lien
        </Button>

        <div className="w-px h-5 bg-border mx-0.5" />

        <Popover open={snippetPopoverOpen} onOpenChange={setSnippetPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" title="Insérer un bloc de texte">
              <TextQuote className="h-3.5 w-3.5" />
              Insérer
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-2 border-b">
              <p className="text-sm font-medium">Blocs de texte</p>
              <p className="text-xs text-muted-foreground">Cliquez pour insérer dans l'email</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {Object.entries(snippetsByCategory).map(([category, categorySnippets]) => (
                <div key={category}>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">{category}</div>
                  {categorySnippets.map((snippet) => (
                    <button
                      key={snippet.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-b-0"
                      onClick={() => insertSnippet(snippet)}
                    >
                      <div className="font-medium">{snippet.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{snippet.content.substring(0, 100)}...</div>
                    </button>
                  ))}
                </div>
              ))}
              {(!snippets || snippets.length === 0) && (
                <div className="p-4 text-center text-sm text-muted-foreground">Aucun bloc de texte configuré</div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground mr-1">Tapez / pour insérer</span>
      </div>

      <div className="relative">
        <EditorContent editor={editor} />

        {slashMenuOpen && filteredSlashItems.length > 0 && slashMenuPos && (
          <div
            className="absolute z-50 bg-popover border rounded-lg shadow-md py-1 w-56"
            style={{ top: slashMenuPos.top, left: slashMenuPos.left }}
          >
            {filteredSlashItems.map((item, index) => (
              <button
                key={item.label}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-accent transition-colors",
                  index === selectedSlashIndex && "bg-accent"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSlashItem(item);
                }}
                onMouseEnter={() => setSelectedSlashIndex(index)}
              >
                <span className="text-muted-foreground">{item.icon}</span>
                <div>
                  <div className="font-medium text-xs">{item.label}</div>
                  <div className="text-[10px] text-muted-foreground">{item.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailEditor;
