import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import type { Improvement, Training, ImprovementFormData } from "@/hooks/useImprovements";
import { EMPTY_FORM, SOURCE_TYPES, PRIORITIES } from "@/hooks/useImprovements";

interface ImprovementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainings: Training[];
  improvement?: Improvement | null;
  onSave: (data: ImprovementFormData, existingId?: string) => Promise<void>;
}

export default function ImprovementFormDialog({
  open,
  onOpenChange,
  trainings,
  improvement,
  onSave,
}: ImprovementFormDialogProps) {
  const [form, setForm] = useState<ImprovementFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const isEdit = !!improvement;

  useEffect(() => {
    if (improvement) {
      setForm({
        training_id: improvement.training_id,
        title: improvement.title,
        description: improvement.description,
        category: improvement.category,
        source_type: improvement.source_type || "",
        source_description: improvement.source_description || "",
        priority: improvement.priority || "",
        deadline: improvement.deadline || "",
        responsible: improvement.responsible || "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [improvement, open]);

  const set = (field: keyof ImprovementFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.training_id) {
      toastError(toast, "Veuillez sélectionner une formation");
      return;
    }
    if (!form.title.trim()) {
      toastError(toast, "Veuillez saisir un titre");
      return;
    }
    if (!form.description.trim()) {
      toastError(toast, "Veuillez saisir une description");
      return;
    }

    setSaving(true);
    try {
      await onSave(form, improvement?.id);
      onOpenChange(false);
      if (!isEdit) setForm(EMPTY_FORM);
    } catch {
      toastError(toast, "Impossible de sauvegarder");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'amélioration" : "Ajouter une amélioration"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modifiez les détails de l'amélioration." : "Créez une nouvelle amélioration pour une formation."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Formation *</Label>
            <Select value={form.training_id} onValueChange={(v) => set("training_id", v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une formation" /></SelectTrigger>
              <SelectContent>
                {trainings.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.training_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recommendation">Recommandation</SelectItem>
                <SelectItem value="weakness">Point faible</SelectItem>
                <SelectItem value="manual">Manuel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Titre *</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ex: Améliorer les supports visuels"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label>Description *</Label>
            <VoiceTextarea
              value={form.description}
              onValueChange={(v) => set("description", v)}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Décrivez l'amélioration à apporter..."
              rows={4}
              maxLength={1000}
            />
          </div>

          <div className="space-y-2">
            <Label>Source</Label>
            <Select
              value={form.source_type || "none"}
              onValueChange={(v) => set("source_type", v === "none" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="Type de source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {SOURCE_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description de la source</Label>
            <Input
              value={form.source_description}
              onChange={(e) => set("source_description", e.target.value)}
              placeholder="Ex: Réclamation client X du 15/01"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select
                value={form.priority || "none"}
                onValueChange={(v) => set("priority", v === "none" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="Priorité" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non définie</SelectItem>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Échéance</Label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => set("deadline", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Responsable</Label>
            <Input
              value={form.responsible}
              onChange={(e) => set("responsible", e.target.value)}
              placeholder="Nom du responsable"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Spinner className="mr-2" />}
            {isEdit ? "Modifier" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
