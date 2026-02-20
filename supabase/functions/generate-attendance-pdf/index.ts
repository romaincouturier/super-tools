import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflightIfNeeded, getCorsHeaders } from "../_shared/cors.ts";

interface AttendanceSignature {
  id: string;
  schedule_date: string;
  period: string;
  signature_data: string | null;
  signed_at: string | null;
  participant: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    company: string | null;
  };
}

interface Training {
  training_name: string;
  location: string;
  start_date: string;
  end_date: string | null;
  trainer_name: string;
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { trainingId, participantId } = await req.json();

    if (!trainingId) {
      return new Response(
        JSON.stringify({ error: "trainingId is required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch training info
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("training_name, location, start_date, end_date, trainer_name")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      throw new Error("Training not found");
    }

    // Build query for signatures
    let query = supabase
      .from("attendance_signatures")
      .select("id, schedule_date, period, signature_data, signed_at, participant_id")
      .eq("training_id", trainingId)
      .order("schedule_date", { ascending: true })
      .order("period", { ascending: true });

    if (participantId) {
      query = query.eq("participant_id", participantId);
    }

    const { data: signatures, error: sigError } = await query;

    if (sigError) {
      throw new Error("Failed to fetch signatures");
    }

    // Fetch participant details for each signature
    const participantIds = [...new Set(signatures?.map(s => s.participant_id) || [])];
    const { data: participants } = await supabase
      .from("training_participants")
      .select("id, first_name, last_name, email, company")
      .in("id", participantIds);

    const participantMap = new Map(participants?.map(p => [p.id, p]) || []);

    // Enrich signatures with participant data
    const enrichedSignatures: AttendanceSignature[] = (signatures || []).map(sig => ({
      ...sig,
      participant: participantMap.get(sig.participant_id) || {
        first_name: null,
        last_name: null,
        email: "",
        company: null,
      },
    }));

    // Generate PDF using PDFMonkey or build HTML-based PDF
    // For simplicity, we'll generate an HTML document that can be printed as PDF
    const pdfHtml = generatePdfHtml(training, enrichedSignatures, !!participantId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        html: pdfHtml,
        training: training,
        signaturesCount: enrichedSignatures.length,
        signedCount: enrichedSignatures.filter(s => s.signed_at).length,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error generating attendance PDF:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

function generatePdfHtml(
  training: Training,
  signatures: AttendanceSignature[],
  singleParticipant: boolean
): string {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPeriodLabel = (period: string) => period === "AM" ? "Matin" : "Après-midi";

  // Group signatures by date and period
  const groupedBySlot = new Map<string, AttendanceSignature[]>();
  signatures.forEach(sig => {
    const key = `${sig.schedule_date}-${sig.period}`;
    if (!groupedBySlot.has(key)) {
      groupedBySlot.set(key, []);
    }
    groupedBySlot.get(key)!.push(sig);
  });

  // Sort slots
  const sortedSlots = Array.from(groupedBySlot.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  let participantName = "";
  if (singleParticipant && signatures.length > 0) {
    const p = signatures[0].participant;
    participantName = `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email;
  }

  const title = singleParticipant
    ? `Feuille d'émargement - ${participantName}`
    : `Feuille d'émargement - ${training.training_name}`;

  let html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #333;
      margin: 0;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #eab308;
      padding-bottom: 15px;
    }
    .header h1 {
      font-size: 18px;
      margin: 0 0 5px 0;
      color: #1a1a1a;
    }
    .header h2 {
      font-size: 14px;
      margin: 0;
      color: #666;
      font-weight: normal;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 20px;
      padding: 10px;
      background: #f9f9f9;
      border-radius: 4px;
    }
    .meta-item {
      flex: 1;
      min-width: 150px;
    }
    .meta-label {
      font-weight: bold;
      color: #666;
      font-size: 10px;
      text-transform: uppercase;
    }
    .meta-value {
      font-size: 12px;
      color: #1a1a1a;
    }
    .slot-section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    .slot-header {
      background: #1a1a1a;
      color: white;
      padding: 8px 12px;
      font-weight: bold;
      font-size: 12px;
      border-radius: 4px 4px 0 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    th {
      background: #f0f0f0;
      padding: 8px;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      color: #666;
      border: 1px solid #ddd;
    }
    td {
      padding: 8px;
      border: 1px solid #ddd;
      vertical-align: middle;
    }
    .signature-cell {
      width: 180px;
      height: 60px;
      text-align: center;
    }
    .signature-img {
      max-width: 170px;
      max-height: 55px;
    }
    .no-signature {
      color: #999;
      font-style: italic;
    }
    .signed-at {
      font-size: 9px;
      color: #666;
      margin-top: 3px;
    }
    .status-signed {
      color: #16a34a;
      font-weight: bold;
    }
    .status-pending {
      color: #dc2626;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      font-size: 9px;
      color: #666;
      text-align: center;
    }
    .legal-notice {
      background: #f9f9f9;
      padding: 10px;
      border-radius: 4px;
      margin-top: 20px;
      font-size: 9px;
      color: #666;
    }
    @media print {
      body { padding: 0; }
      .slot-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Feuille d'émargement</h1>
    <h2>${training.training_name}</h2>
  </div>

  <div class="meta">
    <div class="meta-item">
      <div class="meta-label">Lieu</div>
      <div class="meta-value">${training.location}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Date(s)</div>
      <div class="meta-value">${formatDate(training.start_date)}${training.end_date ? ` - ${formatDate(training.end_date)}` : ""}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Formateur</div>
      <div class="meta-value">${training.trainer_name}</div>
    </div>
    ${singleParticipant ? `
    <div class="meta-item">
      <div class="meta-label">Participant</div>
      <div class="meta-value">${participantName}</div>
    </div>
    ` : ""}
  </div>
`;

  if (singleParticipant) {
    // Single participant view: show all their slots in one table
    html += `
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Demi-journée</th>
        <th>Statut</th>
        <th>Signature</th>
      </tr>
    </thead>
    <tbody>
`;
    signatures.forEach(sig => {
      html += `
      <tr>
        <td>${formatShortDate(sig.schedule_date)}</td>
        <td>${getPeriodLabel(sig.period)}</td>
        <td class="${sig.signed_at ? 'status-signed' : 'status-pending'}">${sig.signed_at ? 'Signé' : 'En attente'}</td>
        <td class="signature-cell">
          ${sig.signature_data 
            ? `<img src="${sig.signature_data}" class="signature-img" alt="Signature"/>
               <div class="signed-at">${formatDateTime(sig.signed_at!)}</div>`
            : '<span class="no-signature">—</span>'
          }
        </td>
      </tr>
`;
    });
    html += `
    </tbody>
  </table>
`;
  } else {
    // Full session view: group by slot
    for (const [slotKey, slotSignatures] of sortedSlots) {
      const [date, period] = slotKey.split("-");
      const signedCount = slotSignatures.filter(s => s.signed_at).length;
      
      html += `
  <div class="slot-section">
    <div class="slot-header">
      ${formatShortDate(date)} - ${getPeriodLabel(period)} (${signedCount}/${slotSignatures.length} signatures)
    </div>
    <table>
      <thead>
        <tr>
          <th>Participant</th>
          <th>Entreprise</th>
          <th>Statut</th>
          <th>Signature</th>
        </tr>
      </thead>
      <tbody>
`;
      slotSignatures.forEach(sig => {
        const name = `${sig.participant.first_name || ""} ${sig.participant.last_name || ""}`.trim() || sig.participant.email;
        html += `
        <tr>
          <td>${name}</td>
          <td>${sig.participant.company || "—"}</td>
          <td class="${sig.signed_at ? 'status-signed' : 'status-pending'}">${sig.signed_at ? 'Signé' : 'En attente'}</td>
          <td class="signature-cell">
            ${sig.signature_data 
              ? `<img src="${sig.signature_data}" class="signature-img" alt="Signature"/>
                 <div class="signed-at">${formatDateTime(sig.signed_at!)}</div>`
              : '<span class="no-signature">—</span>'
            }
          </td>
        </tr>
`;
      });
      html += `
      </tbody>
    </table>
  </div>
`;
    }
  }

  html += `
  <div class="legal-notice">
    <strong>Mention légale :</strong> Ces signatures électroniques ont valeur légale conformément au règlement européen eIDAS (UE n° 910/2014). 
    Chaque signature est horodatée et associée à l'identité du signataire (email, adresse IP, navigateur).
  </div>

  <div class="footer">
    Document généré le ${new Date().toLocaleString("fr-FR")} - <a href="https://www.supertilt.fr" style="color: #1a1a2e; text-decoration: underline;">SuperTilt Formation</a>
  </div>
</body>
</html>
`;

  return html;
}
