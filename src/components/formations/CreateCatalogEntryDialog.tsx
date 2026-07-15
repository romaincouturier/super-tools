import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { GraduationCap, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FormationConfig } from "@/components/formations/TrainingNameCombobox";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Nom de formation pré-rempli (repris de l'opportunité ou de la saisie utilisateur). */
  initialName: string;
  /** Callback avec l'entrée catalogue créée. */
  onCreated: (config: FormationConfig) => void;
}

/**
 * Dialog minimal pour créer une entrée au catalogue formation depuis le flow
 * de création d'une formation. Permet de débloquer le parcours quand
 * l'opportunité gagnée fait référence à une formation qui n'existe pas encore.
 */
export default function CreateCatalogEntryDialog({
  open,
  onOpenChange,
  initialName,
  onCreated,
}: Props) {
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [duree, setDuree] = useState("7");
  const [prix, setPrix] = useState("0");
  const [programmeUrl, setProgrammeUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDuree("7");
      setPrix("0");
      setProgrammeUrl("");
    }
  }, [open, initialName]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({
        title: "Nom requis",
        description: "Le nom de la formation est obligatoire.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("formation_configs")
        .insert({
          formation_name: name.trim(),
          duree_heures: Number(duree) || 0,
          prix: Number(prix) || 0,
          programme_url: programmeUrl.trim() || null,
          is_default: false,
          is_active: true,
        } as never)
        .select()
        .single();
      if (error) throw error;
      toast({
        title: "Entrée créée",
        description: `"${name.trim()}" a été ajoutée au catalogue.`,
      });
      onCreated(data as unknown as FormationConfig);
      onOpenChange(false);
    } catch (err) {
      console.error("CreateCatalogEntryDialog error:", err);
      toast({
        title: "Erreur",
        description:
          err instanceof Error ? err.message : "Impossible de créer l'entrée",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Créer l'entrée au catalogue
          </DialogTitle>
          <DialogDescription>
            Cette formation n'existe pas encore dans le catalogue. Renseignez les
            informations de base pour la créer et continuer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Nom de la formation *</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-duree">Durée (heures) *</Label>
              <Input
                id="cat-duree"
                type="number"
                min="0"
                step="0.5"
                value={duree}
                onChange={(e) => setDuree(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-prix">Prix HT (€)</Label>
              <Input
                id="cat-prix"
                type="number"
                min="0"
                value={prix}
                onChange={(e) => setPrix(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-url">URL du programme (optionnel)</Label>
            <Input
              id="cat-url"
              type="url"
              placeholder="https://…"
              value={programmeUrl}
              onChange={(e) => setProgrammeUrl(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Vous pourrez compléter les objectifs, prérequis et autres champs
            depuis la page Catalogue.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? (
              <Spinner className="mr-2" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Créer et continuer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
