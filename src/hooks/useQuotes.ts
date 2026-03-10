/**
 * React Query hooks for the Quotes module.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchQuoteSettings,
  updateQuoteSettings,
  fetchQuotesByCard,
  fetchQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  lookupSiren,
} from "@/services/quotes";
import type {
  CreateQuoteInput,
  UpdateQuoteInput,
  UpdateQuoteSettingsInput,
} from "@/types/quotes";

// ── Settings ──────────────────────────────────────────────────────

export function useQuoteSettings() {
  return useQuery({
    queryKey: ["quote-settings"],
    queryFn: fetchQuoteSettings,
  });
}

export function useUpdateQuoteSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: UpdateQuoteSettingsInput) =>
      updateQuoteSettings(updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote-settings"] });
    },
  });
}

// ── Quotes ────────────────────────────────────────────────────────

export function useQuotesByCard(cardId: string | undefined) {
  return useQuery({
    queryKey: ["quotes", "card", cardId],
    queryFn: () => fetchQuotesByCard(cardId!),
    enabled: !!cardId,
  });
}

export function useQuote(quoteId: string | undefined) {
  return useQuery({
    queryKey: ["quotes", quoteId],
    queryFn: () => fetchQuote(quoteId!),
    enabled: !!quoteId,
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuoteInput) => createQuote(input),
    onSuccess: (quote) => {
      qc.invalidateQueries({ queryKey: ["quotes", "card", quote.crm_card_id] });
      qc.invalidateQueries({ queryKey: ["quote-settings"] });
    },
  });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateQuoteInput }) =>
      updateQuote(id, updates),
    onSuccess: (quote) => {
      qc.invalidateQueries({ queryKey: ["quotes", quote.id] });
      qc.invalidateQueries({ queryKey: ["quotes", "card", quote.crm_card_id] });
    },
  });
}

export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteQuote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}

// ── SIREN lookup ──────────────────────────────────────────────────

export function useSirenLookup() {
  return useMutation({
    mutationFn: lookupSiren,
  });
}
