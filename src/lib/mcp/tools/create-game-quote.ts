import { defineTool } from '@lovable.dev/mcp-js';
import { dropshippingClient, result } from '../supabase';
import { gameQuoteFields, gameQuoteSchema, prepareGameQuote } from '../game-quote-shared';
import { confirmGameQuote } from '../../../../supabase/functions/_shared/game-quote-writer';

export default defineTool({
  name: 'create_game_quote',
  title: 'Create a draft game quote',
  description: 'Previews or creates a draft game quote in the SuperTools dropshipping module. Default confirm=false is fully read-only and returns client, lines and HT/VAT/TTC amounts. confirm=true creates woocommerce_orders/order_items with source=devis and status=draft, the usual DV number and PDF, activity audit, and a CRM comment when crm_card_id is provided. It NEVER emails the client, sends Slack, creates a paid order or decrements stock. Prices and shipping default to catalog values; missing values must be overridden explicitly. Review the preview and obtain explicit user approval before confirm=true. Never retry automatically after an ambiguous write failure.',
  inputSchema: gameQuoteFields,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args, ctx) => {
    const input = gameQuoteSchema.parse(args);
    const db = await dropshippingClient(ctx);
    const preview = await prepareGameQuote(db, input);
    if (!input.confirm) return result(preview);
    if (!preview.ready || !preview.amounts) throw new Error(`Preview is not ready: ${preview.issues.join(' | ')}`);
    return result(await confirmGameQuote(db, input, preview));
  },
});
