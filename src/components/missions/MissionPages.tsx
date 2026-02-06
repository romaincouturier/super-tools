import { useState, useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import ImageExtension from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
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
  Quote,
  Code,
  Minus,
  ImageIcon,
  Paperclip,
  Upload,
  FileUp,
  X,
  Undo,
  Redo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  useMissionPages,
  useCreateMissionPage,
  useUpdateMissionPage,
  useDeleteMissionPage,
  MissionPage,
} from "@/hooks/useMissions";
import { Mission } from "@/types/missions";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface MissionPagesProps {
  mission: Mission;
}

interface PageTreeItemProps {
  page: MissionPage;
  allPages: MissionPage[];
  level: number;
  onSelect: (page: MissionPage) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (page: MissionPage) => void;
  onToggleExpand: (page: MissionPage) => void;
  selectedPageId: string | null;
}

const EMOJI_OPTIONS = [
  "📄", "📝", "📋", "📌", "📎", "📁", "💡", "⭐", "🎯", "✅",
  "🔧", "📊", "🚀", "💰", "📞", "📧", "🗓️", "👤", "🏢", "📦",
  "🔗", "💻", "🎨", "📐", "🔍", "📈", "🗂️", "✏️", "🏷️", "⚡",
];

const PageTreeItem = ({
  page,
  allPages,
  level,
  onSelect,
  onAddChild,
  onDelete,
  onToggleExpand,
  selectedPageId,
}: PageTreeItemProps) => {
  const childPages = allPages
    .filter((p) => p.parent_page_id === page.id)
    .sort((a, b) => a.position - b.position);
  const hasChildren = childPages.length > 0;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 py-1 px-1.5 rounded-md cursor-pointer transition-colors text-sm",
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

        <span className="text-sm shrink-0">{page.icon || "📄"}</span>
        <span className="truncate flex-1 text-[13px]">{page.title || "Sans titre"}</span>

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
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Notion-like page editor
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
  const [titleValue, setTitleValue] = useState(page.title);
  const [iconValue, setIconValue] = useState(page.icon || "📄");
  const [imageUploading, setImageUploading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Upload image to Supabase storage
  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        const ext = file.name.split(".").pop() || "png";
        const fileName = `pages/${page.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from("mission-media")
          .upload(fileName, file, { contentType: file.type });
        if (error) throw error;
        const { data: urlData } = supabase.storage
          .from("mission-media")
          .getPublicUrl(fileName);
        return urlData.publicUrl;
      } catch (err) {
        console.error("Image upload error:", err);
        return null;
      }
    },
    [page.id]
  );

  // Upload document attachment
  const uploadDocument = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        const fileName = `pages/${page.id}/docs/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage
          .from("mission-media")
          .upload(fileName, file, { contentType: file.type });
        if (error) throw error;
        const { data: urlData } = supabase.storage
          .from("mission-media")
          .getPublicUrl(fileName);
        return urlData.publicUrl;
      } catch (err) {
        console.error("Document upload error:", err);
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
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: "bg-muted/50 rounded-md p-4 font-mono text-sm" } },
        blockquote: { HTMLAttributes: { class: "border-l-4 border-primary/30 pl-4 italic text-muted-foreground" } },
        horizontalRule: { HTMLAttributes: { class: "my-6 border-muted" } },
      }),
      LinkExtension.configure({
        openOnClick: true,
        HTMLAttributes: { class: "text-primary underline cursor-pointer" },
      }),
      Underline,
      ImageExtension.configure({
        inline: false,
        HTMLAttributes: { class: "rounded-lg max-w-full mx-auto my-4" },
      }),
      Placeholder.configure({
        placeholder: "Écrivez ici... Tapez '/' pour les commandes",
        emptyEditorClass: "is-editor-empty",
      }),
      TaskList.configure({
        HTMLAttributes: { class: "not-prose" },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: "flex items-start gap-2" },
      }),
      Highlight.configure({
        HTMLAttributes: { class: "bg-yellow-200 dark:bg-yellow-800/50 rounded px-1" },
      }),
      Typography,
    ],
    content: page.content || "",
    editorProps: {
      attributes: {
        class: "prose prose-base dark:prose-invert max-w-none focus:outline-none min-h-[500px] px-1 py-2 text-[15px] leading-relaxed",
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
              if (url && editor) {
                editor.chain().focus().setImage({ src: url }).run();
              }
            });
            return true;
          }
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        const file = files[0];
        if (file.type.startsWith("image/")) {
          event.preventDefault();
          setImageUploading(true);
          uploadImage(file).then((url) => {
            setImageUploading(false);
            if (url && editor) {
              editor.chain().focus().setImage({ src: url }).run();
            }
          });
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      // Auto-save with debounce
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        const html = ed.getHTML();
        updatePage.mutate({
          id: page.id,
          missionId,
          updates: { content: html },
        });
      }, 800);
    },
  });

  // Sync editor content when page changes
  useEffect(() => {
    if (editor && page.content !== undefined) {
      const currentHtml = editor.getHTML();
      const newContent = page.content || "";
      if (currentHtml !== newContent) {
        editor.commands.setContent(newContent, false);
      }
    }
    setTitleValue(page.title);
    setIconValue(page.icon || "📄");
  }, [page.id]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleTitleChange = (newTitle: string) => {
    setTitleValue(newTitle);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const trimmed = newTitle.trim() || "Sans titre";
      updatePage.mutate({
        id: page.id,
        missionId,
        updates: { title: trimmed },
      });
      onPageUpdated({ ...page, title: trimmed });
    }, 600);
  };

  const handleIconChange = (emoji: string) => {
    setIconValue(emoji);
    updatePage.mutate({
      id: page.id,
      missionId,
      updates: { icon: emoji },
    });
    onPageUpdated({ ...page, icon: emoji });
  };

  const handleImageUpload = async (files: FileList) => {
    if (!editor) return;
    setImageUploading(true);
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) {
        const url = await uploadImage(file);
        if (url) {
          editor.chain().focus().setImage({ src: url }).run();
        }
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
        // Insert as a styled link block
        const icon = getFileIcon(file.name);
        const size = formatFileSize(file.size);
        editor
          .chain()
          .focus()
          .insertContent(
            `<p><a href="${url}" target="_blank" rel="noopener">${icon} ${file.name} <em>(${size})</em></a></p>`
          )
          .run();
      }
    }
    setFileUploading(false);
    toast({ title: "Document(s) ajouté(s)" });
  };

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

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleDocumentUpload(e.target.files)}
      />

      {/* Page header - Notion style */}
      <div className="pb-4 mb-2">
        {/* Icon picker */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-4xl hover:bg-muted/50 rounded-lg p-2 transition-colors mb-1">
              {iconValue}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-auto p-2">
            <div className="grid grid-cols-10 gap-0.5">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  className="text-xl hover:bg-muted rounded p-1.5 transition-colors"
                  onClick={() => handleIconChange(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Title - large, borderless, like Notion */}
        <input
          ref={titleRef}
          value={titleValue}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Sans titre"
          className="w-full text-3xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/40 py-1"
        />
      </div>

      {/* Floating toolbar */}
      <div className="flex items-center gap-0.5 pb-3 mb-1 border-b overflow-x-auto flex-wrap">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Gras"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italique"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Souligné"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Barré"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("highlight")}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          title="Surligné"
        >
          <Highlighter className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarSep />

        <ToolbarButton
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Titre 1"
        >
          <Heading1 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Titre 2"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Titre 3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarSep />

        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Liste à puces"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Liste numérotée"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="Liste de tâches"
        >
          <CheckSquare className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarSep />

        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Citation"
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Bloc de code"
        >
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Séparateur"
        >
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("link")}
          onClick={setLink}
          title="Lien"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarSep />

        <ToolbarButton
          active={false}
          onClick={() => imageInputRef.current?.click()}
          title="Ajouter une image"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={false}
          onClick={() => fileInputRef.current?.click()}
          title="Joindre un document"
        >
          <Paperclip className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="flex-1" />

        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().undo().run()}
          title="Annuler"
          disabled={!editor.can().undo()}
        >
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().redo().run()}
          title="Rétablir"
          disabled={!editor.can().redo()}
        >
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>

        {/* Save indicator */}
        {updatePage.isPending && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
            <Loader2 className="h-3 w-3 animate-spin" />
          </span>
        )}
      </div>

      {/* Editor content - maximum space */}
      <div className="flex-1 relative">
        <EditorContent editor={editor} />

        {/* Image upload overlay */}
        {(imageUploading || fileUploading) && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-md z-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {imageUploading ? "Upload de l'image..." : "Upload du document..."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Toolbar button component
const ToolbarButton = ({
  children,
  active,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      "h-7 w-7 flex items-center justify-center rounded transition-colors",
      active
        ? "bg-primary/15 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
      disabled && "opacity-30 pointer-events-none"
    )}
  >
    {children}
  </button>
);

const ToolbarSep = () => <div className="w-px h-5 bg-border mx-0.5" />;

// File helpers
const getFileIcon = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["pdf"].includes(ext || "")) return "📕";
  if (["doc", "docx"].includes(ext || "")) return "📘";
  if (["xls", "xlsx"].includes(ext || "")) return "📗";
  if (["ppt", "pptx"].includes(ext || "")) return "📙";
  if (["zip", "rar", "7z"].includes(ext || "")) return "📦";
  return "📎";
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

