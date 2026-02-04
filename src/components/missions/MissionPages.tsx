import { useState, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  FileText,
  Trash2,
  MoreHorizontal,
  Edit2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
          "group flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors",
          selectedPageId === page.id && "bg-muted"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {/* Expand/Collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(page);
          }}
          className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {hasChildren ? (
            page.is_expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>

        {/* Icon */}
        <span className="text-base">{page.icon || "📄"}</span>

        {/* Title */}
        <span
          className="flex-1 truncate text-sm"
          onClick={() => onSelect(page)}
        >
          {page.title || "Sans titre"}
        </span>

        {/* Actions */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(page.id);
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onDelete(page)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Children */}
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

const MissionPages = ({ mission }: MissionPagesProps) => {
  const { toast } = useToast();
  const { data: pages, isLoading } = useMissionPages(mission.id);
  const createPage = useCreateMissionPage();
  const updatePage = useUpdateMissionPage();
  const deletePage = useDeleteMissionPage();

  const [selectedPage, setSelectedPage] = useState<MissionPage | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [contentValue, setContentValue] = useState("");
  const [iconValue, setIconValue] = useState("");

  // Get root pages (no parent)
  const rootPages = (pages || [])
    .filter((p) => !p.parent_page_id)
    .sort((a, b) => a.position - b.position);

  const handleCreatePage = async (parentId?: string | null) => {
    try {
      const newPage = await createPage.mutateAsync({
        mission_id: mission.id,
        parent_page_id: parentId,
        title: "Nouvelle page",
      });
      setSelectedPage(newPage);
      setTitleValue(newPage.title);
      setContentValue(newPage.content || "");
      setIconValue(newPage.icon || "");
      toast({ title: "Page créée" });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSelectPage = (page: MissionPage) => {
    setSelectedPage(page);
    setTitleValue(page.title);
    setContentValue(page.content || "");
    setIconValue(page.icon || "");
    setEditingTitle(false);
  };

  const handleToggleExpand = async (page: MissionPage) => {
    try {
      await updatePage.mutateAsync({
        id: page.id,
        missionId: mission.id,
        updates: { is_expanded: !page.is_expanded },
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeletePage = async (page: MissionPage) => {
    if (!confirm("Supprimer cette page et ses sous-pages ?")) return;

    try {
      await deletePage.mutateAsync({ id: page.id, missionId: mission.id });
      if (selectedPage?.id === page.id) {
        setSelectedPage(null);
      }
      toast({ title: "Page supprimée" });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSavePage = async () => {
    if (!selectedPage) return;

    try {
      await updatePage.mutateAsync({
        id: selectedPage.id,
        missionId: mission.id,
        updates: {
          title: titleValue.trim() || "Sans titre",
          content: contentValue,
          icon: iconValue || null,
        },
      });
      // Update local state
      setSelectedPage({
        ...selectedPage,
        title: titleValue.trim() || "Sans titre",
        content: contentValue,
        icon: iconValue || null,
      });
      toast({ title: "Page sauvegardée" });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Auto-save on blur
  const handleContentBlur = useCallback(() => {
    if (selectedPage && contentValue !== selectedPage.content) {
      handleSavePage();
    }
  }, [selectedPage, contentValue]);

  const handleTitleBlur = useCallback(() => {
    if (selectedPage && titleValue !== selectedPage.title) {
      handleSavePage();
    }
    setEditingTitle(false);
  }, [selectedPage, titleValue]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Pages ({pages?.length || 0})</h4>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleCreatePage(null)}
          disabled={createPage.isPending}
        >
          {createPage.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-1" />
          )}
          Nouvelle page
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : pages && pages.length > 0 ? (
        <div className="flex gap-4 min-h-[300px]">
          {/* Page tree */}
          <div className="w-1/3 border rounded-lg p-2 overflow-y-auto max-h-[400px]">
            {rootPages.map((page) => (
              <PageTreeItem
                key={page.id}
                page={page}
                allPages={pages}
                level={0}
                onSelect={handleSelectPage}
                onAddChild={handleCreatePage}
                onDelete={handleDeletePage}
                onToggleExpand={handleToggleExpand}
                selectedPageId={selectedPage?.id || null}
              />
            ))}
          </div>

          {/* Page content */}
          <div className="flex-1 border rounded-lg p-4">
            {selectedPage ? (
              <div className="space-y-4">
                {/* Title with icon */}
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="text-2xl hover:bg-muted rounded p-1">
                        {iconValue || "📄"}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <div className="grid grid-cols-6 gap-1 p-2">
                        {["📄", "📝", "📋", "📌", "📎", "📁", "💡", "⭐", "🎯", "✅", "🔧", "📊"].map(
                          (emoji) => (
                            <button
                              key={emoji}
                              className="text-xl hover:bg-muted rounded p-1"
                              onClick={() => {
                                setIconValue(emoji);
                                if (selectedPage) {
                                  updatePage.mutate({
                                    id: selectedPage.id,
                                    missionId: mission.id,
                                    updates: { icon: emoji },
                                  });
                                }
                              }}
                            >
                              {emoji}
                            </button>
                          )
                        )}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {editingTitle ? (
                    <Input
                      value={titleValue}
                      onChange={(e) => setTitleValue(e.target.value)}
                      onBlur={handleTitleBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleTitleBlur()}
                      className="text-xl font-bold"
                      autoFocus
                    />
                  ) : (
                    <h2
                      className="text-xl font-bold cursor-pointer hover:bg-muted/50 px-2 py-1 rounded flex-1"
                      onClick={() => setEditingTitle(true)}
                    >
                      {titleValue || "Sans titre"}
                    </h2>
                  )}
                </div>

                {/* Content */}
                <Textarea
                  value={contentValue}
                  onChange={(e) => setContentValue(e.target.value)}
                  onBlur={handleContentBlur}
                  placeholder="Écrivez votre contenu ici..."
                  className="min-h-[200px] resize-none"
                />

                {/* Save indicator */}
                {updatePage.isPending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Sauvegarde...
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Sélectionnez une page ou créez-en une nouvelle</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Aucune page créée</p>
          <p className="text-sm">
            Créez des pages pour organiser vos notes et documents
          </p>
        </div>
      )}
    </div>
  );
};

export default MissionPages;
