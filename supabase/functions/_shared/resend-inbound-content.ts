// Les webhooks Resend `email.received` ne transportent QUE les métadonnées :
// ni corps, ni headers, ni pièces jointes (choix de Resend pour supporter les
// grosses pièces jointes en serverless). Le contenu doit être récupéré via
// l'API « Retrieve Received Email ». Sans cet appel, `text_body` / `html_body`
// restent NULL et les emails entrants apparaissent vides.
// Doc : https://resend.com/docs/api-reference/emails/retrieve-received-email

export interface ReceivedEmailContent {
  text: string | null;
  html: string | null;
  headers: Record<string, unknown>;
  attachments: { filename: string; content_type: string; size: number }[];
}

/** Dernière erreur de récupération, pour diagnostic (rattrapage manuel). */
export let lastFetchError: string | null = null;

export async function fetchReceivedEmailContent(
  emailId: string,
): Promise<ReceivedEmailContent | null> {
  lastFetchError = null;
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    lastFetchError = "RESEND_API_KEY manquant";
    console.error("RESEND_API_KEY manquant : impossible de récupérer le corps de l'email entrant");
    return null;
  }

  const response = await fetch(
    `https://api.resend.com/emails/receiving/${emailId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );

  if (!response.ok) {
    const body = await response.text();
    lastFetchError = `Resend ${response.status}: ${body.slice(0, 300)}`;
    console.error(`Resend receiving API error [${response.status}]: ${body}`);
    return null;
  }

  const data = await response.json();

  const attachments = Array.isArray(data.attachments)
    ? data.attachments.map((att: Record<string, unknown>) => ({
        filename: String(att.filename ?? att.name ?? "piece-jointe"),
        content_type: String(att.content_type ?? att.contentType ?? "application/octet-stream"),
        size: Number(att.size ?? 0),
      }))
    : [];

  // `headers` peut arriver en objet ou en tableau [{name, value}].
  let headers: Record<string, unknown> = {};
  if (Array.isArray(data.headers)) {
    for (const h of data.headers) {
      if (h?.name) headers[String(h.name)] = h.value ?? null;
    }
  } else if (data.headers && typeof data.headers === "object") {
    headers = data.headers as Record<string, unknown>;
  }

  return {
    text: typeof data.text === "string" && data.text.length > 0 ? data.text : null,
    html: typeof data.html === "string" && data.html.length > 0 ? data.html : null,
    headers,
    attachments,
  };
}