// Main component
const MissionPages = ({ mission }: MissionPagesProps) => {
  const { toast } = useToast();
  const { data: pages, isLoading } = useMissionPages(mission.id);
  const createPage = useCreateMissionPage();
  const updatePage = useUpdateMissionPage();
  const deletePage = useDeleteMissionPage();

  const [selectedPage, setSelectedPage] = useState<MissionPage | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const rootPages = (pages || [])
    .filter((p) => !p.parent_page_id)
    .sort((a, b) => a.position - b.position);

  // Auto-select first page
  useEffect(() => {
    if (pages && pages.length > 0 && !selectedPage) {
      setSelectedPage(rootPages[0] || pages[0]);
    }
  }, [pages]);

  // Keep selectedPage in sync with fresh data
  useEffect(() => {
    if (selectedPage && pages) {
      const fresh = pages.find((p) => p.id === selectedPage.id);
      if (fresh && (fresh.title !== selectedPage.title || fresh.icon !== selectedPage.icon)) {
        setSelectedPage(fresh);
      }
    }
  }, [pages]);

  const handleCreatePage = async (parentId?: string | null) => {
    try {
      const newPage = await createPage.mutateAsync({
        mission_id: mission.id,
        parent_page_id: parentId,
        title: "Sans titre",
      });
      setSelectedPage(newPage);
      toast({ title: "Page créée" });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleExpand = async (page: MissionPage) => {
    try {
      await updatePage.mutateAsync({
        id: page.id,
        missionId: mission.id,
        updates: { is_expanded: !page.is_expanded },
      });
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
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
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

  // Empty state
  if (!pages || pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="font-medium text-lg mb-1">Aucune page</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Créez des pages pour documenter votre mission. Images, fichiers, listes de tâches...
        </p>
        <Button onClick={() => handleCreatePage(null)} disabled={createPage.isPending}>
          {createPage.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Créer une page
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-0 min-h-[500px] -mx-6 -mb-6">
      {/* Sidebar */}
      <div
        className={cn(
          "border-r bg-muted/20 flex flex-col transition-all",
          sidebarCollapsed ? "w-0 overflow-hidden" : "w-56 shrink-0"
        )}
      >
        <div className="p-2 border-b flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Pages</span>
          <button
            onClick={() => handleCreatePage(null)}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Nouvelle page"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
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
            />
          ))}
        </div>
      </div>

      {/* Editor area - maximum space */}
      <div className="flex-1 min-w-0">
        {selectedPage ? (
          <div className="h-full px-8 py-4">
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
