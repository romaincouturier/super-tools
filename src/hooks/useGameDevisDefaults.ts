import { useQuery } from "@tanstack/react-query";
import { useRef, useEffect } from "react";
import { fetchOpenGameDevisContacts, fetchSharedGameDevisDefaults, migrateLocalGameDevisDefaults, saveSharedGameDevisAmount, resolveGameDevisPrice } from "@/services/gameDevisDefaults";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";

export function useOpenGameDevisContacts() {
  return useQuery({ queryKey: ["game-devis-open-crm-contacts"], queryFn: fetchOpenGameDevisContacts });
}

export function useGameDevisDefaults() {
  const { toast } = useToast();
  const queue = useRef(Promise.resolve());
  const query = useQuery({
    queryKey: ["game-devis-defaults"],
    queryFn: async () => {
      await migrateLocalGameDevisDefaults(localStorage);
      return fetchSharedGameDevisDefaults();
    },
    staleTime: 0,
  });
  useEffect(() => {
    if (query.error) toastError(toast, query.error, { title: "Les derniers montants n’ont pas pu être chargés" });
  }, [query.error, toast]);
  const persist = (key: string, amount: number | "") => {
    if (amount === "") return;
    queue.current = queue.current.then(() => saveSharedGameDevisAmount(key, amount)).then(() => undefined).catch((error) => {
      toastError(toast, error, { title: "Le montant n’a pas pu être mémorisé" });
    });
  };
  return {
    defaults: query.data ?? { prices: {} },
    isLoading: query.isLoading,
    isError: query.isError,
    price: (gameId: string, optionId: string, catalogPrice: number) => resolveGameDevisPrice(query.data?.prices ?? {}, gameId, optionId, catalogPrice),
    savePrice: (gameId: string, optionId: string, price: number) => persist(`price:${gameId}:${optionId}`, price),
    saveFee: (key: "shipping" | "admin", amount: number | "") => persist(key, amount),
  };
}
