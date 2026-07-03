import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Trash2, Check, X, FileText, Briefcase, FolderOpen, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useEnsureActionMission, type SupertiltAction } from "@/hooks/useSupertilt";
import { fetchMissionById } from "@/services/missions";
import MissionPages from "@/components/missions/MissionPages";
import EntityDocumentsManager from "@/components/shared/EntityDocumentsManager";
import EntityMediaManager from "@/components/media/EntityMediaManager";

interface SystemUser {
  user_id: string;
  email: string;
  display_name: string | null;
}

interface Props {
  action: SupertiltAction | null;
  open: boolean;
  isNew?: boolean;
  onOpenChange: (open: boolean) => void;
  systemUsers: SystemUser[];
  onSave: (updates: Partial<Pick<SupertiltAction, "title" | "description" | "assigned_to" | "deadline" | "is_completed">>) => void;
  onDelete: () => void;
}

type TabValue = "details" | "pages" | "documents" | "gallery";

export default function SupertiltActionDialog({
  action,
  open,
  isNew = false,
  onOpenChange,
  systemUsers,
  onSave,
  onDelete,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigned, setAssigned] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [tab, setTab] = useState<TabValue>("details");
  // Track the mission id once ensured (either pre-existing or freshly created).
  const [missionId, setMissionId] = useState<string | null>(null);
  const ensureMission = useEnsureActionMission();

  useEffect(() => {
    if (open) {
      setTitle(action?.title ?? "");
      setDescription(action?.description || "");
      setAssigned(action?.assigned_to || "__none__");
      setDeadline(action?.deadline ? new Date(action.deadline + "T00:00:00") : undefined);
      setTab("details");
      setMissionId(action?.mission_id ?? null);
    }
  }, [open, action]);

  const handleTabChange = async (v: string) => {
    const next = v as TabValue;
    if (next !== "details" && !missionId && action?.id && !ensureMission.isPending) {
      setTab(next);
      const id = await ensureMission.mutateAsync(action).catch(() => null);
      if (id) setMissionId(id);
      return;
    }
    setTab(next);
  };

  const { data: linkedMission, isLoading: missionLoading } = useQuery({
    queryKey: ["mission-by-id", missionId],
    queryFn: () => fetchMissionById(missionId as string),
    enabled: !!missionId && open && tab === "pages",
  });

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      assigned_to: assigned && assigned !== "__none__" ? assigned : null,
      deadline: deadline ? format(deadline, "yyyy-MM-dd") : null,
    });
    onOpenChange(false);
  };

  const tabsEnabled = !isNew && !!action?.id;
  const isCreatingSpace = ensureMission.isPending;

  const detailsContent = (
    <>
      <div className="space-y-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre *"
          autoFocus
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optionnel)"
          rows={3}
        />
        <Select value={assigned} onValueChange={setAssigned}>
          <SelectTrigger>
            <SelectValue placeholder="Assigné à (optionnel)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Aucun —</SelectItem>
            {systemUsers.map((u) => (
              <SelectItem key={u.user_id} value={u.display_name || u.email}>
                {u.display_name || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !deadline && "text-muted-foreground",
              )}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              {deadline ? format(deadline, "d MMMM yyyy", { locale: fr }) : "Date attendue (optionnel)"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={deadline}
              onSelect={setDeadline}
              locale={fr}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
      <DialogFooter className="gap-2 sm:gap-2 mt-4">
        {!isNew && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-destructive mr-auto gap-1.5">
                <Trash2 className="h-4 w-4" /> Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette action ?</AlertDialogTitle>
                <AlertDialogDescription>
                  L'action « {action?.title} » sera définitivement supprimée.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onDelete();
                    onOpenChange(false);
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-1.5 ml-auto">
          <X className="h-4 w-4" /> Annuler
        </Button>
        <Button onClick={handleSave} disabled={!title.trim()} className="gap-1.5">
          <Check className="h-4 w-4" /> Enregistrer
        </Button>
      </DialogFooter>
    </>
  );

  const dialogTitle = isNew ? "Nouvelle action" : (action?.title ?? "Action");

  const renderTabBody = () => {
    if (isCreatingSpace || (tab !== "details" && !missionId)) {
      return (
        <div className="h-full flex items-center justify-center">
          <Spinner />
        </div>
      );
    }
    if (tab === "pages") {
      if (missionLoading || !linkedMission) {
        return (
          <div className="h-full flex items-center justify-center">
            <Spinner />
          </div>
        );
      }
      return (
        <div className="h-full overflow-hidden">
          <MissionPages mission={linkedMission} />
        </div>
      );
    }
    if (tab === "documents" && missionId) {
      return (
        <EntityDocumentsManager
          entityType="mission"
          entityId={missionId}
          variant="bare"
          title="Documents"
        />
      );
    }
    if (tab === "gallery" && missionId) {
      return (
        <EntityMediaManager
          sourceType="mission"
          sourceId={missionId}
          sourceLabel={action?.title || ""}
          variant="bare"
          enablePaste
        />
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
          <TabsList className="self-start">
            <TabsTrigger value="details" className="gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> Détails
            </TabsTrigger>
            <TabsTrigger value="pages" className="gap-1.5" disabled={!tabsEnabled}>
              <FileText className="h-3.5 w-3.5" /> Pages
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5" disabled={!tabsEnabled}>
              <FolderOpen className="h-3.5 w-3.5" /> Documents
            </TabsTrigger>
            <TabsTrigger value="gallery" className="gap-1.5" disabled={!tabsEnabled}>
              <ImageIcon className="h-3.5 w-3.5" /> Galerie
            </TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-4">
            {detailsContent}
          </TabsContent>
          <TabsContent value="pages" className="flex-1 min-h-0 mt-4 overflow-hidden">
            {tab === "pages" && renderTabBody()}
          </TabsContent>
          <TabsContent value="documents" className="flex-1 min-h-0 mt-4 overflow-auto">
            {tab === "documents" && renderTabBody()}
          </TabsContent>
          <TabsContent value="gallery" className="flex-1 min-h-0 mt-4 overflow-auto">
            {tab === "gallery" && renderTabBody()}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
