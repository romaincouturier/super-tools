import { useState, useCallback, useEffect, useRef } from "react";
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";
import { formatFileSize } from "@/lib/file-utils";
import { useEditor, EditorContent, Node, mergeAttributes } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import ImageExtension from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import TextAlign from "@tiptap/extension-text-align";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  FileText,
  Trash2,
  MoreHorizontal,
  Loader2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Link as LinkIcon,
  List,
  ListOrdered,
  CheckSquare,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Quote,
  Code,
  Minus,
  ImageIcon,
  Paperclip,
  Video,
  AlignLeft,
  AlignCenter,
  AlignRight,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDownSquare,
  Undo,
  Redo,
  LayoutTemplate,
  ArrowDownUp,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  useMissionPages,
  useCreateMissionPage,
  useUpdateMissionPage,
  useDeleteMissionPage,
  useMissionPageTemplates,
  MissionPage,
  MissionPageTemplate,
} from "@/hooks/useMissions";
import { Mission } from "@/types/missions";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { registerMediaEntry } from "@/hooks/useMedia";
import { resolveContentType } from "@/lib/file-utils";

interface MissionPagesProps {
  mission: Mission;
  initialActivityPageRequest?: { activityId: string; description: string } | null;
  onActivityPageCreated?: () => void;
}

type PageSortMode = "date_desc" | "date_asc" | "name_asc" | "name_desc";

interface PageTreeItemProps {
  page: MissionPage;
  allPages: MissionPage[];
  level: number;
  onSelect: (page: MissionPage) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (page: MissionPage) => void;
  onToggleExpand: (page: MissionPage) => void;
  selectedPageId: string | null;
  sortFn: (a: MissionPage, b: MissionPage) => number;
}

// ─── Custom TipTap Extensions ────────────────────────────

const DetailsNode = Node.create({
  name: "details",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: "details" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["details", mergeAttributes(HTMLAttributes, { open: "", class: "my-2 border rounded-lg p-3" }), 0];
  },
});

