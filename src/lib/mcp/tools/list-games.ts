import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { dropshippingClient, result } from '../supabase';
import { GAME_CATALOG_FIELDS, GAME_PRICE_FIELDS, selectCatalogPrice, type GameCatalogRow, type GamePriceOptionRow } from '../game-quote-shared';

export default defineTool({
  name: 'list_games',
  title: 'List game catalog',
  description: 'Lists games with id, title, default catalog price HT, stock, per-unit shipping fee HT and weight. Includes sale/rental price options so create_game_quote can use the right game_id and price_option_id.',
  inputSchema: {
    search: z.string().trim().max(120).optional().describe('Optional case-insensitive title filter'),
    include_inactive: z.boolean().default(false),
    limit: z.number().int().min(1).max(200).default(100),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, include_inactive, limit }, ctx) => {
    const db = await dropshippingClient(ctx);
    let query = db.from('games').select(GAME_CATALOG_FIELDS).order('title').limit(limit);
    if (!include_inactive) query = query.eq('status', 'active');
    if (search) query = query.ilike('title', `%${search.replace(/[%,]/g, '')}%`);
    const { data, error } = await query;
    if (error) throw error;
    const games = (data ?? []) as GameCatalogRow[];
    const ids = games.map((game) => game.id);
    const { data: optionData, error: optionError } = ids.length
      ? await db.from('game_price_options').select(GAME_PRICE_FIELDS).in('game_id', ids).order('display_order')
      : { data: [], error: null };
    if (optionError) throw optionError;
    const options = (optionData ?? []) as GamePriceOptionRow[];
    return result(games.map((game) => {
      const gameOptions = options.filter((option) => option.game_id === game.id);
      const catalog = selectCatalogPrice(game, gameOptions);
      return {
        id: game.id,
        title: game.title,
        status: game.status,
        price_ht: catalog.price,
        price_option_id: catalog.option?.id ?? null,
        price_ambiguous: catalog.ambiguous,
        stock: game.current_stock ?? game.stock,
        shipping_fee_ht: game.shipping_fee == null ? null : Number(game.shipping_fee),
        weight_g: game.weight_g,
        price_options: gameOptions.map((option) => ({
          id: option.id,
          offer_type: option.offer_type,
          label: option.label,
          price_ht: Number(option.prix),
        })),
      };
    }));
  },
});
