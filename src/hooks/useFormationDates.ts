import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FormationDate } from "@/types/formations";
import type { User } from "@supabase/supabase-js";
import { format, parseISO, isSameMonth, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Format start/end dates into a French label suitable for the micro-devis.
 * Examples:
 *  - "le 15 juin 2026"            (single day)
 *  - "15 et 16 juin 2026"          (same month)
 *  - "du 30 juin au 2 juillet 2026" (cross-month)
 */
function formatSessionLabel(startISO: string, endISO: string): string {
  const start = parseISO(startISO);
  const end = parseISO(endISO);

  if (isSameDay(start, end)) {
    return `le ${format(start, "d MMMM yyyy", { locale: fr })}`;
  }

  if (isSameMonth(start, end)) {
    // Same month: "15 et 16 juin 2026" (explicit list if 2 days, range otherwise)
    const dayDiff = end.getDate() - start.getDate();
    if (dayDiff === 1) {
      return `${start.getDate()} et ${end.getDate()} ${format(end, "MMMM yyyy", { locale: fr })}`;
    }
    return `du ${start.getDate()} au ${end.getDate()} ${format(end, "MMMM yyyy", { locale: fr })}`;
  }

  // Cross-month
  return `du ${format(start, "d MMMM", { locale: fr })} au ${format(end, "d MMMM yyyy", { locale: fr })}`;
}

export function useFormationDates(user: User | null, _initialDefaultsApplied: boolean, _dateFormation: string) {
  const [formationDates, setFormationDates] = useState<FormationDate[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);
  // Kept for backward compatibility with FormationDatesSection props,
  // but the dates now come from upcoming inter sessions and are not editable here.
  const [editingDate, setEditingDate] = useState<FormationDate | null>(null);
  const [datesDialogOpen, setDatesDialogOpen] = useState(false);
  const [newDate, setNewDate] = useState<Partial<FormationDate> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadFormationDates = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        // Upcoming inter sessions across all formats (présentiel, classe virtuelle, e-learning), soonest first, excluding past ones.
        const { data, error } = await supabase
          .from("trainings")
          .select("id, training_name, start_date, end_date, format_formation, session_type")
          .eq("session_type", "inter")
          .in("format_formation", ["inter-entreprises", "classe_virtuelle", "e_learning"])
          .gte("end_date", today)
          .order("start_date", { ascending: true });

        if (error) throw error;

        const rows: FormationDate[] = (data || [])
          .filter((t) => t.start_date && t.end_date)
          .map((t, idx) => ({
            id: t.id,
            date_label: formatSessionLabel(t.start_date as string, t.end_date as string),
            is_default: idx === 0,
          }));

        setFormationDates(rows);
      } catch (error) {
        console.error("Error loading formation dates:", error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les prochaines sessions inter",
          variant: "destructive",
        });
      } finally {
        setLoadingDates(false);
      }
    };

    if (user) loadFormationDates();
  }, [user, toast]);

  // Management handlers are no-ops: dates are derived from training sessions.
  const notManageable = async () => {
    toast({
      title: "Gestion non disponible",
      description:
        "Les dates proviennent des prochaines sessions inter-entreprises programmées.",
    });
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
    handleAddDate: notManageable,
    handleSetDefaultDate: notManageable,
    handleDeleteDate: notManageable,
    handleSaveDate: notManageable,
  };
}