const SummaryNode = Node.create({
  name: "summary",
  group: "block",
  content: "inline*",
  defining: true,
  parseHTML() {
    return [{ tag: "summary" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["summary", mergeAttributes(HTMLAttributes, { class: "cursor-pointer font-semibold text-lg select-none" }), 0];
  },
});

const VideoNode = Node.create({
  name: "video",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
    };
  },
  parseHTML() {
    return [{ tag: "video[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["video", mergeAttributes(HTMLAttributes, { controls: "", class: "w-full rounded-lg my-4 max-h-[500px]" })];
  },
});

// ─── Page Tree Item ──────────────────────────────────────

const PageTreeItem = ({
  page,
  allPages,
  level,
  onSelect,
  onAddChild,
  onDelete,
  onToggleExpand,
  selectedPageId,
  sortFn,
}: PageTreeItemProps) => {
  const childPages = allPages
    .filter((p) => p.parent_page_id === page.id)
    .sort(sortFn);
  const hasChildren = childPages.length > 0;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 py-1.5 px-1.5 rounded-md cursor-pointer transition-colors",
          selectedPageId === page.id
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
        )}
        style={{ paddingLeft: `${level * 12 + 4}px` }}
        onClick={() => onSelect(page)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand(page);
          }}
          className="w-4 h-4 flex items-center justify-center shrink-0"
        >
          {hasChildren ? (
            page.is_expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : (
            <span className="w-3" />
          )}
        </button>

        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-sm overflow-x-auto whitespace-nowrap scrollbar-hide">
          {page.title || "Sans titre"}
        </span>

        <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0">
          <button
            className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(page.id);
            }}
          >
            <Plus className="h-3 w-3" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => onDelete(page)}
                className="text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasChildren && page.is_expanded && (
        <div>
          {childPages.map((child) => (
            <PageTreeItem
              key={child.id}
              page={child}
              allPages={allPages}
              level={level + 1}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onToggleExpand={onToggleExpand}
              selectedPageId={selectedPageId}
              sortFn={sortFn}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────

/**
 * Ensures plain text content is converted to HTML paragraphs.
 * If content already contains block-level HTML tags, returns it as-is.
 */
function ensureHtmlContent(content: string): string {
  if (!content) return content;
  if (/<(p|h[1-6]|ul|ol|li|div|blockquote|table|pre|hr)\b/i.test(content)) {
    return content;
  }
  return content
    .split(/\n\n+/)
    .filter((block) => block.trim())
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// ─── Page Editor ─────────────────────────────────────────

const PageEditor = ({
  page,
  missionId,
  onPageUpdated,
}: {
  page: MissionPage;
  missionId: string;
  onPageUpdated: (page: MissionPage) => void;
}) => {
  const { toast } = useToast();
  const updatePage = useUpdateMissionPage();
  const [imageUploading, setImageUploading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [editorValues, setEditorValues] = useState({ content: page.content || "", title: page.title || "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useAutoSaveForm({
    open: true,
    formValues: editorValues,
    debounceMs: 800,
    onSave: async (values) => {
      try {
        await updatePage.mutateAsync({
          id: page.id,
          missionId,
          updates: { content: values.content as string, title: values.title as string },
        });
        return true;
      } catch {
        return false;
      }
    },
  });

  const handleGeneratePageSummary = async () => {
    setAiSummaryLoading(true);
    setAiSummary(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté");

      const response = await supabase.functions.invoke("generate-mission-summary", {
        body: { action: "summarize_page", mission_id: missionId, page_id: page.id },
      });

      if (response.error) throw new Error(response.error instanceof Error ? response.error.message : "Erreur inconnue");
      setAiSummary(response.data.result);
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Impossible de générer le résumé", variant: "destructive" });
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        const ext = file.name.split(".").pop() || "png";
        const fileName = `pages/${page.id}/${Date.now()}.${ext}`;
        const contentType = resolveContentType(file);
        const { error } = await supabase.storage
          .from("mission-media")
          .upload(fileName, file, { contentType });
        if (error) throw error;
        const { data: urlData } = supabase.storage
          .from("mission-media")
          .getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;
        const fileType = contentType.startsWith("video/") ? "video" as const : "image" as const;
        await registerMediaEntry({
          file_url: publicUrl,
          file_name: file.name,
          file_type: fileType,
          mime_type: contentType,
          file_size: file.size,
          source_type: "mission",
          source_id: missionId,
        });
        return publicUrl;
      } catch (err) {
        console.error("Upload error:", err);
        return null;
      }
    },
    [page.id, missionId]
  );

  const uploadDocument = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        const fileName = `pages/${page.id}/docs/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage
          .from("mission-media")
          .upload(fileName, file, { contentType: resolveContentType(file) });
        if (error) throw error;
        const { data: urlData } = supabase.storage
          .from("mission-media")
          .getPublicUrl(fileName);
        return urlData.publicUrl;
      } catch (err) {
        console.error("Upload error:", err);
        return null;
      }
    },
    [page.id]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: { HTMLAttributes: { class: "bg-muted/50 rounded-md p-4 font-mono text-sm" } },
        blockquote: { HTMLAttributes: { class: "border-l-4 border-primary/30 pl-4 italic text-muted-foreground" } },
        horizontalRule: { HTMLAttributes: { class: "my-6 border-muted-foreground/30 border-t-2" } },
      }),
      LinkExtension.configure({
        openOnClick: true,
        HTMLAttributes: { class: "text-primary underline cursor-pointer" },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ImageExtension.configure({
        inline: false,
        HTMLAttributes: { class: "rounded-lg max-w-full mx-auto my-4" },
      }),
      Placeholder.configure({
        placeholder: "Écrivez ici... Tapez '---' pour un séparateur",
        emptyEditorClass: "is-editor-empty",
      }),
      TaskList.configure({ HTMLAttributes: { class: "not-prose" } }),
      TaskItem.configure({ nested: true, HTMLAttributes: { class: "flex items-start gap-2" } }),
      Highlight.configure({ HTMLAttributes: { class: "bg-yellow-200 dark:bg-yellow-800/50 rounded px-1" } }),
      Typography,
      DetailsNode,
      SummaryNode,
      VideoNode,
    ],
    content: ensureHtmlContent(page.content || ""),
    editorProps: {
      attributes: {
        class: "prose prose-base dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-280px)] py-2 text-[15px] leading-normal",
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) continue;
            setImageUploading(true);
            uploadImage(file).then((url) => {
              setImageUploading(false);
              if (url && editor) editor.chain().focus().setImage({ src: url }).run();
            });
            return true;
          }
        }

        // Plain text paste: preserve line breaks
        const html = event.clipboardData?.getData("text/html");
        if (!html) {
          const text = event.clipboardData?.getData("text/plain");
          if (text && text.includes("\n")) {
            event.preventDefault();
            const htmlContent = text
              .split(/\n\n+/)
              .filter((b) => b.trim())
              .map((b) => `<p>${b.replace(/\n/g, "<br>")}</p>`)
              .join("");
            editor?.commands.insertContent(htmlContent);
            return true;
          }
        }

        return false;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const file = files[0];
        const dropType = resolveContentType(file);
        if (dropType.startsWith("image/")) {
          event.preventDefault();
          setImageUploading(true);
          uploadImage(file).then((url) => {
            setImageUploading(false);
            if (url && editor) editor.chain().focus().setImage({ src: url }).run();
          });
          return true;
        }
        if (dropType.startsWith("video/")) {
          event.preventDefault();
          setImageUploading(true);
          uploadImage(file).then((url) => {
            setImageUploading(false);
            if (url && editor) {
              editor.chain().focus().insertContent({ type: "video", attrs: { src: url } }).run();
            }
          });
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const firstLineText = ed.state.doc.firstChild?.textContent?.trim() || "Sans titre";
      const title = firstLineText.substring(0, 100) || "Sans titre";
      onPageUpdated({ ...page, title, content: ed.getHTML() });
      setEditorValues({ content: ed.getHTML(), title });
    },
  });

  useEffect(() => {
    if (editor && page.content !== undefined) {
      const currentHtml = editor.getHTML();
      const newContent = ensureHtmlContent(page.content || "");
      if (currentHtml !== newContent) {
        editor.commands.setContent(newContent, { emitUpdate: false });
      }
    }
  }, [page.id]);

  const handleImageUpload = async (files: FileList) => {
    if (!editor) return;
    setImageUploading(true);
    for (const file of Array.from(files)) {
      if (resolveContentType(file).startsWith("image/")) {
        const url = await uploadImage(file);
        if (url) editor.chain().focus().setImage({ src: url }).run();
      }
    }
    setImageUploading(false);
  };

  const handleVideoUpload = async (files: FileList) => {
    if (!editor) return;
    setImageUploading(true);
    for (const file of Array.from(files)) {
      if (resolveContentType(file).startsWith("video/")) {
        const url = await uploadImage(file);
        if (url) editor.chain().focus().insertContent({ type: "video", attrs: { src: url } }).run();
      }
    }
    setImageUploading(false);
  };

  const handleDocumentUpload = async (files: FileList) => {
    if (!editor) return;
    setFileUploading(true);
    for (const file of Array.from(files)) {
      const url = await uploadDocument(file);
      if (url) {
        const icon = getFileIcon(file.name);
        const size = formatFileSize(file.size);
        editor.chain().focus().insertContent(
          `<p><a href="${url}" target="_blank" rel="noopener">${icon} ${file.name} <em>(${size})</em></a></p>`
        ).run();
      }
    }
    setFileUploading(false);
    toast({ title: "Document(s) ajouté(s)" });
  };

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("URL du lien:", prev);
    if (url === null) return;
    if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const insertToggleBlock = () => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: "details",
      content: [
        { type: "summary", content: [{ type: "text", text: "Cliquez pour déplier" }] },
        { type: "paragraph", content: [{ type: "text", text: "Contenu masquable..." }] },
      ],
    }).run();
  };

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full">
      <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => e.target.files && handleImageUpload(e.target.files)} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
        onChange={(e) => e.target.files && handleVideoUpload(e.target.files)} />
      <input ref={fileInputRef} type="file" multiple className="hidden"
        onChange={(e) => e.target.files && handleDocumentUpload(e.target.files)} />

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 pb-2 mb-1 border-b overflow-x-auto flex-nowrap">
        <TB active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} t="Gras"><Bold className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} t="Italique"><Italic className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} t="Souligné"><UnderlineIcon className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} t="Barré"><Strikethrough className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} t="Surligné"><Highlighter className="h-3.5 w-3.5" /></TB>

        <TSep />

        <TB active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} t="Titre 1"><Heading1 className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} t="Titre 2"><Heading2 className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} t="Titre 3"><Heading3 className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("heading", { level: 4 })} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} t="Titre 4"><Heading4 className="h-3.5 w-3.5" /></TB>

        <TSep />

        <TB active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} t="Gauche"><AlignLeft className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} t="Centrer"><AlignCenter className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} t="Droite"><AlignRight className="h-3.5 w-3.5" /></TB>

        <TSep />

        <TB active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} t="Puces"><List className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} t="Numérotée"><ListOrdered className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} t="Checklist"><CheckSquare className="h-3.5 w-3.5" /></TB>

        <TSep />

        <TB active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} t="Citation"><Quote className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} t="Code"><Code className="h-3.5 w-3.5" /></TB>
        <TB active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} t="Séparateur"><Minus className="h-3.5 w-3.5" /></TB>
        <TB active={false} onClick={insertToggleBlock} t="Dépliable"><ChevronDownSquare className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("link")} onClick={setLink} t="Lien"><LinkIcon className="h-3.5 w-3.5" /></TB>

        <TSep />

        <TB active={false} onClick={() => imageInputRef.current?.click()} t="Image"><ImageIcon className="h-3.5 w-3.5" /></TB>
        <TB active={false} onClick={() => videoInputRef.current?.click()} t="Vidéo"><Video className="h-3.5 w-3.5" /></TB>
        <TB active={false} onClick={() => fileInputRef.current?.click()} t="Document"><Paperclip className="h-3.5 w-3.5" /></TB>

        <div className="flex-1" />

        <TB active={false} onClick={() => editor.chain().focus().undo().run()} t="Annuler" disabled={!editor.can().undo()}><Undo className="h-3.5 w-3.5" /></TB>
        <TB active={false} onClick={() => editor.chain().focus().redo().run()} t="Rétablir" disabled={!editor.can().redo()}><Redo className="h-3.5 w-3.5" /></TB>

        <TSep />

        <button
          onClick={handleGeneratePageSummary}
          disabled={aiSummaryLoading}
          title="Résumé IA de cette page"
          className={cn(
            "h-7 px-2 flex items-center gap-1 rounded transition-colors shrink-0 text-xs font-medium",
            aiSummary ? "bg-purple-100 text-purple-700" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            aiSummaryLoading && "opacity-50 pointer-events-none"
          )}
        >
          {aiSummaryLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Résumé IA
        </button>

        {updatePage.isPending && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
            <Loader2 className="h-3 w-3 animate-spin" />
          </span>
        )}
      </div>

      {/* AI Summary Panel */}
      {aiSummary && (
        <div className="mb-2 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm relative">
          <button
            onClick={() => setAiSummary(null)}
            className="absolute top-2 right-2 h-5 w-5 flex items-center justify-center rounded hover:bg-purple-200 text-purple-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-1.5 text-purple-700 font-medium mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            Résumé IA
          </div>
          <div className="text-purple-900 whitespace-pre-wrap leading-relaxed pr-4">{aiSummary}</div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 relative overflow-y-auto">
        <EditorContent editor={editor} />
        {(imageUploading || fileUploading) && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-md z-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Upload en cours...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Toolbar Components ──────────────────────────────────

const TB = ({
  children, active, onClick, t, disabled,
}: {
  children: React.ReactNode; active: boolean; onClick: () => void; t: string; disabled?: boolean;
}) => (
  <button onClick={onClick} disabled={disabled} title={t}
    className={cn(
      "h-7 w-7 flex items-center justify-center rounded transition-colors shrink-0",
      active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      disabled && "opacity-30 pointer-events-none"
    )}
  >
    {children}
  </button>
);

const TSep = () => <div className="w-px h-5 bg-border mx-0.5 shrink-0" />;

// ─── Helpers ─────────────────────────────────────────────

const getFileIcon = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["pdf"].includes(ext || "")) return "📕";
  if (["doc", "docx"].includes(ext || "")) return "📘";
  if (["xls", "xlsx"].includes(ext || "")) return "📗";
  if (["ppt", "pptx"].includes(ext || "")) return "📙";
  if (["zip", "rar", "7z"].includes(ext || "")) return "📦";
  return "📎";
};


// ─── Main Component ─────────────────────────────────────

const MissionPages = ({ mission, initialActivityPageRequest, onActivityPageCreated }: MissionPagesProps) => {
  const { toast } = useToast();
  const { data: pages, isLoading } = useMissionPages(mission.id);
  const { data: pageTemplates } = useMissionPageTemplates();
  const createPage = useCreateMissionPage();
  const updatePage = useUpdateMissionPage();
  const deletePage = useDeleteMissionPage();

  const [selectedPage, setSelectedPage] = useState<MissionPage | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sortMode, setSortMode] = useState<PageSortMode>("date_desc");

  const sortFn = useCallback((a: MissionPage, b: MissionPage): number => {
    switch (sortMode) {
      case "name_asc": return a.title.localeCompare(b.title, "fr");
      case "name_desc": return b.title.localeCompare(a.title, "fr");
      case "date_asc": return a.updated_at.localeCompare(b.updated_at);
      case "date_desc": return b.updated_at.localeCompare(a.updated_at);
      default: return 0;
    }
  }, [sortMode]);

  const rootPages = (pages || [])
    .filter((p) => !p.parent_page_id)
    .sort(sortFn);

  useEffect(() => {
    if (pages && pages.length > 0 && !selectedPage) {
      setSelectedPage(rootPages[0] || pages[0]);
    }
  }, [pages]);

  useEffect(() => {
    if (selectedPage && pages) {
      const fresh = pages.find((p) => p.id === selectedPage.id);
      if (fresh && (fresh.title !== selectedPage.title || fresh.icon !== selectedPage.icon)) {
        setSelectedPage(fresh);
      }
    }
  }, [pages]);

  useEffect(() => {
    if (initialActivityPageRequest && pages !== undefined) {
      handleCreatePage(null, initialActivityPageRequest.description, undefined, initialActivityPageRequest.activityId);
      onActivityPageCreated?.();
    }
  }, [initialActivityPageRequest]);

  const handleCreatePage = async (parentId?: string | null, title?: string, templateContent?: string, activityId?: string) => {
    try {
      const newPage = await createPage.mutateAsync({
        mission_id: mission.id,
        parent_page_id: parentId,
        title: title || "Sans titre",
        content: templateContent || undefined,
        activity_id: activityId || undefined,
      });
      setSelectedPage(newPage);
    } catch (error: unknown) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    }
  };

  const handleCreateFromTemplate = async (template: MissionPageTemplate) => {
    try {
      const newPage = await createPage.mutateAsync({
        mission_id: mission.id,
        title: template.name,
        content: template.content,
        icon: template.icon,
      });
      setSelectedPage(newPage);
      toast({ title: "Page créée à partir du modèle" });
    } catch (error: unknown) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    }
  };

  const handleToggleExpand = async (page: MissionPage) => {
    try {
      await updatePage.mutateAsync({ id: page.id, missionId: mission.id, updates: { is_expanded: !page.is_expanded } });
    } catch {}
  };

  const handleDeletePage = async (page: MissionPage) => {
    if (!confirm("Supprimer cette page et ses sous-pages ?")) return;
    try {
      await deletePage.mutateAsync({ id: page.id, missionId: mission.id });
      if (selectedPage?.id === page.id) {
        const remaining = (pages || []).filter((p) => p.id !== page.id);
        setSelectedPage(remaining[0] || null);
      }
      toast({ title: "Page supprimée" });
    } catch (error: unknown) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    }
  };

  const handlePageUpdated = (updatedPage: MissionPage) => {
    setSelectedPage((prev) => (prev?.id === updatedPage.id ? { ...prev, ...updatedPage } : prev));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pages || pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="font-medium text-lg mb-1">Aucune page</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Créez des pages pour documenter votre mission.
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={() => handleCreatePage(null)} disabled={createPage.isPending}>
            {createPage.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Page vierge
          </Button>
          {pageTemplates && pageTemplates.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={createPage.isPending}>
                  <LayoutTemplate className="h-4 w-4 mr-2" />
                  Depuis un modèle
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {pageTemplates.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => handleCreateFromTemplate(t)}>
                    <span className="mr-2">{t.icon}</span>
                    {t.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-0 -mx-6 -mb-6" style={{ height: "calc(100vh - 180px)" }}>
      {/* Sidebar toggle when collapsed */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="w-8 shrink-0 flex items-start justify-center pt-3 border-r bg-muted/10 hover:bg-muted/30 transition-colors"
          title="Afficher les pages"
        >
          <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Sidebar */}
      <div className={cn(
        "border-r bg-muted/20 flex flex-col transition-all overflow-hidden",
        sidebarCollapsed ? "w-0" : "w-64 shrink-0"
      )}>
        <div className="p-2 border-b flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Pages</span>
          <div className="flex items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Trier">
                  <ArrowDownUp className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortMode("date_desc")} className={sortMode === "date_desc" ? "font-medium bg-muted" : ""}>
                  Date modif. (récent)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMode("date_asc")} className={sortMode === "date_asc" ? "font-medium bg-muted" : ""}>
                  Date modif. (ancien)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMode("name_asc")} className={sortMode === "name_asc" ? "font-medium bg-muted" : ""}>
                  Nom (A→Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMode("name_desc")} className={sortMode === "name_desc" ? "font-medium bg-muted" : ""}>
                  Nom (Z→A)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {pageTemplates && pageTemplates.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Modèle">
                    <LayoutTemplate className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {pageTemplates.map((t) => (
                    <DropdownMenuItem key={t.id} onClick={() => handleCreateFromTemplate(t)}>
                      <span className="mr-2">{t.icon}</span>
                      {t.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button onClick={() => handleCreatePage(null)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Nouvelle page">
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setSidebarCollapsed(true)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Masquer">
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-1 px-1">
          {rootPages.map((page) => (
            <PageTreeItem
              key={page.id}
              page={page}
              allPages={pages || []}
              level={0}
              onSelect={setSelectedPage}
              onAddChild={handleCreatePage}
              onDelete={handleDeletePage}
              onToggleExpand={handleToggleExpand}
              selectedPageId={selectedPage?.id || null}
              sortFn={sortFn}
            />
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {selectedPage ? (
          <div className="h-full px-4 py-3 overflow-y-auto">
            <PageEditor
              key={selectedPage.id}
              page={selectedPage}
              missionId={mission.id}
              onPageUpdated={handlePageUpdated}
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Sélectionnez une page</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MissionPages;
