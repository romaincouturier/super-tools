import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { formatDateFr, formatDateLong, getPeriodLabel } from "@/lib/dateFormatters";
import { jsPDF } from "jspdf";
import supertiltLogoJpg from "@/assets/supertilt-logo-anthracite.jpg";
import type { TrainerSignature } from "./types";

const loadImageAsBase64 = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("No canvas context")); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = reject;
    img.src = src;
  });
};

const compressSignatureAsync = (dataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    try {
      const timeout = setTimeout(() => resolve(dataUrl), 3000);
      const img = new Image();
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement("canvas");
          const maxW = 400;
          const scale = Math.min(1, maxW / img.naturalWidth);
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(dataUrl); return; }
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 1.0));
        } catch { resolve(dataUrl); }
      };
      img.onerror = () => { clearTimeout(timeout); resolve(dataUrl); };
      img.src = dataUrl;
    } catch { resolve(dataUrl); }
  });
};

const getImageFormat = (dataUrl: string): string => {
  if (dataUrl.startsWith("data:image/jpeg")) return "JPEG";
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  return "JPEG";
};

interface ExportOptions {
  trainingId: string;
  trainingName: string;
  startDate: string | null;
  participantId?: string;
  onUpdate?: () => void;
}

export async function exportAttendancePdf({
  trainingId,
  trainingName,
  startDate,
  participantId,
  onUpdate,
}: ExportOptions): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.functions.invoke("generate-attendance-pdf", {
    body: { trainingId, participantId },
  });

  if (error) throw error;

  if (!data?.signatures || data.signatures.length === 0) {
    return { success: false, message: "Aucune donnée d'émargement trouvée." };
  }

  const training = data.training;
  const signatures = data.signatures;
  const trainerSigs: TrainerSignature[] = data.trainerSignatures || [];

  const trainerSigMap = new Map(
    trainerSigs.map((ts: TrainerSignature) => [`${ts.schedule_date}-${ts.period}`, ts])
  );

  const logoBase64 = await loadImageAsBase64(supertiltLogoJpg);

  for (const sig of signatures) {
    if (sig.signature_data) {
      sig.signature_data = await compressSignatureAsync(sig.signature_data);
    }
  }
  for (const ts of trainerSigs) {
    if (ts.signature_data) {
      ts.signature_data = await compressSignatureAsync(ts.signature_data);
    }
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  let participantName = "";
  if (participantId && signatures.length > 0) {
    const p = signatures[0].participant;
    participantName = `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email;
  }

  // Page header
  doc.addImage(logoBase64, "JPEG", margin, 8, 35, 13);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Feuille d'émargement", pageWidth / 2, 16, { align: "center" });
  doc.setDrawColor(234, 179, 8);
  doc.setLineWidth(0.8);
  doc.line(margin, 24, pageWidth - margin, 24);

  let yPos = 30;
  doc.setFontSize(9);

  const drawMetaField = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 30, yPos);
    yPos += 5;
  };

  drawMetaField("Formation :", training.training_name);
  drawMetaField("Lieu :", training.location);
  const dateText = training.end_date
    ? `Du ${formatDateLong(training.start_date)} au ${formatDateLong(training.end_date)}`
    : formatDateLong(training.start_date);
  drawMetaField("Date(s) :", dateText);
  drawMetaField("Formateur :", training.trainer_name);
  if (participantId) drawMetaField("Participant :", participantName);
  yPos += 3;

  // Group signatures by slot
  const groupedBySlot = new Map<string, typeof signatures>();
  for (const sig of signatures) {
    const key = `${sig.schedule_date}-${sig.period}`;
    if (!groupedBySlot.has(key)) groupedBySlot.set(key, []);
    groupedBySlot.get(key)!.push(sig);
  }
  const sortedSlots = Array.from(groupedBySlot.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  if (participantId) {
    // Single participant view
    const colWidths = [30, 30, 20, contentWidth - 80];
    const headers = ["Date", "Demi-journée", "Statut", "Signature"];

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, contentWidth, 8, "F");
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, yPos, contentWidth, 8, "S");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);

    let xPos = margin;
    headers.forEach((h, i) => {
      doc.text(h, xPos + 2, yPos + 5.5);
      if (i < headers.length - 1) doc.line(xPos + colWidths[i], yPos, xPos + colWidths[i], yPos + 8);
      xPos += colWidths[i];
    });
    yPos += 8;
    doc.setTextColor(0, 0, 0);

    for (const sig of signatures) {
      const rowHeight = 18;
      if (yPos + rowHeight > pageHeight - 30) { doc.addPage(); yPos = margin; }

      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, yPos, contentWidth, rowHeight, "S");
      xPos = margin;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      doc.text(formatDateFr(sig.schedule_date), xPos + 2, yPos + 6);
      doc.line(xPos + colWidths[0], yPos, xPos + colWidths[0], yPos + rowHeight);
      xPos += colWidths[0];

      doc.text(getPeriodLabel(sig.period), xPos + 2, yPos + 6);
      doc.line(xPos + colWidths[1], yPos, xPos + colWidths[1], yPos + rowHeight);
      xPos += colWidths[1];

      if (sig.signed_at) {
        doc.setTextColor(22, 163, 74);
        doc.setFont("helvetica", "bold");
        doc.text("Signé", xPos + 2, yPos + 6);
      } else {
        doc.setTextColor(220, 38, 38);
        doc.text("En attente", xPos + 2, yPos + 6);
      }
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.line(xPos + colWidths[2], yPos, xPos + colWidths[2], yPos + rowHeight);
      xPos += colWidths[2];

      if (sig.signature_data) {
        try {
          doc.addImage(sig.signature_data, getImageFormat(sig.signature_data), xPos + 2, yPos + 1, 40, 12);
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          doc.text(formatDateTime(sig.signed_at), xPos + 2, yPos + 16);
          doc.setTextColor(0, 0, 0);
        } catch { /* skip broken image */ }
      }
      yPos += rowHeight;
    }
  } else {
    // Full session view
    for (const [slotKey, slotSignatures] of sortedSlots) {
      const lastDash = slotKey.lastIndexOf("-");
      const date = slotKey.slice(0, lastDash);
      const period = slotKey.slice(lastDash + 1);
      const signedCount = slotSignatures.filter((s) => s.signed_at).length;
      const trainerSig = trainerSigMap.get(slotKey);

      const estimatedHeight = 8 + (slotSignatures.length * 18) + 25;
      if (yPos + Math.min(estimatedHeight, 50) > pageHeight - 30) { doc.addPage(); yPos = margin; }

      doc.setFillColor(26, 26, 26);
      doc.rect(margin, yPos, contentWidth, 8, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(
        `${formatDateFr(date)} - ${getPeriodLabel(period)} (${signedCount}/${slotSignatures.length} signatures)`,
        margin + 3, yPos + 5.5
      );
      doc.setTextColor(0, 0, 0);
      yPos += 8;

      const colWidths = [45, 35, 22, contentWidth - 102];
      const headers = ["Participant", "Entreprise", "Statut", "Signature"];

      doc.setFillColor(245, 245, 245);
      doc.rect(margin, yPos, contentWidth, 7, "F");
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, yPos, contentWidth, 7, "S");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);

      let xPos = margin;
      headers.forEach((h, i) => {
        doc.text(h.toUpperCase(), xPos + 2, yPos + 5);
        if (i < headers.length - 1) doc.line(xPos + colWidths[i], yPos, xPos + colWidths[i], yPos + 7);
        xPos += colWidths[i];
      });
      yPos += 7;
      doc.setTextColor(0, 0, 0);

      for (const sig of slotSignatures) {
        const rowHeight = 18;
        if (yPos + rowHeight > pageHeight - 30) { doc.addPage(); yPos = margin; }

        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, yPos, contentWidth, rowHeight, "S");
        xPos = margin;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");

        const name = `${sig.participant.first_name || ""} ${sig.participant.last_name || ""}`.trim() || sig.participant.email;
        const truncName = name.length > 22 ? name.substring(0, 21) + "…" : name;
        doc.text(truncName, xPos + 2, yPos + 6);
        doc.line(xPos + colWidths[0], yPos, xPos + colWidths[0], yPos + rowHeight);
        xPos += colWidths[0];

        const company = sig.participant.company || "—";
        const truncCompany = company.length > 16 ? company.substring(0, 15) + "…" : company;
        doc.text(truncCompany, xPos + 2, yPos + 6);
        doc.line(xPos + colWidths[1], yPos, xPos + colWidths[1], yPos + rowHeight);
        xPos += colWidths[1];

        if (sig.signed_at) {
          doc.setTextColor(22, 163, 74);
          doc.setFont("helvetica", "bold");
          doc.text("Signé", xPos + 2, yPos + 6);
        } else {
          doc.setTextColor(220, 38, 38);
          doc.text("En attente", xPos + 2, yPos + 6);
        }
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.line(xPos + colWidths[2], yPos, xPos + colWidths[2], yPos + rowHeight);
        xPos += colWidths[2];

        if (sig.signature_data) {
          try {
            doc.addImage(sig.signature_data, getImageFormat(sig.signature_data), xPos + 2, yPos + 1, 40, 12);
            doc.setFontSize(7);
            doc.setTextColor(100, 100, 100);
            doc.text(formatDateTime(sig.signed_at), xPos + 2, yPos + 16);
            doc.setTextColor(0, 0, 0);
          } catch { /* skip broken image */ }
        }
        yPos += rowHeight;
      }

      // Trainer signature for this slot
      if (yPos + 20 > pageHeight - 30) { doc.addPage(); yPos = margin; }

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Signature du formateur :", margin, yPos + 5);

      if (trainerSig?.signature_data) {
        try {
          doc.addImage(trainerSig.signature_data, getImageFormat(trainerSig.signature_data), margin + 42, yPos - 1, 35, 12);
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text(`${trainerSig.trainer_name || training.trainer_name} — ${formatDateTime(trainerSig.signed_at!)}`, margin + 42, yPos + 14);
          doc.setTextColor(0, 0, 0);
        } catch { /* skip broken image */ }
        yPos += 18;
      } else {
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(150, 150, 150);
        doc.text("(non signé)", margin + 42, yPos + 5);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        yPos += 10;
      }
      yPos += 8;
    }
  }

  // Legal notice
  if (yPos + 25 > pageHeight - 15) { doc.addPage(); yPos = margin; }

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  doc.setFillColor(249, 249, 249);
  doc.rect(margin, yPos, contentWidth, 16, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text("Mention légale :", margin + 2, yPos + 4);
  doc.setFont("helvetica", "normal");
  doc.text("Ces signatures électroniques ont valeur légale conformément au règlement européen eIDAS (UE n° 910/2014).", margin + 2, yPos + 9);
  doc.text("Chaque signature est horodatée et associée à l'identité du signataire (email, adresse IP, navigateur).", margin + 2, yPos + 13);
  doc.setTextColor(0, 0, 0);

  yPos += 20;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Document généré le ${new Date().toLocaleString("fr-FR")} — SuperTilt`, pageWidth / 2, yPos, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Generate file
  const safeName = trainingName.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s-]/g, "").replace(/\s+/g, "_");
  const dateStr = startDate ? format(parseISO(startDate), "yyyy-MM-dd") : "permanent";
  const filename = participantId
    ? `Emargement_${participantName.replace(/\s+/g, "_")}_${safeName}_${dateStr}.pdf`
    : `Emargement_${safeName}_${dateStr}.pdf`;

  if (participantId) {
    doc.save(filename);
    return { success: true, message: "La feuille d'émargement a été téléchargée." };
  }

  // Full session: upload to storage
  const pdfBlob = doc.output("blob");
  const storagePath = `${trainingId}/emargement_electronique_${Date.now()}.pdf`;

  const { data: trainingData } = await supabase
    .from("trainings")
    .select("attendance_sheets_urls")
    .eq("id", trainingId)
    .single();

  const currentUrls: string[] = (trainingData?.attendance_sheets_urls as string[]) || [];

  const oldElectronicUrls = currentUrls.filter(url => url.includes("/emargement_electronique_"));
  for (const oldUrl of oldElectronicUrls) {
    try {
      const oldPath = oldUrl.split("/training-documents/").pop();
      if (oldPath) {
        await supabase.storage.from("training-documents").remove([decodeURIComponent(oldPath)]);
      }
    } catch { /* best-effort */ }
  }

  const { error: uploadError } = await supabase.storage
    .from("training-documents")
    .upload(storagePath, pdfBlob, { contentType: "application/pdf" });

  if (!uploadError) {
    const { data: { publicUrl } } = supabase.storage.from("training-documents").getPublicUrl(storagePath);
    const nonElectronicUrls = currentUrls.filter(url => !url.includes("/emargement_electronique_"));
    const newUrls = [...nonElectronicUrls, publicUrl];
    await supabase.from("trainings").update({ attendance_sheets_urls: newUrls }).eq("id", trainingId);
    onUpdate?.();
  }

  return { success: true, message: "Le document a été ajouté aux documents de la formation." };
}
