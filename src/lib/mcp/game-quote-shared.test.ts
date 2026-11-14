import { describe, expect, it } from 'vitest';
import { defaultShipping, gameQuoteSchema, quoteTotals, selectCatalogPrice, type GameCatalogRow, type GamePriceOptionRow } from './game-quote-shared';

const game: GameCatalogRow = {
  id: '11111111-1111-4111-8111-111111111111', title: 'ECHO', status: 'active', game_type: 'partner',
  woocommerce_product_id: 42, location_variation_id: null, current_stock: 8, stock: 8,
  shipping_fee: 12.5, weight_g: 900, proposed_price_ht: 50,
};
const option: GamePriceOptionRow = {
  id: '22222222-2222-4222-8222-222222222222', game_id: game.id, offer_type: 'vente', label: '',
  prix: 50, woocommerce_variation_id: null, display_order: 0,
};

describe('Devis jeux MCP', () => {
  it('reste en preview par défaut et normalise le pays ISO', () => {
    const parsed = gameQuoteSchema.parse({
      client: { type: 'company', company: 'CLPS', email: 'PAULINE.DELSOIR@CLPSMS.BE', billing_address: { address_1: 'Rue de la Loi 30', postcode: '7100', city: 'La Louvière', country: 'be' } },
      lines: [{ title: 'ECHO', quantity: 2 }],
    });
    expect(parsed.confirm).toBe(false);
    expect(parsed.client.email).toBe('pauline.delsoir@clpsms.be');
    expect(parsed.client.billing_address.country).toBe('BE');
  });

  it('exige un jeu et un prix unitaire strictement positif en surcharge', () => {
    const base = {
      client: { type: 'company', company: 'CLPS', email: 'pauline.delsoir@clpsms.be', billing_address: { address_1: 'Rue de la Loi 30', postcode: '7100', city: 'La Louvière', country: 'BE' } },
    };
    expect(gameQuoteSchema.safeParse({ ...base, lines: [{ quantity: 2 }] }).success).toBe(false);
    expect(gameQuoteSchema.safeParse({ ...base, lines: [{ title: 'ECHO', quantity: 2, unit_price: 0 }] }).success).toBe(false);
  });

  it('utilise le tarif vente du catalogue et calcule les montants au centime', () => {
    expect(selectCatalogPrice(game, [option]).price).toBe(50);
    expect(quoteTotals([100], 12.5, 0, 0.2)).toEqual({ subtotal_ht: 100, shipping_ht: 12.5, admin_fee_ht: 0, total_ht: 112.5, vat_rate: 0.2, total_tax: 22.5, total_ttc: 135 });
  });

  it('additionne les frais unitaires et refuse de deviner les frais absents', () => {
    expect(defaultShipping([{ quantity: 2, shipping_fee: 12.5, title: 'ECHO' }])).toEqual({ value: 25, missing: [] });
    expect(defaultShipping([{ quantity: 2, shipping_fee: null, title: 'ECHO' }])).toEqual({ value: null, missing: ['ECHO'] });
  });
});
