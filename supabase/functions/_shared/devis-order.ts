/**
 * Règles pures des commandes internes issues d'un devis de jeux.
 * Partagées par create-devis-order et testées sans réseau.
 */

export type GameTypeForOrder = "supertilt" | "dropshipping" | "location" | "partner" | string;

/** Même règle de colonne kanban que supertilt-webhook. */
export function kanbanStatusForGameType(gameType: GameTypeForOrder | null | undefined): string {
  if (gameType === "supertilt") return "to_ship";
  if (gameType === "dropshipping") return "dropshipping";
  if (gameType === "location") return "location_pending";
  return "received";
}

export interface DevisOrderLineInput {
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
}

/** Total HT d'une ligne, remise en pourcentage appliquée, arrondi au centime. */
export function devisLineTotal({ quantity, unitPrice, discountPercent = 0 }: DevisOrderLineInput): number {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantité invalide");
  if (!(unitPrice >= 0)) throw new Error("Prix unitaire invalide");
  if (!(discountPercent >= 0 && discountPercent <= 100)) throw new Error("Remise invalide");
  return +(quantity * unitPrice * (1 - discountPercent / 100)).toFixed(2);
}

export interface DevisOrderTotals {
  totalHt: number;
  totalTax: number;
  totalTtc: number;
}

export function devisOrderTotals(lineTotals: number[], shippingHt: number, adminFeeHt: number, vatRate: number): DevisOrderTotals {
  const totalHt = +(lineTotals.reduce((s, v) => s + v, 0) + (shippingHt || 0) + (adminFeeHt || 0)).toFixed(2);
  const totalTax = +(totalHt * vatRate).toFixed(2);
  return { totalHt, totalTax, totalTtc: +(totalHt + totalTax).toFixed(2) };
}

export interface RoyaltyGame {
  commission_type: string | null;
  commission_rate: number | null;
  commission_fixed: number | null;
}

/** Même calcul de royalties que supertilt-webhook (base HT). */
export function devisRoyalty(game: RoyaltyGame, lineHt: number, quantity: number): number {
  if (game.commission_type === "percentage" && game.commission_rate) {
    return +(lineHt * Number(game.commission_rate)).toFixed(2);
  }
  if (game.commission_type === "fixed" && game.commission_fixed) {
    return +(Number(game.commission_fixed) * quantity).toFixed(2);
  }
  return 0;
}

/** Clé game_sales d'une ligne de commande issue d'un devis (préfixe distinct des n° WooCommerce). */
export function devisSaleKey(orderNumber: string, lineIndex: number): string {
  return `${orderNumber}-L${lineIndex + 1}`;
}

/** Une commande issue d'un devis ne s'annule que si aucune ligne n'est partie. */
export function canCancelDevisOrder(items: Array<{ shipped_confirmed_at: string | null; hand_delivered_at: string | null; contrat_reference?: string | null }>): boolean {
  return items.every((i) => !i.shipped_confirmed_at && !i.hand_delivered_at && !i.contrat_reference);
}
