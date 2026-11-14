import { z } from 'zod';

const country = z.string().trim().regex(/^[A-Za-z]{2}$/, 'ISO 2-letter country code required').transform((v) => v.toUpperCase());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Invalid date');

export const quoteAddressSchema = z.object({
  address_1: z.string().trim().min(1).max(300),
  address_2: z.string().trim().max(300).optional(),
  postcode: z.string().trim().min(1).max(20),
  city: z.string().trim().min(1).max(120),
  country,
  phone: z.string().trim().max(50).optional(),
});

export const quoteClientSchema = z.object({
  type: z.enum(['company', 'individual']),
  company: z.string().trim().max(255).optional(),
  first_name: z.string().trim().max(120).optional(),
  last_name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(320).transform((v) => v.toLowerCase()),
  billing_address: quoteAddressSchema,
  shipping_address: quoteAddressSchema.optional(),
  vat_number: z.string().trim().max(50).optional(),
}).superRefine((client, ctx) => {
  if (client.type === 'company' && !client.company) ctx.addIssue({ code: 'custom', message: 'company is required for a company client' });
  if (client.type === 'individual' && (!client.first_name || !client.last_name)) {
    ctx.addIssue({ code: 'custom', message: 'first_name and last_name are required for an individual client' });
  }
});

export const quoteLineSchema = z.object({
  game_id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(255).optional(),
  quantity: z.number().int().min(1).max(1000),
  unit_price: z.number().positive().max(10_000_000).optional().describe('Unit price HT override; catalog price is used when omitted'),
  price_option_id: z.string().uuid().optional().describe('Catalog sale/rental price option; required when several options are ambiguous'),
}).refine((line) => line.game_id || line.title, { message: 'game_id or title is required' });

export const gameQuoteFields = {
  confirm: z.boolean().default(false).describe('false returns a read-only preview; true creates the draft quote'),
  client: quoteClientSchema,
  lines: z.array(quoteLineSchema).min(1).max(50),
  shipping_fee: z.number().min(0).max(1_000_000).optional().describe('Shipping HT override; otherwise sums catalog shipping_fee per game unit'),
  admin_fee: z.number().min(0).max(1_000_000).default(0),
  crm_card_id: z.string().uuid().optional(),
  valid_until: isoDate.optional(),
  note: z.string().max(10_000).default(''),
};

export const gameQuoteSchema = z.object(gameQuoteFields);
export type GameQuoteInput = z.infer<typeof gameQuoteSchema>;

export interface GameCatalogRow {
  id: string;
  title: string;
  status: string;
  game_type: string;
  woocommerce_product_id: number | null;
  location_variation_id: number | null;
  current_stock: number | null;
  stock: number | null;
  shipping_fee: number | string | null;
  weight_g: number | null;
  proposed_price_ht: number | string | null;
}

export interface GamePriceOptionRow {
  id: string;
  game_id: string;
  offer_type: 'location' | 'vente';
  label: string;
  prix: number | string;
  woocommerce_variation_id: number | null;
  display_order: number;
}

export const GAME_CATALOG_FIELDS = 'id,title,status,game_type,woocommerce_product_id,location_variation_id,current_stock,stock,shipping_fee,weight_g,proposed_price_ht';
export const GAME_PRICE_FIELDS = 'id,game_id,offer_type,label,prix,woocommerce_variation_id,display_order';

