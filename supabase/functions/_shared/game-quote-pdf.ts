import type { GameQuoteInput, GameQuotePreview } from '../../../src/lib/mcp/game-quote-shared';

const GAME_DEVIS_TEMPLATE_ID = 'C5099C66-FB36-49F3-B674-2F8C1A2F314A';
type Runtime = typeof globalThis & { Deno?: { env: { get(name: string): string | undefined } }; process?: { env: Record<string, string | undefined> } };

function env(name: string) {
  const runtime = globalThis as Runtime;
  return runtime.Deno?.env.get(name) ?? runtime.process?.env[name];
}

export async function generateGameQuotePdf(input: GameQuoteInput, preview: GameQuotePreview) {
  const apiKey = env('PDFMONKEY_API_KEY');
  if (!apiKey) throw new Error('PDFMONKEY_API_KEY is not set');
  const client = preview.client;
  const validityNote = input.valid_until ? `Valable jusqu'au ${input.valid_until}` : '';
  const payload = {
    client: {
      name: client.name,
      address: [client.billing_address.address_1, client.billing_address.address_2].filter(Boolean).join('\n'),
      zip: client.billing_address.postcode,
      city: client.billing_address.city,
      country: client.billing_address.country,
      vat_number: client.vat_number ?? null,
    },
    items: preview.lines.map((line) => ({ name: line.title, quantity: line.quantity, unit_price: line.unit_price })),
    shipping_fee: preview.amounts?.shipping_ht ?? 0,
    admin_fee: preview.amounts?.admin_fee_ht ?? 0,
    note: [input.note, validityNote].filter(Boolean).join('\n\n'),
    valid_until: input.valid_until ?? null,
  };
  const createResponse = await fetch('https://api.pdfmonkey.io/api/v1/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ document: { document_template_id: GAME_DEVIS_TEMPLATE_ID, payload, status: 'pending' } }),
  });
  if (!createResponse.ok) throw new Error(`PdfMonkey create error: ${await createResponse.text()}`);
  const { document } = await createResponse.json();
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const statusResponse = await fetch(`https://api.pdfmonkey.io/api/v1/documents/${document.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!statusResponse.ok) throw new Error('PdfMonkey status check failed');
    const { document: current } = await statusResponse.json();
    if (current.status === 'success') return { pdfUrl: current.download_url as string, documentId: current.id as string };
    if (current.status === 'failure') throw new Error(`PdfMonkey failed: ${current.failure_cause}`);
  }
  throw new Error('PdfMonkey timed out');
}
