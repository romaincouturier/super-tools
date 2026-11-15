export async function loadGameQuoteForSend(db: any, quoteId: string, confirmed: boolean) {
  if (!confirmed) throw new Error('Confirmez explicitement l’envoi du devis.');
  const { data: order, error } = await db.from('woocommerce_orders').select('*').eq('id', quoteId).eq('source', 'devis').single();
  if (error) throw error;
  if (!order || order.wc_status !== 'draft' || order.cancelled_at) throw new Error('Ce devis n’est pas un brouillon disponible.');
  const log = await db.from('activity_logs').select('id,action_type,details').eq('id', order.devis_activity_log_id).single();
  if (log.error) throw log.error;
  if (log.data?.action_type === 'game_devis_sent') return { alreadySent: true as const };
  if (log.data?.action_type !== 'game_devis_draft') throw new Error('Brouillon de devis introuvable.');
  const details = log.data.details;
  if (!details?.pdf_storage_path) throw new Error('Le PDF du brouillon est manquant.');
  const signed = await db.storage.from('devis-pdfs').createSignedUrl(details.pdf_storage_path, 3600);
  if (signed.error) throw signed.error;
  if (!signed.data?.signedUrl) throw new Error('Le PDF du brouillon est inaccessible.');
  const address = order.billing_address;
  return {
    alreadySent: false as const,
    order,
    activityLogId: log.data.id,
    details,
    pdfUrl: signed.data.signedUrl as string,
    body: {
      nomClient: details.client_name,
      adresseClient: [address.address_1, address.address_2].filter(Boolean).join('\n'),
      codePostalClient: address.postcode,
      villeClient: address.city,
      pays: address.country,
      emailCommanditaire: order.customer_email,
      adresseCommanditaire: [order.customer_first_name, order.customer_last_name].filter(Boolean).join(' ') || order.customer_email,
      items: details.items,
      fraisDePort: Number(details.shipping_fee ?? 0),
      fraisDossier: Number(details.admin_fee ?? 0),
      noteDevis: details.note ?? '',
      crmCardId: order.crm_card_id ?? undefined,
    },
  };
}