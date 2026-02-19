import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import PrerequisitesEditor from "@/components/formations/PrerequisitesEditor";
import ObjectivesEditor from "@/components/formations/ObjectivesEditor";
import ProgramSelector from "@/components/formations/ProgramSelector";

interface CatalogEntry {
  id: string;
  formation_name: string;
  prix: number;
  duree_heures: number;
  programme_url: string | null;
  objectives: string[] | null;
  prerequisites: string[] | null;
  supports_url: string | null;
  elearning_duration: number | null;
  elearning_access_email_content: string | null;
  supertilt_link: string | null;
  woocommerce_product_id: number | null;
  description: string | null;
  is_active: boolean;
  display_order: number;
}

interface CatalogFormDialogProps {
  open: boolean;
  onClose: (saved: boolean) => void;
  entry: CatalogEntry | null;
}

const CatalogFormDialog = ({ open, onClose, entry }: CatalogFormDialogProps) => {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formationName, setFormationName] = useState("");
  const [description, setDescription] = useState("");
  const [prix, setPrix] = useState("");
  const [dureeHeures, setDureeHeures] = useState("");
  const [programmeUrl, setProgrammeUrl] = useState("");
  const [supportsUrl, setSupportsUrl] = useState("");
  const [supertiltLink, setSupertiltLink] = useState("");
  const [objectives, setObjectives] = useState<string[]>([]);
  const [prerequisites, setPrerequisites] = useState<string[]>([]);
  const [elearningDuration, setElearningDuration] = useState("");
  const [elearningAccessEmailContent, setElearningAccessEmailContent] = useState("");
  const [woocommerceProductId, setWoocommerceProductId] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Reset form when dialog opens/entry changes
  useEffect(() => {
    if (open) {
      if (entry) {
        setFormationName(entry.formation_name);
        setDescription(entry.description || "");
        setPrix(String(entry.prix || ""));
        setDureeHeures(String(entry.duree_heures || ""));
        setProgrammeUrl(entry.programme_url || "");
        setSupportsUrl(entry.supports_url || "");
        setSupertiltLink(entry.supertilt_link || "");
        setObjectives(entry.objectives || []);
        setPrerequisites(entry.prerequisites || []);
        setElearningDuration(entry.elearning_duration ? String(entry.elearning_duration) : "");
        setElearningAccessEmailContent(entry.elearning_access_email_content || "");
        setWoocommerceProductId(entry.woocommerce_product_id ? String(entry.woocommerce_product_id) : "");
        setIsActive(entry.is_active);
      } else {
        setFormationName("");
        setDescription("");
        setPrix("");
        setDureeHeures("");
        setProgrammeUrl("");
        setSupportsUrl("");
        setSupertiltLink("");
        setObjectives([]);
        setPrerequisites([]);
        setElearningDuration("");
        setElearningAccessEmailContent("");
        setWoocommerceProductId("");
        setIsActive(true);
      }
    }
  }, [open, entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formationName.trim()) {
      toast({
        title: "Champ requis",
        description: "Le nom de la formation est obligatoire.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        formation_name: formationName.trim(),
        description: description.trim() || null,
        prix: prix ? parseFloat(prix) : 0,
        duree_heures: dureeHeures ? parseFloat(dureeHeures) : 0,
        programme_url: programmeUrl.trim() || null,
        supports_url: supportsUrl.trim() || null,
        supertilt_link: supertiltLink.trim() || null,
        objectives,
        prerequisites,
        elearning_duration: elearningDuration ? parseFloat(elearningDuration) : null,
        elearning_access_email_content: elearningAccessEmailContent.trim() || null,
        woocommerce_product_id: woocommerceProductId ? parseInt(woocommerceProductId, 10) : null,
        is_active: isActive,
      };

      if (entry) {
        // Update
        const { error } = await supabase
          .from("formation_configs")
          .update(payload)
          .eq("id", entry.id);
        if (error) throw error;
        toast({ title: "Mis à jour", description: "Formation mise à jour dans le catalogue." });
      } else {
        // Insert — get max display_order
        const { data: maxOrder } = await supabase
          .from("formation_configs")
          .select("display_order")
          .order("display_order", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { error } = await supabase
          .from("formation_configs")
          .insert({
            ...payload,
            display_order: (maxOrder?.display_order || 0) + 1,
          });
        if (error) throw error;
        toast({ title: "Créée", description: "Formation ajoutée au catalogue." });
      }

      onClose(true);
    } catch (error: any) {
      console.error("Error saving catalog entry:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose(false)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entry ? "Modifier la formation" : "Nouvelle formation au catalogue"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="formationName">Nom de la formation *</Label>
              <Input
                id="formationName"
                value={formationName}
                onChange={(e) => setFormationName(e.target.value)}
                placeholder="Ex: Facilitation Graphique"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description courte de la formation..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dureeHeures">Durée (heures)</Label>
                <Input
                  id="dureeHeures"
                  type="number"
                  min="0"
                  step="0.5"
                  value={dureeHeures}
                  onChange={(e) => setDureeHeures(e.target.value)}
                  placeholder="Ex: 14"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prix">Prix catalogue HT (€)</Label>
                <Input
                  id="prix"
                  type="number"
                  min="0"
                  step="0.01"
                  value={prix}
                  onChange={(e) => setPrix(e.target.value)}
                  placeholder="Ex: 1490"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="isActive">Formation active (visible lors de la création de sessions)</Label>
            </div>
          </div>

          {/* Content section */}
          <Accordion type="multiple" defaultValue={entry ? ["content", "elearning", "woocommerce"] : ["content"]}>
            <AccordionItem value="content">
              <AccordionTrigger>Contenu pédagogique</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Objectifs pédagogiques</Label>
                  <ObjectivesEditor
                    objectives={objectives}
                    onObjectivesChange={setObjectives}
                    programFileUrl={programmeUrl}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Prérequis</Label>
                  <PrerequisitesEditor
                    prerequisites={prerequisites}
                    onPrerequisitesChange={setPrerequisites}
                    programFileUrl={programmeUrl}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="programmeUrl">URL du programme (PDF)</Label>
                  <ProgramSelector
                    programFileUrl={programmeUrl}
                    onProgramChange={setProgrammeUrl}
                    userId=""
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supportsUrl">URL des supports pédagogiques</Label>
                  <Input
                    id="supportsUrl"
                    value={supportsUrl}
                    onChange={(e) => setSupportsUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supertiltLink">Lien SuperTilt (page produit)</Label>
                  <Input
                    id="supertiltLink"
                    value={supertiltLink}
                    onChange={(e) => setSupertiltLink(e.target.value)}
                    placeholder="https://supertilt.fr/..."
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="elearning">
              <AccordionTrigger>Configuration e-learning</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="elearningDuration">Durée du parcours e-learning (heures)</Label>
                  <Input
                    id="elearningDuration"
                    type="number"
                    min="0"
                    step="0.5"
                    value={elearningDuration}
                    onChange={(e) => setElearningDuration(e.target.value)}
                    placeholder="Ex: 25"
                  />
                  <p className="text-xs text-muted-foreground">
                    Durée estimée du parcours si la formation est dispensée en e-learning.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="elearningAccessEmail">Contenu de l'email d'accès e-learning</Label>
                  <Textarea
                    id="elearningAccessEmail"
                    rows={6}
                    value={elearningAccessEmailContent}
                    onChange={(e) => setElearningAccessEmailContent(e.target.value)}
                    placeholder="Contenu de l'email envoyé aux participants pour accéder à la formation..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Variables : {"{{first_name}}"}, {"{{training_name}}"}, {"{{access_link}}"}, {"{{start_date}}"}, {"{{end_date}}"}, {"{{coupon_code}}"}, {"{{coupon_instructions}}"}
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="woocommerce">
              <AccordionTrigger>WooCommerce</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="woocommerceProductId">ID Produit WooCommerce</Label>
                  <Input
                    id="woocommerceProductId"
                    type="number"
                    min="1"
                    value={woocommerceProductId}
                    onChange={(e) => setWoocommerceProductId(e.target.value)}
                    placeholder="Ex: 1234"
                  />
                  <p className="text-xs text-muted-foreground">
                    L'ID du produit dans votre boutique WooCommerce.
                    Visible dans l'URL d'édition du produit : post.php?post=<strong>1234</strong>.
                    Utilisé pour restreindre les coupons générés à ce produit.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                entry ? "Mettre à jour" : "Créer"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CatalogFormDialog;
