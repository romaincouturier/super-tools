import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { fetchOpenGameDevisContacts, loadGameDevisDefaults, saveGameDevisFees, saveGameDevisPrice, resolveGameDevisPrice } from "@/services/gameDevisDefaults";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";

export function useOpenGameDevisContacts() {
  return useQuery({ queryKey: ["game-devis-open-crm-contacts"], queryFn: fetchOpenGameDevisContacts });
}

export function useGameDevisDefaults() {
  const { toast } = useToast();
  const defaults = useRef<ReturnType<typeof loadGameDevisDefaults> | null>(null);
  if (defaults.current === null) {
    try { defaults.current = loadGameDevisDefaults(localStorage); }
    catch (error) {
      defaults.current = { prices: {} };
      toastError(toast, error, { title: "Les derniers montants n’ont pas pu être chargés" });
    }
  }
  const persist = (save: () => void) => {
    try { save(); }
    catch (error) { toastError(toast, error, { title: "Le montant n’a pas pu être mémorisé" }); }
  };
  return {
    defaults: defaults.current,
    price: (gameId: string, optionId: string, catalogPrice: number) => resolveGameDevisPrice(defaults.current?.prices ?? {}, gameId, optionId, catalogPrice),
    savePrice: (gameId: string, optionId: string, price: number) => persist(() => {
      saveGameDevisPrice(localStorage, gameId, optionId, price);
      if (defaults.current) defaults.current.prices[`${gameId}:${optionId}`] = price;
    }),
    saveFees: (fraisDePort: number | "", fraisDossier: number | "") => persist(() => saveGameDevisFees(localStorage, { fraisDePort, fraisDossier })),
  };
}