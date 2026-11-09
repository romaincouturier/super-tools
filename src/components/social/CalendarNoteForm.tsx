import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { useCreateSocialNote, useDeleteSocialNote, useUpdateSocialNote } from "@/hooks/useSocialContents";
import { maskText } from "@/lib/demoMask";
import { toastError } from "@/lib/toastError";
import { cn } from "@/lib/utils";
import { NOTE_TEXT_MAX, noteTextLength, THEME_COLORS, type SocialCalendarNote } from "@/services/socialContents";

/** Création sur un jour (note null) ou édition d'une note existante. */
export interface NoteFormTarget {
  day: string;
  note: SocialCalendarNote | null;
}

interface CalendarNoteFormProps {
  target: NoteFormTarget | null;
  onClose: () => void;
  /** Appelé après un enregistrement réussi, avec le jour de la note. */
  onSaved?: (day: string) => void;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Clé de montage du formulaire : un état neuf par note ou par jour. */
const targetKey = (target: NoteFormTarget) => (target.note ? `note:${target.note.id}` : `day:${target.day}`);

function isValidDay(day: string): boolean {
  if (!DAY_RE.test(day)) return false;
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function NoteFormBody({ target, pending, demo, onSubmit, onDelete, onCancel }: {
  target: NoteFormTarget;
  pending: { save: boolean; any: boolean };
  /** Mode démo sur une note existante : texte masqué en lecture seule, enregistrement impossible. */
  demo: boolean;
  onSubmit: (values: { day: string; text: string; color: string }) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(target.note?.text ?? "");
  const [color, setColor] = useState(target.note?.color ?? THEME_COLORS[0]);
  const [day, setDay] = useState(target.note?.day ?? target.day);
  const editing = !!target.note;
  const length = noteTextLength(text.trim());
  const tooLong = length > NOTE_TEXT_MAX;
  const canSave = !demo && length > 0 && !tooLong && isValidDay(day) && !pending.any;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) onSubmit({ day, text, color });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="social-note-text">Texte</Label>
        <Textarea
          id="social-note-text"
          value={demo ? maskText(text) : text}
          readOnly={demo}
          rows={3}
          aria-describedby="social-note-count"
          onChange={(e) => setText(e.target.value)}
        />
        <p
          id="social-note-count"
          className={cn("text-xs text-right tabular-nums", tooLong ? "text-destructive" : "text-muted-foreground")}
        >
          {length}/{NOTE_TEXT_MAX}
        </p>
        {demo && <p className="text-xs text-muted-foreground">Mode démo : le texte n'est pas modifiable.</p>}
      </div>
      <div className="space-y-1">
        <span className="text-sm font-medium">Couleur</span>
        <div className="flex gap-1.5" role="group" aria-label="Couleur">
          {THEME_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Couleur ${c}`}
              aria-pressed={c === color}
              onClick={() => setColor(c)}
              className={cn("h-6 w-6 rounded-full border-2", c === color ? "border-foreground" : "border-transparent")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      {editing && (
        <div className="space-y-1">
          <Label htmlFor="social-note-day">Jour</Label>
          <Input id="social-note-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
      )}
      <DialogFooter className="gap-2 sm:justify-between">
        {editing ? (
          <Button type="button" variant="destructive" onClick={onDelete} disabled={pending.any}>Supprimer</Button>
        ) : <span />}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending.any}>Annuler</Button>
          <Button type="submit" disabled={!canSave}>
            {pending.save && <Spinner className="mr-1" />}
            Enregistrer
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

export default function CalendarNoteForm({ target, onClose, onSaved }: CalendarNoteFormProps) {
  const { toast } = useToast();
  const { isDemoMode } = useDemoMode();
  const { confirm, ConfirmDialog } = useConfirm();
  const create = useCreateSocialNote();
  const update = useUpdateSocialNote();
  const remove = useDeleteSocialNote();
  const pending = {
    save: create.isPending || update.isPending,
    any: create.isPending || update.isPending || remove.isPending,
  };
  const editing = !!target?.note;

  const onError = (e: unknown) => toastError(toast, e);
  const close = () => { if (!pending.any) onClose(); };

  const submit = (values: { day: string; text: string; color: string }) => {
    if (!target) return;
    const onSuccess = () => {
      onSaved?.(values.day);
      onClose();
    };
    if (target.note) {
      update.mutate({ id: target.note.id, ...values }, { onSuccess, onError });
    } else {
      create.mutate(values, { onSuccess, onError });
    }
  };

  const handleDelete = async () => {
    if (!target?.note) return;
    const ok = await confirm({
      title: "Supprimer cette note ?",
      description: "La note disparaîtra du calendrier.",
      confirmText: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    remove.mutate(target.note.id, { onSuccess: onClose, onError });
  };

  return (
    <>
      <Dialog open={!!target} onOpenChange={(open) => { if (!open) close(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la note" : "Ajouter une note"}</DialogTitle>
            <DialogDescription>Un repère dans le calendrier, hors des contenus et de leurs statuts.</DialogDescription>
          </DialogHeader>
          {target && (
            <NoteFormBody
              key={targetKey(target)}
              target={target}
              pending={pending}
              demo={isDemoMode && editing}
              onSubmit={submit}
              onDelete={handleDelete}
              onCancel={close}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog />
    </>
  );
}
