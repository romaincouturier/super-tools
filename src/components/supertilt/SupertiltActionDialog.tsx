import { useState, useEffect } from "react";
import { CalendarDays, Trash2, Check, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { SupertiltAction } from "@/hooks/useSupertilt";

interface SystemUser {
  user_id: string;
  email: string;
  display_name: string | null;
}

interface Props {
  action: SupertiltAction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  systemUsers: SystemUser[];
  onSave: (updates: Partial<Pick<SupertiltAction, "title" | "description" | "assigned_to" | "deadline" | "is_completed">>) => void;
  onDelete: () => void;
}

export default function SupertiltActionDialog({
  action,
  open,
  onOpenChange,
  systemUsers,
  onSave,
  onDelete,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigned, setAssigned] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (action) {
      setTitle(action.title);
      setDescription(action.description || "");
      setAssigned(action.assigned_to || "__none__");
      setDeadline(action.deadline ? new Date(action.deadline + "T00:00:00") : undefined);
    }
  }, [action]);

  if (!action) return null;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier l'action</DialogTitle>
        </DialogHeader>
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
        <DialogFooter className="gap-2 sm:gap-2">
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
                  L'action « {action.title} » sera définitivement supprimée.
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
          <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-1.5">
            <X className="h-4 w-4" /> Annuler
          </Button>
          <Button onClick={handleSave} disabled={!title.trim()} className="gap-1.5">
            <Check className="h-4 w-4" /> Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
