import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FormationDate } from "@/types/formations";
import type { User } from "@supabase/supabase-js";

export function useFormationDates(user: User | null, initialDefaultsApplied: boolean, dateFormation: string) {
  const [formationDates, setFormationDates] = useState<FormationDate[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);
  const [editingDate, setEditingDate] = useState<FormationDate | null>(null);
  const [datesDialogOpen, setDatesDialogOpen] = useState(false);
  const [newDate, setNewDate] = useState<Partial<FormationDate> | null>(null);
  const { toast } = useToast();

  // Load formation dates from DB
  useEffect(() => {
    const loadFormationDates = async () => {
      try {
        const { data, error } = await supabase
          .from("formation_dates")
          .select("*")
          .order("created_at", { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          setFormationDates(data as FormationDate[]);
        }
      } catch (error) {
        console.error("Error loading formation dates:", error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les dates de formations",
          variant: "destructive",
        });
      } finally {
        setLoadingDates(false);
      }
    };

    if (user) {
      loadFormationDates();
    }
  }, [user, toast, initialDefaultsApplied, dateFormation]);

  const handleAddDate = async () => {
    if (!newDate?.date_label) return;
    try {
      const { data, error } = await supabase
        .from("formation_dates")
        .insert({
          date_label: newDate.date_label,
          is_default: false,
        })
        .select()
        .single();
      if (error) throw error;
      setFormationDates(prev => [...prev, data as FormationDate]);
      toast({
        title: "Date ajoutée",
        description: `"${newDate.date_label}" a été ajoutée.`,
      });
      setNewDate(null);
    } catch (error) {
      console.error("Error adding date:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la date",
        variant: "destructive",
      });
    }
  };

  const handleSetDefaultDate = async (dateConfig: FormationDate) => {
    try {
      await supabase
        .from("formation_dates")
        .update({ is_default: false })
        .neq("id", "");
      const { error } = await supabase
        .from("formation_dates")
        .update({ is_default: true })
        .eq("id", dateConfig.id);
      if (error) throw error;
      setFormationDates(prev =>
        prev.map(d => ({ ...d, is_default: d.id === dateConfig.id }))
      );
      toast({
        title: "Date par défaut",
        description: `"${dateConfig.date_label}" est maintenant la date par défaut.`,
      });
    } catch (error) {
      console.error("Error setting default:", error);
      toast({
        title: "Erreur",
        description: "Impossible de définir la date par défaut",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDate = async (dateConfig: FormationDate) => {
    try {
      const { error } = await supabase
        .from("formation_dates")
        .delete()
        .eq("id", dateConfig.id);
      if (error) throw error;
      setFormationDates(prev => prev.filter(d => d.id !== dateConfig.id));
      toast({
        title: "Date supprimée",
        description: `"${dateConfig.date_label}" a été supprimée.`,
      });
    } catch (error) {
      console.error("Error deleting date:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la date",
        variant: "destructive",
      });
    }
  };

  const handleSaveDate = async () => {
    if (!editingDate) return;
    try {
      const { error } = await supabase
        .from("formation_dates")
        .update({ date_label: editingDate.date_label })
        .eq("id", editingDate.id);
      if (error) throw error;
      setFormationDates(prev =>
        prev.map(d => d.id === editingDate.id ? editingDate : d)
      );
      toast({
        title: "Date sauvegardée",
        description: `Les modifications ont été enregistrées.`,
      });
      setEditingDate(null);
    } catch (error) {
      console.error("Error saving date:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la date",
        variant: "destructive",
      });
    }
  };

  return {
    formationDates,
    setFormationDates,
    loadingDates,
    editingDate,
    setEditingDate,
    datesDialogOpen,
    setDatesDialogOpen,
    newDate,
    setNewDate,
    handleAddDate,
    handleSetDefaultDate,
    handleDeleteDate,
    handleSaveDate,
  };
}
