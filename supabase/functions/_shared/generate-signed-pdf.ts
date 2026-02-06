import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

interface JourneyEvent {
  event: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

const JOURNEY_LABELS: Record<string, string> = {
  page_loaded: "Page de signature ouverte",
  first_link_opened: "Premier accès au lien",
  link_reopened: "Lien réouvert",
  pdf_consulted: "Document PDF consulté",
  signer_name_entered: "Nom du signataire saisi",
  signature_drawing_started: "Début du tracé de signature",
  signature_cleared: "Signature effacée et recommencée",
  consent_checkbox_checked: "Consentement coché",
  consent_checkbox_unchecked: "Consentement décoché",
  submit_button_clicked: "Bouton « Signer » cliqué",
  signature_submitted_server: "Signature enregistrée côté serveur",
};

function formatDateFr(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(date);
}

function formatTimeFr(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Paris",
  }).format(date);
}

export interface SignedPdfOptions {
  /** Original PDF buffer to append the attestation to. If null, creates a standalone PDF. */
  pdfBuffer: ArrayBuffer | null;
  /** Base64 data URL of the signature image (PNG) */
  signatureDataUrl: string;
  /** Name of the signer */
  signerName: string;
  /** Optional function/title of the signer */
  signerFunction?: string;
  /** ISO timestamp of the signature */
  signedAt: string;
  /** Document title (e.g. "Convention de formation", "Devis", "Feuille d'émargement") */
  documentType: string;
  /** Document subtitle (e.g. formation name) */
  documentTitle: string;
  /** Client or organization name */
  clientName: string;
  /** SHA-256 hash of the signature image */
  signatureHash: string;
  /** IP address of the signer */
  ipAddress: string;
  /** Journey events timeline */
  journeyEvents: JourneyEvent[];
  /** SHA-256 hash of the original PDF at signing time */
  pdfHashAtSignature: string | null;
  /** Extra label/value pairs to show in the document info section */
  extraFields?: { label: string; value: string }[];
}

export async function generateSignedPdf(opts: SignedPdfOptions): Promise<Uint8Array> {
  const pdfDoc = opts.pdfBuffer
    ? await PDFDocument.load(opts.pdfBuffer)
    : await PDFDocument.create();

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Decode the signature PNG
  const base64Data = opts.signatureDataUrl.replace(/^data:image\/png;base64,/, "");
  const signatureBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const signatureImage = await pdfDoc.embedPng(signatureBytes);

  // ── Attestation page ──
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const drawLabelValue = (label: string, value: string, fontSize = 9) => {
    page.drawText(label, { x: margin, y, size: fontSize, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(value, { x: margin + 150, y, size: fontSize, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
  };

  const drawHashLine = (label: string, hash: string) => {
    page.drawText(label, { x: margin, y, size: 8, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    y -= 13;
    const chunkSize = 64;
    for (let i = 0; i < hash.length; i += chunkSize) {
      page.drawText(hash.substring(i, i + chunkSize), { x: margin + 10, y, size: 7, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
      y -= 11;
    }
    y -= 4;
  };

  const drawSeparator = () => {
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= 16;
  };

  // ── Title ──
  page.drawText("ATTESTATION DE SIGNATURE ÉLECTRONIQUE", {
    x: margin, y, size: 15, font: helveticaBold, color: rgb(0.1, 0.1, 0.1),
  });
  y -= 8;
  page.drawText(opts.documentType, {
    x: margin, y, size: 10, font: helvetica, color: rgb(0.4, 0.4, 0.4),
  });
  y -= 20;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 20;

  // ── 1. Document info ──
  drawLabelValue("Document :", opts.documentTitle);
  drawLabelValue("Client :", opts.clientName);
  drawLabelValue("Signataire :", opts.signerName);
  if (opts.signerFunction) {
    drawLabelValue("Fonction :", opts.signerFunction);
  }
  drawLabelValue("Date de signature :", formatDateFr(opts.signedAt));
  drawLabelValue("Adresse IP :", opts.ipAddress);
  drawLabelValue("Niveau de signature :", "SES – Signature Électronique Simple");

  if (opts.extraFields) {
    for (const f of opts.extraFields) {
      drawLabelValue(f.label, f.value);
    }
  }

  y -= 8;
  drawSeparator();

  // ── 2. Signature image ──
  page.drawText("Signature manuscrite :", { x: margin, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
  y -= 10;

  const maxSigWidth = 220;
  const maxSigHeight = 80;
  const sigAspect = signatureImage.width / signatureImage.height;
  let sigW = maxSigWidth;
  let sigH = sigW / sigAspect;
  if (sigH > maxSigHeight) { sigH = maxSigHeight; sigW = sigH * sigAspect; }

  page.drawRectangle({
    x: margin, y: y - sigH - 10, width: sigW + 20, height: sigH + 20,
    borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5, color: rgb(0.98, 0.98, 0.98),
  });
  page.drawImage(signatureImage, { x: margin + 10, y: y - sigH, width: sigW, height: sigH });
  y -= sigH + 30;
  drawSeparator();

  // ── 3. SHA-256 hashes ──
  page.drawText("Empreintes numériques (SHA-256) :", { x: margin, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
  y -= 16;
  drawHashLine("Signature :", opts.signatureHash);
  if (opts.pdfHashAtSignature) {
    drawHashLine("Document PDF original :", opts.pdfHashAtSignature);
  }
  drawSeparator();

  // ── 4. Journey timeline ──
  page.drawText("Parcours de signature :", { x: margin, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
  y -= 14;

  if (opts.journeyEvents.length > 0) {
    for (const evt of opts.journeyEvents) {
      if (y < margin + 60) break;
      const time = formatTimeFr(evt.timestamp);
      const label = JOURNEY_LABELS[evt.event] || evt.event;
      page.drawText(time, { x: margin + 10, y, size: 7.5, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(label, { x: margin + 70, y, size: 7.5, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
      y -= 12;
    }
  } else {
    page.drawText("(parcours non disponible)", { x: margin + 10, y, size: 7.5, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
    y -= 12;
  }

  y -= 8;
  drawSeparator();

  // ── 5. Legal mention ──
  const sealedNote = opts.pdfBuffer
    ? "Ce document scellé (document original + attestation de signature) a été généré automatiquement."
    : "Cette attestation de signature électronique a été générée automatiquement.";
  const legalLines = [
    sealedNote,
    "La signature électronique simple (SES) a valeur juridique conformément au règlement européen eIDAS",
    "(UE n° 910/2014) et aux articles 1366 et 1367 du Code civil français.",
    "",
    "Un dossier de preuve complet (métadonnées, parcours, consentement) est conservé séparément.",
  ];
  for (const line of legalLines) {
    if (line === "") { y -= 6; continue; }
    page.drawText(line, { x: margin, y, size: 7, font: helvetica, color: rgb(0.45, 0.45, 0.45) });
    y -= 11;
  }

  return await pdfDoc.save();
}
