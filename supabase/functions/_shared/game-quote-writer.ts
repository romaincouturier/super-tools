import { gameQuoteAppUrl, type GameQuoteInput, type GameQuotePreview } from '../../../src/lib/mcp/game-quote-shared';
import { generateGameQuotePdf } from './game-quote-pdf';

export async function confirmGameQuote(db: any, input: GameQuoteInput, preview: GameQuotePreview) {
  if (!preview.ready || !preview.amounts) throw new Error(`Preview is not ready: ${preview.issues.join(' | ')}`);
  const { pdfUrl, documentId } = await generateGameQuotePdf(input, preview);
  const pdfResponse = await fetch(pdfUrl);
  if (!pdfResponse.ok) throw new Error(`PDF download failed (${pdfResponse.status})`);
  const pdfBuffer = await pdfResponse.arrayBuffer();
  const folder = input.crm_card_id ?? 'unlinked';
  const storagePath = `${folder}/${Date.now()}_${crypto.randomUUID()}_jeux.pdf`;
  const upload = await db.storage.from('devis-pdfs').upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: false });
  if (upload.error) throw upload.error;

  try {
    const signed = await db.storage.from('devis-pdfs').createSignedUrl(storagePath, 3600);
    const signedUrl = signed.data?.signedUrl ?? pdfUrl;
    const amounts = preview.amounts;
    const comment = [
      'Devis jeux créé en brouillon via MCP.',
      preview.lines.map((line) => `${line.quantity} × ${line.title}`).join(' ; '),
      `Total : ${amounts.total_ht.toFixed(2)} € HT / ${amounts.total_ttc.toFixed(2)} € TTC.`,
      input.valid_until ? `Valable jusqu'au ${input.valid_until}.` : '',
      'Aucun envoi au client.',
    ].filter(Boolean).join('\n');
    const orderItems = preview.lines.map((line) => ({
      wc_product_id: line.woocommerce_product_id,
      wc_variation_id: line.offer_type === 'location' ? line.location_variation_id : null,
      product_name: line.title,
      game_id: line.game_id,
      game_type: line.offer_type === 'location' ? 'location' : line.game_type,
      quantity: line.quantity,
      unit_price: line.unit_price,
      line_total: line.line_total,
      price_option_id: line.price_option_id,
      shipping_fee: line.shipping_fee,
      weight_g: line.weight_g,
    }));
    const { data, error } = await db.rpc('create_game_quote', {
      p_quote: {
        crm_card_id: input.crm_card_id ?? null,
        customer_first_name: input.client.first_name ?? null,
        customer_last_name: input.client.last_name ?? null,
        customer_email: input.client.email,
        billing_address: preview.client.billing_address,
        shipping_address: preview.client.shipping_address,
        total_ht: amounts.total_ht,
        total_tax: amounts.total_tax,
        total_ttc: amounts.total_ttc,
        shipping_total: amounts.shipping_ht,
        admin_fee: amounts.admin_fee_ht,
        valid_until: input.valid_until ?? null,
        note: input.note,
        vat_number: input.client.vat_number ?? null,
        crm_comment: comment,
        activity_details: {
          crm_card_id: input.crm_card_id ?? null,
          status: 'draft',
          via: 'mcp',
          total_amount: amounts.total_ht,
          total_tax: amounts.total_tax,
          total_ttc: amounts.total_ttc,
          client_name: preview.client.name,
          items: preview.lines.map((line) => ({ title: line.title, quantity: line.quantity, unitPrice: line.unit_price })),
          shipping_fee: amounts.shipping_ht,
          admin_fee: amounts.admin_fee_ht,
          valid_until: input.valid_until ?? null,
          note: input.note,
          billing_address: preview.client.billing_address,
          shipping_address: preview.client.shipping_address,
          vat_number: input.client.vat_number ?? null,
          pdf_url: pdfUrl,
          pdf_storage_path: storagePath,
          pdfmonkey_document_id: documentId,
        },
      },
      p_items: orderItems,
    });
    if (error) throw error;
    return {
      mode: 'created',
      quote_id: data.id,
      quote_number: data.order_number,
      status: data.status,
      amounts,
      pdf_url: signedUrl,
      pdf_expires_in_seconds: signed.data?.signedUrl ? 3600 : null,
      pdf_storage_path: storagePath,
      app_url: gameQuoteAppUrl(data.id),
      crm_comment: data.crm_comment_id ? { id: data.crm_comment_id, content: comment } : null,
      email_sent: false,
      slack_sent: false,
      paid_order_created: false,
    };
  } catch (error) {
    await db.storage.from('devis-pdfs').remove([storagePath]);
    throw error;
  }
}
