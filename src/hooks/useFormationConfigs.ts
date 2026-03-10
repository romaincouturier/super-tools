import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FormationConfig } from "@/types/formations";
import type { User } from "@supabase/supabase-js";

export function useFormationConfigs(user: User | null, initialDefaultsApplied: boolean, formationDemandee: string) {
  const [formationConfigs, setFormationConfigs] = useState<FormationConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [editingFormation, setEditingFormation] = useState<FormationConfig | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [newFormation, setNewFormation] = useState<Partial<FormationConfig> | null>(null);
  const { toast } = useToast();

  // Load formation configs from DB
  useEffect(() => {
    const loadFormationConfigs = async () => {
      try {
        const { data, error } = await supabase
          .from("formation_configs")
          .select("*")
          .order("display_order");

        if (error) throw error;

        if (data && data.length > 0) {
          const configs = data as FormationConfig[];
          setFormationConfigs(configs);
        }
      } catch (error) {
        console.error("Error loading formation configs:", error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les configurations de formations",
          variant: "destructive",
        });
      } finally {
        setLoadingConfigs(false);
      }
    };

    if (user) {
      loadFormationConfigs();
    }
  }, [user, toast, initialDefaultsApplied, formationDemandee]);

  const handleSaveFormationConfig = async () => {
    if (!editingFormation) return;

    try {
      const { error } = await supabase
        .from("formation_configs")
        .update({
          formation_name: editingFormation.formation_name,
          prix: editingFormation.prix,
          duree_heures: editingFormation.duree_heures,
          programme_url: editingFormation.programme_url,
        })
        .eq("id", editingFormation.id);

      if (error) throw error;

      setFormationConfigs(prev =>
        prev.map(f => f.id === editingFormation.id ? editingFormation : f)
      );

      toast({
        title: "Configuration sauvegardée",
        description: `Les paramètres de "${editingFormation.formation_name}" ont été mis à jour.`,
      });

      setEditingFormation(null);
    } catch (error) {
      console.error("Error saving formation config:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la configuration",
        variant: "destructive",
      });
    }
  };

  const handleAddFormation = async () => {
    if (!newFormation?.formation_name || !newFormation?.programme_url) return;

    try {
      const { data, error } = await supabase
        .from("formation_configs")
        .insert({
          formation_name: newFormation.formation_name,
          prix: newFormation.prix || 0,
          duree_heures: newFormation.duree_heures || 0,
          programme_url: newFormation.programme_url || null,
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;

      setFormationConfigs(prev => [...prev, data as FormationConfig].sort((a, b) =>
        a.formation_name.localeCompare(b.formation_name)
      ));

      toast({
        title: "Formation ajoutée",
        description: `"${newFormation.formation_name}" a été ajoutée.`,
      });

      setNewFormation(null);
    } catch (error) {
      console.error("Error adding formation:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la formation",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFormation = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from("formation_configs")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setFormationConfigs(prev => prev.filter(f => f.id !== id));

      toast({
        title: "Formation supprimée",
        description: `"${name}" a été supprimée.`,
      });
    } catch (error) {
      console.error("Error deleting formation:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la formation",
        variant: "destructive",
      });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      // Remove default from all
      await supabase
        .from("formation_configs")
        .update({ is_default: false })
        .neq("id", "");

      // Set new default
      const { error } = await supabase
        .from("formation_configs")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;

      setFormationConfigs(prev =>
        prev.map(f => ({ ...f, is_default: f.id === id }))
      );

      const formation = formationConfigs.find(f => f.id === id);
      toast({
        title: "Formation par défaut",
        description: `"${formation?.formation_name}" est maintenant la formation par défaut.`,
      });
    } catch (error) {
      console.error("Error setting default:", error);
      toast({
        title: "Erreur",
        description: "Impossible de définir la formation par défaut",
        variant: "destructive",
      });
    }
  };

  const handleMoveFormation = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formationConfigs.length) return;

    const newConfigs = [...formationConfigs];
    const temp = newConfigs[index];
    newConfigs[index] = newConfigs[newIndex];
    newConfigs[newIndex] = temp;

    // Update display_order for both items
    const updates = [
      { id: newConfigs[index].id, display_order: index },
      { id: newConfigs[newIndex].id, display_order: newIndex },
    ];

    setFormationConfigs(newConfigs);

    try {
      for (const update of updates) {
        const { error } = await supabase
          .from("formation_configs")
          .update({ display_order: update.display_order })
          .eq("id", update.id);
        if (error) throw error;
      }
    } catch (error) {
      console.error("Error reordering formations:", error);
      toast({
        title: "Erreur",
        description: "Impossible de réorganiser les formations",
        variant: "destructive",
      });
    }
  };

  return {
    formationConfigs,
    setFormationConfigs,
    loadingConfigs,
    editingFormation,
    setEditingFormation,
    configDialogOpen,
    setConfigDialogOpen,
    newFormation,
    setNewFormation,
    handleSaveFormationConfig,
    handleAddFormation,
    handleDeleteFormation,
    handleSetDefault,
    handleMoveFormation,
  };
}
