import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { DevisHistoryItem } from "@/types/formations";

export function useDevisHistory() {
  const [devisHistory, setDevisHistory] = useState<DevisHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const { toast } = useToast();

  const loadDevisHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, created_at, recipient_email, details")
        .eq("action_type", "micro_devis_sent")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      setDevisHistory((data || []) as unknown as DevisHistoryItem[]);
    } catch (error) {
      console.error("Error loading devis history:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'historique des devis",
        variant: "destructive",
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (historyDialogOpen) {
      loadDevisHistory();
    }
  }, [historyDialogOpen]);

  const filteredHistory = devisHistory.filter((item) => {
    const searchLower = historySearch.toLowerCase();
    return (
      item.recipient_email?.toLowerCase().includes(searchLower) ||
      item.details?.formation_name?.toLowerCase().includes(searchLower) ||
      item.details?.client_name?.toLowerCase().includes(searchLower)
    );
  });

  const handleDeleteDevis = async (item: DevisHistoryItem) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce devis de l'historique ?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("activity_logs")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      setDevisHistory(prev => prev.filter(d => d.id !== item.id));

      toast({
        title: "Devis supprimé",
        description: "Le devis a été supprimé de l'historique.",
      });
    } catch (error) {
      console.error("Error deleting devis:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le devis.",
        variant: "destructive",
      });
    }
  };

  return {
    devisHistory,
    loadingHistory,
    historySearch,
    setHistorySearch,
    historyDialogOpen,
    setHistoryDialogOpen,
    filteredHistory,
    handleDeleteDevis,
  };
}