export function normalizeGameTitle(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function resolveGame(games: GameCatalogRow[], input: { game_id?: string; title?: string }) {
  if (input.game_id) {
    const game = games.find((g) => g.id === input.game_id && g.status === 'active');
    if (!game) throw new Error(`Active game not found: ${input.game_id}`);
    return game;
  }
  const needle = normalizeGameTitle(input.title ?? '');
  const exact = games.filter((g) => g.status === 'active' && normalizeGameTitle(g.title) === needle);
  const matches = exact.length ? exact : games.filter((g) => {
    const title = normalizeGameTitle(g.title);
    return g.status === 'active' && (title.includes(needle) || needle.includes(title));
  });
  if (matches.length !== 1) throw new Error(matches.length ? `Ambiguous game title: ${input.title}` : `Active game not found: ${input.title}`);
  return matches[0];
}

export function priceOptionLabel(option: Pick<GamePriceOptionRow, 'offer_type' | 'label'>) {
  const base = option.offer_type === 'location' ? 'Location' : 'Vente';
  return option.label?.trim() ? `${base} — ${option.label.trim()}` : base;
}

export function selectCatalogPrice(game: GameCatalogRow, options: GamePriceOptionRow[], priceOptionId?: string) {
  const owned = options.filter((o) => o.game_id === game.id);
  if (priceOptionId) {
    const selected = owned.find((o) => o.id === priceOptionId);
    if (!selected) throw new Error(`Price option ${priceOptionId} does not belong to ${game.title}`);
    return { option: selected, price: Number(selected.prix), ambiguous: false };
  }
  const sales = owned.filter((o) => o.offer_type === 'vente');
  const selected = owned.length === 1 ? owned[0] : sales.length === 1 ? sales[0] : null;
  if (selected) return { option: selected, price: Number(selected.prix), ambiguous: false };
  return { option: null, price: game.proposed_price_ht == null ? null : Number(game.proposed_price_ht), ambiguous: owned.length > 0 };
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function quoteTotals(lineTotals: number[], shippingHt: number, adminFeeHt: number, vatRate: number) {
  const subtotalHt = roundMoney(lineTotals.reduce((sum, value) => sum + value, 0));
  const totalHt = roundMoney(subtotalHt + shippingHt + adminFeeHt);
  const totalTax = roundMoney(totalHt * vatRate);
  return {
    subtotal_ht: subtotalHt,
    shipping_ht: roundMoney(shippingHt),
    admin_fee_ht: roundMoney(adminFeeHt),
    total_ht: totalHt,
    vat_rate: vatRate,
    total_tax: totalTax,
    total_ttc: roundMoney(totalHt + totalTax),
  };
}

export function defaultShipping(lines: Array<{ quantity: number; shipping_fee: number | string | null; title: string }>) {
  const missing = lines.filter((line) => line.shipping_fee == null).map((line) => line.title);
  if (missing.length) return { value: null, missing };
  return {
    value: roundMoney(lines.reduce((sum, line) => sum + Number(line.shipping_fee) * line.quantity, 0)),
    missing,
  };
}

type Db = any;

export async function prepareGameQuote(db: Db, input: GameQuoteInput) {
  const [gamesResult, settingsResult, cardResult] = await Promise.all([
    db.from('games').select(GAME_CATALOG_FIELDS).order('title'),
    db.from('supertilt_settings').select('value').eq('key', 'vat_rate').maybeSingle(),
    input.crm_card_id
      ? db.from('crm_cards').select('id,title,company').eq('id', input.crm_card_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (gamesResult.error) throw gamesResult.error;
  if (settingsResult.error) throw settingsResult.error;
  if (cardResult.error) throw cardResult.error;

  const issues: string[] = [];
  if (input.crm_card_id && !cardResult.data) issues.push(`CRM card not found: ${input.crm_card_id}`);
  const games = (gamesResult.data ?? []) as GameCatalogRow[];
  const resolvedGames = input.lines.map((line) => resolveGame(games, line));
  const { data: optionRows, error: optionsError } = await db.from('game_price_options')
    .select(GAME_PRICE_FIELDS)
    .in('game_id', [...new Set(resolvedGames.map((game) => game.id))])
    .order('display_order');
  if (optionsError) throw optionsError;
  const options = (optionRows ?? []) as GamePriceOptionRow[];

  const lines = input.lines.map((line, index) => {
    const game = resolvedGames[index];
    const catalog = selectCatalogPrice(game, options, line.price_option_id);
    const unitPrice = line.unit_price ?? catalog.price;
    if (unitPrice == null || !(unitPrice > 0)) {
      issues.push(catalog.ambiguous && line.unit_price == null
        ? `${game.title}: several catalog prices; provide price_option_id or unit_price`
        : `${game.title}: no catalog price; provide unit_price`);
    }
    const title = catalog.option ? `${game.title} — ${priceOptionLabel(catalog.option)}` : game.title;
    const lineTotal = unitPrice == null ? null : roundMoney(unitPrice * line.quantity);
    return {
      game,
      title,
      quantity: line.quantity,
      unit_price: unitPrice,
      catalog_price: catalog.price,
      price_source: line.unit_price == null ? 'catalog' : 'override',
      price_option_id: catalog.option?.id ?? null,
      offer_type: catalog.option?.offer_type ?? null,
      shipping_fee: game.shipping_fee,
      weight_g: game.weight_g,
      line_total: lineTotal,
    };
  });

  const shipping = defaultShipping(lines);
  if (input.shipping_fee == null && shipping.missing.length) {
    issues.push(`Missing catalog shipping fee for: ${shipping.missing.join(', ')}; provide shipping_fee`);
  }
  const shippingHt = input.shipping_fee ?? shipping.value;
  const amounts = shippingHt != null && lines.every((line) => line.line_total != null)
    ? quoteTotals(lines.map((line) => line.line_total as number), shippingHt, input.admin_fee, Number(settingsResult.data?.value ?? 0.2))
    : null;
  const billing = { ...input.client.billing_address, email: input.client.email };
  const shippingAddress = { ...(input.client.shipping_address ?? input.client.billing_address), email: input.client.email };

  return {
    mode: 'preview' as const,
    confirm: false as const,
    ready: issues.length === 0,
    issues,
    client: {
      ...input.client,
      name: input.client.type === 'company'
        ? input.client.company
        : [input.client.first_name, input.client.last_name].filter(Boolean).join(' '),
      billing_address: billing,
      shipping_address: shippingAddress,
    },
    lines: lines.map((line) => ({
      game_id: line.game.id,
      title: line.title,
      quantity: line.quantity,
      unit_price: line.unit_price,
      catalog_price: line.catalog_price,
      price_source: line.price_source,
      price_option_id: line.price_option_id,
      offer_type: line.offer_type,
      line_total: line.line_total,
      shipping_fee: line.shipping_fee == null ? null : Number(line.shipping_fee),
      weight_g: line.weight_g,
    })),
    shipping: { default_ht: shipping.value, override_ht: input.shipping_fee ?? null, missing_catalog_fees: shipping.missing },
    amounts,
    crm_card: cardResult.data ?? null,
    valid_until: input.valid_until ?? null,
    note: input.note,
    write_performed: false,
    side_effects: { email_sent: false, slack_sent: false, paid_order_created: false, stock_changed: false },
  };
}

export type GameQuotePreview = Awaited<ReturnType<typeof prepareGameQuote>>;

export function quoteOrderItems(preview: GameQuotePreview) {
  return preview.lines.map((line) => {
    const game = resolveGame([{
      id: line.game_id,
      title: line.title,
      status: 'active',
      game_type: 'partner',
      woocommerce_product_id: null,
      location_variation_id: null,
      current_stock: null,
      stock: null,
      shipping_fee: line.shipping_fee,
      weight_g: line.weight_g,
      proposed_price_ht: line.catalog_price,
    }], { game_id: line.game_id });
    return {
      wc_product_id: game.woocommerce_product_id,
      wc_variation_id: line.offer_type === 'location' ? game.location_variation_id : null,
      product_name: line.title,
      game_id: line.game_id,
      game_type: line.offer_type === 'location' ? 'location' : game.game_type,
      quantity: line.quantity,
      unit_price: line.unit_price,
      line_total: line.line_total,
      price_option_id: line.price_option_id,
      shipping_fee: line.shipping_fee,
      weight_g: line.weight_g,
    };
  });
}

export function gameQuoteAppUrl(quoteId: string) {
  return `https://academy.supertilt.fr/commandes-jeux?tab=devis&quote=${quoteId}`;
}
