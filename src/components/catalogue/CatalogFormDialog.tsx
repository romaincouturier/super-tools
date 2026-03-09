import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp, Check } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import PrerequisitesEditor from "@/components/formations/PrerequisitesEditor";
import ObjectivesEditor from "@/components/formations/ObjectivesEditor";
import ProgramSelector from "@/components/formations/ProgramSelector";
import type { FormationFormula } from "@/types/training";

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

interface FormulaEdit {
  id?: string;
  name: string;
  duree_heures: string;
  prix: string;
  elearning_access_email_content: string;
  woocommerce_product_id: string;
  learndash_course_id: string;
  supports_url: string;
  coaching_sessions_count: string;
  _deleted?: boolean;
}

interface CatalogFormDialogProps {
  open: boolean;
  onClose: (saved: boolean) => void;
  entry: CatalogEntry | null;
  onDelete?: (id: string) => void;
  trainingCount?: number;
}

const CatalogFormDialog = ({ open, onClose, entry, onDelete, trainingCount = 0 }: CatalogFormDialogProps) => {
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formationName, setFormationName] = useState("");
  const [description, setDescription] = useState("");
  const [prix, setPrix] = useState("");
  const [dureeHeures, setDureeHeures] = useState("");
  const [programmeUrl, setProgrammeUrl] = useState("");
  const [supportsUrl, setSupportsUrl] = useState("");
  const [supertiltLink, setSupertiltLink] = useState("");
  const [requiredEquipment, setRequiredEquipment] = useState("");
  const [objectives, setObjectives] = useState<string[]>([]);
  const [prerequisites, setPrerequisites] = useState<string[]>([]);
  const [elearningDuration, setElearningDuration] = useState("");
  const [elearningAccessEmailContent, setElearningAccessEmailContent] = useState("");
  const [woocommerceProductId, setWoocommerceProductId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formulas, setFormulas] = useState<FormulaEdit[]>([]);
  const [expandedFormula, setExpandedFormula] = useState<number | null>(null);

  // Auto-save refs
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedHashRef = useRef("");
  const skipNextAutoSave = useRef(0);
  const formValuesRef = useRef<Record<string, unknown>>({});

  const formulaFromDb = (f: FormationFormula): FormulaEdit => ({
    id: f.id,
    name: f.name,
    duree_heures: f.duree_heures != null ? String(f.duree_heures) : "",
    prix: f.prix != null ? String(f.prix) : "",
    elearning_access_email_content: f.elearning_access_email_content || "",
    woocommerce_product_id: f.woocommerce_product_id != null ? String(f.woocommerce_product_id) : "",
    learndash_course_id: f.learndash_course_id != null ? String(f.learndash_course_id) : "",
    supports_url: f.supports_url || "",
    coaching_sessions_count: f.coaching_sessions_count ? String(f.coaching_sessions_count) : "0",
  });

  // Always keep latest values in ref
  formValuesRef.current = {
    formationName, description, prix, dureeHeures, programmeUrl, supportsUrl,
    supertiltLink, objectives, prerequisites, elearningDuration,
    elearningAccessEmailContent, woocommerceProductId, isActive,
    formulas,
  };

  // Form state hash for change detection
  const activeFormulas = formulas.filter((f) => !f._deleted);
  const formHash = JSON.stringify({
    formationName, description, prix, dureeHeures, programmeUrl, supportsUrl,
    supertiltLink, objectives, prerequisites, elearningDuration,
    elearningAccessEmailContent, woocommerceProductId, isActive,
    fml: activeFormulas.map(f => `${f.id || ""}|${f.name}|${f.duree_heures}|${f.prix}|${f.woocommerce_product_id}|${f.learndash_course_id}|${f.supports_url}|${f.elearning_access_email_content}`),
  });

  // Shared save logic (used by both auto-save and manual create)
  const doSave = async (entryId: string) => {
    const v = formValuesRef.current as {
      formationName: string; description: string; prix: string; dureeHeures: string;
      programmeUrl: string; supportsUrl: string; supertiltLink: string;
      objectives: string[]; prerequisites: string[]; elearningDuration: string;
      elearningAccessEmailContent: string; woocommerceProductId: string;
      isActive: boolean; formulas: FormulaEdit[];
    };

    if (!v.formationName.trim()) return;

    const payload = {
      formation_name: v.formationName.trim(),
      description: v.description.trim() || null,
      prix: v.prix ? parseFloat(v.prix) : 0,
      duree_heures: v.dureeHeures ? parseFloat(v.dureeHeures) : 0,
      programme_url: v.programmeUrl.trim() || null,
      supports_url: v.supportsUrl.trim() || null,
      supertilt_link: v.supertiltLink.trim() || null,
      objectives: v.objectives,
      prerequisites: v.prerequisites,
      elearning_duration: v.elearningDuration ? parseFloat(v.elearningDuration) : null,
      elearning_access_email_content: v.elearningAccessEmailContent.trim() || null,
      woocommerce_product_id: v.woocommerceProductId ? parseInt(v.woocommerceProductId, 10) : null,
      is_active: v.isActive,
    };

    const { error } = await supabase
      .from("formation_configs")
      .update(payload)
      .eq("id", entryId);
    if (error) throw error;

    // Save formulas
    const allFormulas = v.formulas;
    const active = allFormulas.filter((f) => !f._deleted);
    const deletedIds = allFormulas.filter((f) => f._deleted && f.id).map((f) => f.id!);

    if (deletedIds.length > 0) {
      await supabase.from("formation_formulas").delete().in("id", deletedIds);
    }

    for (let i = 0; i < active.length; i++) {
      const f = active[i];
      if (!f.name.trim()) continue;

      const formulaPayload = {
        formation_config_id: entryId,
        name: f.name.trim(),
        duree_heures: f.duree_heures ? parseFloat(f.duree_heures) : null,
        prix: f.prix ? parseFloat(f.prix) : null,
        elearning_access_email_content: f.elearning_access_email_content.trim() || null,
        woocommerce_product_id: f.woocommerce_product_id ? parseInt(f.woocommerce_product_id, 10) : null,
        learndash_course_id: f.learndash_course_id ? parseInt(f.learndash_course_id, 10) : null,
        supports_url: f.supports_url.trim() || null,
        coaching_sessions_count: f.coaching_sessions_count ? parseInt(f.coaching_sessions_count, 10) : 0,
        display_order: i,
      };

      if (f.id) {
        await supabase.from("formation_formulas").update(formulaPayload).eq("id", f.id);
      } else {
        await supabase.from("formation_formulas").insert(formulaPayload);
      }
    }

    // Reload formulas to get proper IDs and clean up deleted ones
    const { data: freshFormulas } = await supabase
      .from("formation_formulas")
      .select("*")
      .eq("formation_config_id", entryId)
      .order("display_order");

    if (freshFormulas) {
      skipNextAutoSave.current++;
      setFormulas(freshFormulas.map(formulaFromDb));
    }
  };

  // Auto-save effect (edit mode only)
  useEffect(() => {
    if (!entry || !open) return;

    if (skipNextAutoSave.current > 0) {
      skipNextAutoSave.current--;
      lastSavedHashRef.current = formHash;
      return;
    }

    // Skip if nothing changed since last save (or initial load)
    if (formHash === lastSavedHashRef.current) return;

    // If lastSavedHashRef is empty, this is the initial load - just record state
    if (!lastSavedHashRef.current) {
      lastSavedHashRef.current = formHash;
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      setAutoSaving(true);
      try {
        await doSave(entry.id);
        lastSavedHashRef.current = formHash;
        setLastSaved(new Date());
      } catch (error) {
        console.error("Auto-save error:", error);
      } finally {
        setAutoSaving(false);
      }
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formHash, entry, open]);

  // Reset form when dialog opens/entry changes
  useEffect(() => {
    if (open) {
      lastSavedHashRef.current = "";
      skipNextAutoSave.current = 0;
      setLastSaved(null);
      setAutoSaving(false);

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
        // Load formulas from DB
        supabase
          .from("formation_formulas")
          .select("*")
          .eq("formation_config_id", entry.id)
          .order("display_order")
          .then(({ data }) => {
            setFormulas((data || []).map(formulaFromDb));
            // Skip the auto-save triggered by formula load
            skipNextAutoSave.current++;
          });
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
        setFormulas([]);
      }
      setExpandedFormula(null);
    }
  }, [open, entry]);

  // Flush pending auto-save and close
  const handleClose = (saved: boolean) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      // Fire save immediately if there are pending changes
      if (entry && formHash !== lastSavedHashRef.current) {
        doSave(entry.id).catch(console.error);
      }
    }
    onClose(saved);
  };

  // Create new entry (manual submit for create mode only)
  const handleCreate = async (e: React.FormEvent) => {
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

      // Insert — get max display_order
      const { data: maxOrder } = await supabase
        .from("formation_configs")
        .select("display_order")
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: inserted, error } = await supabase
        .from("formation_configs")
        .insert({
          ...payload,
          display_order: (maxOrder?.display_order || 0) + 1,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Save formulas for new entry
      const active = formulas.filter((f) => !f._deleted);
      for (let i = 0; i < active.length; i++) {
        const f = active[i];
        if (!f.name.trim()) continue;
        await supabase.from("formation_formulas").insert({
          formation_config_id: inserted.id,
          name: f.name.trim(),
          duree_heures: f.duree_heures ? parseFloat(f.duree_heures) : null,
          prix: f.prix ? parseFloat(f.prix) : null,
          elearning_access_email_content: f.elearning_access_email_content.trim() || null,
          woocommerce_product_id: f.woocommerce_product_id ? parseInt(f.woocommerce_product_id, 10) : null,
          learndash_course_id: f.learndash_course_id ? parseInt(f.learndash_course_id, 10) : null,
          supports_url: f.supports_url.trim() || null,
          display_order: i,
        });
      }

      toast({
        title: "Créée",
        description: "Formation ajoutée au catalogue.",
      });

      onClose(true);
    } catch (error: any) {
      console.error("Error creating catalog entry:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasFormulas = formulas.filter((f) => !f._deleted).length > 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose(!!entry)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {entry ? "Modifier la formation" : "Nouvelle formation au catalogue"}
          </DialogTitle>
          {entry && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              {autoSaving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Enregistrement...
                </>
              ) : lastSaved ? (
                <>
                  <Check className="h-3 w-3 text-green-600" />
                  Sauvegardé
                </>
              ) : null}
            </div>
          )}
        </DialogHeader>

        <form onSubmit={entry ? (e) => e.preventDefault() : handleCreate} className="space-y-6">
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

            {/* Intra-entreprise: duration + price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dureeHeures">Durée intra (heures)</Label>
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
                <Label htmlFor="prix">Prix intra HT (€)</Label>
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

            {/* Inter-entreprise formulas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Formules inter-entreprise</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    // Prevent immediate auto-save from removing a newly added (still empty) formula
                    skipNextAutoSave.current++;
                    const nextVisibleIdx = formulas.filter((f) => !f._deleted).length;
                    setFormulas((prev) => [
                      ...prev,
                      {
                        name: "",
                        duree_heures: "",
                        prix: "",
                        elearning_access_email_content: "",
                        woocommerce_product_id: "",
                        learndash_course_id: "",
                        supports_url: "",
                        coaching_sessions_count: "0",
                      },
                    ]);
                    setExpandedFormula(nextVisibleIdx);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter une formule
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Chaque formule inter-entreprise a son propre tarif, durée, etc.
              </p>
              {hasFormulas && (
                <div className="space-y-2 pt-1">
                  {formulas.map((formula, idx) => {
                    if (formula._deleted) return null;
                    const visibleIdx = formulas.slice(0, idx).filter((f) => !f._deleted).length;
                    const isExpanded = expandedFormula === visibleIdx;
                    return (
                      <div key={idx} className="border rounded-lg">
                        <div
                          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedFormula(isExpanded ? null : visibleIdx)}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
                            <span className="text-sm font-medium truncate">
                              {formula.name || "Nouvelle formule"}
                            </span>
                            {(formula.prix || formula.duree_heures) && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {formula.prix ? `${formula.prix}€` : ""}{formula.prix && formula.duree_heures ? " · " : ""}{formula.duree_heures ? `${formula.duree_heures}h` : ""}
                              </span>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormulas((prev) =>
                                prev.map((f, i) => (i === idx ? { ...f, _deleted: true } : f))
                              );
                              if (isExpanded) setExpandedFormula(null);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-3 border-t pt-3" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                            <div className="space-y-1">
                              <Label className="text-xs">Nom *</Label>
                              <Input
                                value={formula.name}
                                onChange={(e) =>
                                  setFormulas((prev) =>
                                    prev.map((f, i) => (i === idx ? { ...f, name: e.target.value } : f))
                                  )
                                }
                                placeholder="Ex: Solo, Communauté, Coachée..."
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Durée (heures)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={formula.duree_heures}
                                  onChange={(e) =>
                                    setFormulas((prev) =>
                                      prev.map((f, i) => (i === idx ? { ...f, duree_heures: e.target.value } : f))
                                    )
                                  }
                                  placeholder="Ex: 25"
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Tarif HT (€)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={formula.prix}
                                  onChange={(e) =>
                                    setFormulas((prev) =>
                                      prev.map((f, i) => (i === idx ? { ...f, prix: e.target.value } : f))
                                    )
                                  }
                                  placeholder="Ex: 490"
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">ID Produit WooCommerce</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={formula.woocommerce_product_id}
                                  onChange={(e) =>
                                    setFormulas((prev) =>
                                      prev.map((f, i) => (i === idx ? { ...f, woocommerce_product_id: e.target.value } : f))
                                    )
                                  }
                                  placeholder="Ex: 1234"
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">ID Cours LearnDash</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={formula.learndash_course_id}
                                  onChange={(e) =>
                                    setFormulas((prev) =>
                                      prev.map((f, i) => (i === idx ? { ...f, learndash_course_id: e.target.value } : f))
                                    )
                                  }
                                  placeholder="Ex: 5678"
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">URL des supports</Label>
                                <Input
                                  value={formula.supports_url}
                                  onChange={(e) =>
                                    setFormulas((prev) =>
                                      prev.map((f, i) => (i === idx ? { ...f, supports_url: e.target.value } : f))
                                    )
                                  }
                                  placeholder="https://..."
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Séances de coaching individuel incluses</Label>
                              <Input
                                type="number"
                                min="0"
                                value={formula.coaching_sessions_count}
                                onChange={(e) =>
                                  setFormulas((prev) =>
                                    prev.map((f, i) => (i === idx ? { ...f, coaching_sessions_count: e.target.value } : f))
                                  )
                                }
                                placeholder="0"
                                className="h-8 text-sm"
                              />
                              <p className="text-xs text-muted-foreground">
                                Nombre de séances de coaching individuel incluses dans cette formule (0 = pas de coaching)
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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

                {!hasFormulas && (
                  <div className="space-y-2">
                    <Label htmlFor="supportsUrl">URL des supports pédagogiques (intra)</Label>
                    <Input
                      id="supportsUrl"
                      value={supportsUrl}
                      onChange={(e) => setSupportsUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                )}

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

            {!hasFormulas && (
              <>
                <AccordionItem value="elearning">
                  <AccordionTrigger>Configuration e-learning (intra)</AccordionTrigger>
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
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Le contenu de l'email d'accès e-learning est géré dans <strong>Paramètres → Templates Email</strong> (template elearning_access_tu / elearning_access_vous).
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="woocommerce">
                  <AccordionTrigger>WooCommerce (intra)</AccordionTrigger>
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
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </>
            )}
          </Accordion>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t">
            {entry && onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={trainingCount > 0}
                title={trainingCount > 0 ? "Impossible de supprimer : des sessions existent" : "Supprimer cette formation"}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Supprimer
              </Button>
            )}
            <div className="flex-1" />
            {entry ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(true)}
              >
                Fermer
              </Button>
            ) : (
              <>
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
                    "Créer"
                  )}
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette formation du catalogue ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La formation sera retirée du catalogue.
              Les sessions existantes ne seront pas affectées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (entry && onDelete) onDelete(entry.id);
                setDeleteConfirmOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default CatalogFormDialog;
