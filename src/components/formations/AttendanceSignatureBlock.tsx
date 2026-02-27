import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { formatDateFr, formatDateLong, getPeriodLabel as getPeriodLabelShared, formatDateSlot } from "@/lib/dateFormatters";
import { PenLine, Send, RefreshCw, Check, Loader2, Download, FileDown, ChevronDown, UserPen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SignaturePad from "signature_pad";
import { jsPDF } from "jspdf";
import supertiltLogoJpg from "@/assets/supertilt-logo-anthracite.jpg";


interface AttendanceSignatureBlockProps {
  trainingId: string;
  trainingName: string;
  trainerName: string;
  schedules: Array<{
    id: string;
    day_date: string;
    start_time: string;
    end_time: string;
  }>;
  participantsCount: number;
  participants: Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  }>;
  location: string;
  startDate: string;
  endDate: string | null;
  onUpdate?: () => void;
}

interface SignatureStatus {
  date: string;
  period: "AM" | "PM";
  totalSent: number;
  totalSigned: number;
  hasSent: boolean;
  trainerSigned: boolean;
}

interface TrainerSignature {
  schedule_date: string;
  period: string;
  signature_data: string | null;
  signed_at: string | null;
  trainer_name: string | null;
}

const AttendanceSignatureBlock = ({
  trainingId,
  trainingName,
  trainerName,
  schedules,
  participantsCount,
  participants,
  location,
  startDate,
  endDate,
  onUpdate,
}: AttendanceSignatureBlockProps) => {
  const [signatureStatuses, setSignatureStatuses] = useState<SignatureStatus[]>([]);
  const [trainerSignatures, setTrainerSignatures] = useState<TrainerSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingSlot, setSendingSlot] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showTrainerSignDialog, setShowTrainerSignDialog] = useState(false);
  const [signingSlot, setSigningSlot] = useState<{ date: string; period: "AM" | "PM" } | null>(null);
  const [savingTrainerSig, setSavingTrainerSig] = useState(false);
  const [signaturePadReady, setSignaturePadReady] = useState(false);
  const [signatureInitError, setSignatureInitError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const { toast } = useToast();

  const shouldShowBlock = () => schedules.length > 0;

  useEffect(() => {
    if (shouldShowBlock()) {
      fetchSignatureStatuses();
    } else {
      setLoading(false);
    }
  }, [trainingId, schedules]);

  // Initialize signature pad when dialog opens.
  // Robust 3-level strategy: poll for dimensions → init with try/catch → error fallback.
  const initSignaturePad = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setSignatureInitError(true);
      return () => {};
    }

    setSignaturePadReady(false);
    setSignatureInitError(false);

    // Destroy previous instance
    if (signaturePadRef.current) {
      signaturePadRef.current.off();
      signaturePadRef.current = null;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30; // ~500ms at 60fps

    const tryInit = () => {
      if (cancelled) return;

      try {
        // Use offsetWidth first, fallback to getBoundingClientRect
        let cssWidth = canvas.offsetWidth;
        let cssHeight = canvas.offsetHeight;

        if (cssWidth === 0 || cssHeight === 0) {
          const rect = canvas.getBoundingClientRect();
          cssWidth = rect.width;
          cssHeight = rect.height;
        }

        if (cssWidth > 0 && cssHeight > 0) {
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          canvas.width = cssWidth * ratio;
          canvas.height = cssHeight * ratio;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            console.error("[Signature] Canvas 2D context unavailable");
            setSignatureInitError(true);
            return;
          }
          // Reset any previous transform then apply HiDPI scale
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

          // Create SignaturePad AFTER canvas is properly sized
          signaturePadRef.current = new SignaturePad(canvas, {
            backgroundColor: "rgb(255, 255, 255)",
            penColor: "rgb(0, 0, 0)",
          });
          signaturePadRef.current.clear();

          console.debug("[Signature] Pad ready", {
            cssWidth, cssHeight, ratio,
            canvasWidth: canvas.width, canvasHeight: canvas.height,
          });

          setSignaturePadReady(true);
          return;
        }

        attempts += 1;
        if (attempts < maxAttempts) {
          requestAnimationFrame(tryInit);
        } else {
          console.error("[Signature] Canvas never got dimensions after", maxAttempts, "frames");
          setSignatureInitError(true);
        }
      } catch (err) {
        console.error("[Signature] Init error:", err);
        setSignatureInitError(true);
      }
    };

    // Start polling on next frame (Radix Dialog animation)
    requestAnimationFrame(tryInit);

    return () => {
      cancelled = true;
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
        signaturePadRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!showTrainerSignDialog) {
      setSignaturePadReady(false);
      setSignatureInitError(false);
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
        signaturePadRef.current = null;
      }
      return;
    }

    // Small delay to let Radix Dialog finish mounting & animating
    const timer = setTimeout(() => {
      const cleanup = initSignaturePad();
      return cleanup;
    }, 100);

    return () => {
      clearTimeout(timer);
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
        signaturePadRef.current = null;
      }
    };
  }, [showTrainerSignDialog, initSignaturePad]);

  const fetchSignatureStatuses = async () => {
    try {
      const [sigResult, trainerSigResult] = await Promise.all([
        supabase
          .from("attendance_signatures")
          .select("*")
          .eq("training_id", trainingId),
        supabase
          .from("trainer_attendance_signatures")
          .select("schedule_date, period, signature_data, signed_at, trainer_name")
          .eq("training_id", trainingId),
      ]);

      if (sigResult.error) throw sigResult.error;

      const signatures = sigResult.data;
      const trainerSigs = trainerSigResult.data || [];
      setTrainerSignatures(trainerSigs);

      const trainerSigMap = new Map(
        trainerSigs.map(ts => [`${ts.schedule_date}-${ts.period}`, ts])
      );

      const statuses: SignatureStatus[] = [];

      schedules.forEach(schedule => {
        const startHour = parseInt(schedule.start_time.split(":")[0], 10);
        const endHour = parseInt(schedule.end_time.split(":")[0], 10);
        const endMin = parseInt(schedule.end_time.split(":")[1], 10);

        const periods: ("AM" | "PM")[] = [];
        if (startHour < 13) periods.push("AM");
        if (endHour > 13 || (endHour === 13 && endMin > 30)) periods.push("PM");
        if (periods.length === 0) periods.push("AM");

        periods.forEach(period => {
          const slotSignatures = signatures?.filter(
            s => s.schedule_date === schedule.day_date && s.period === period
          ) || [];

          const trainerSig = trainerSigMap.get(`${schedule.day_date}-${period}`);

          statuses.push({
            date: schedule.day_date,
            period,
            totalSent: slotSignatures.filter(s => s.email_sent_at).length,
            totalSigned: slotSignatures.filter(s => s.signed_at).length,
            hasSent: slotSignatures.some(s => s.email_sent_at),
            trainerSigned: !!trainerSig?.signed_at,
          });
        });
      });

      statuses.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.period === "AM" ? -1 : 1;
      });

      setSignatureStatuses(statuses);
    } catch (err) {
      console.error("Error fetching signature statuses:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendSignatureRequests = async (date: string, period: "AM" | "PM") => {
    const slotKey = `${date}-${period}`;
    setSendingSlot(slotKey);

    try {
      const { data, error } = await supabase.functions.invoke("send-attendance-signature-request", {
        body: {
          trainingId,
          scheduleDate: date,
          period,
        },
      });

      if (error) throw error;

      toast({
        title: "Emails envoyés",
        description: "Les demandes de signature ont été envoyées aux participants.",
      });

      await fetchSignatureStatuses();
    } catch (err) {
      console.error("Error sending signature requests:", err);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'envoi des demandes de signature.",
        variant: "destructive",
      });
    } finally {
      setSendingSlot(null);
    }
  };

  const openTrainerSignDialog = (date: string, period: "AM" | "PM") => {
    setSigningSlot({ date, period });
    setShowTrainerSignDialog(true);
  };

  const handleSaveTrainerSignature = async () => {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty() || !signingSlot) {
      toast({
        title: "Signature manquante",
        description: "Veuillez signer avant de valider.",
        variant: "destructive",
      });
      return;
    }

    setSavingTrainerSig(true);

    try {
      const signatureData = signaturePadRef.current.toDataURL("image/png");

      const { error } = await supabase
        .from("trainer_attendance_signatures")
        .upsert({
          training_id: trainingId,
          schedule_date: signingSlot.date,
          period: signingSlot.period,
          signature_data: signatureData,
          signed_at: new Date().toISOString(),
          trainer_name: trainerName,
        }, {
          onConflict: "training_id,schedule_date,period",
        });

      if (error) throw error;

      toast({
        title: "Signature enregistrée",
        description: "La signature du formateur a été enregistrée.",
      });

      setShowTrainerSignDialog(false);
      setSigningSlot(null);
      await fetchSignatureStatuses();
    } catch (err) {
      console.error("Error saving trainer signature:", err);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la signature.",
        variant: "destructive",
      });
    } finally {
      setSavingTrainerSig(false);
    }
  };

  const handleSignAllSlots = async () => {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      toast({
        title: "Signature manquante",
        description: "Veuillez signer avant de valider.",
        variant: "destructive",
      });
      return;
    }

    setSavingTrainerSig(true);

    try {
      const signatureData = signaturePadRef.current.toDataURL("image/png");
      const unsignedSlots = signatureStatuses.filter(s => !s.trainerSigned);

      for (const slot of unsignedSlots) {
        const { error } = await supabase
          .from("trainer_attendance_signatures")
          .upsert({
            training_id: trainingId,
            schedule_date: slot.date,
            period: slot.period,
            signature_data: signatureData,
            signed_at: new Date().toISOString(),
            trainer_name: trainerName,
          }, {
            onConflict: "training_id,schedule_date,period",
          });

        if (error) throw error;
      }

      toast({
        title: "Signatures enregistrées",
        description: `${unsignedSlots.length} demi-journée(s) signée(s).`,
      });

      setShowTrainerSignDialog(false);
      setSigningSlot(null);
      await fetchSignatureStatuses();
    } catch (err) {
      console.error("Error saving trainer signatures:", err);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les signatures.",
        variant: "destructive",
      });
    } finally {
      setSavingTrainerSig(false);
    }
  };

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

  /** Async: convert PNG signature to optimized JPEG (good quality, reasonable size) */
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
          } catch {
            resolve(dataUrl);
          }
        };
        img.onerror = () => { clearTimeout(timeout); resolve(dataUrl); };
        img.src = dataUrl;
      } catch {
        resolve(dataUrl);
      }
    });
  };

  /** Detect image format from data URL for jsPDF */
  const getImageFormat = (dataUrl: string): string => {
    if (dataUrl.startsWith("data:image/jpeg")) return "JPEG";
    if (dataUrl.startsWith("data:image/png")) return "PNG";
    return "JPEG";
  };

  const handleExportPdf = async (participantId?: string) => {
    setExporting(true);

    try {
      // Fetch data from edge function
      const { data, error } = await supabase.functions.invoke("generate-attendance-pdf", {
        body: { trainingId, participantId },
      });

      if (error) throw error;

      if (!data?.signatures || data.signatures.length === 0) {
        toast({
          title: "Aucune donnée",
          description: "Aucune donnée d'émargement trouvée.",
          variant: "destructive",
        });
        return;
      }

      const training = data.training;
      const signatures = data.signatures;
      const trainerSigs: TrainerSignature[] = data.trainerSignatures || [];

      // Build trainer signature map
      const trainerSigMap = new Map(
        trainerSigs.map(ts => [`${ts.schedule_date}-${ts.period}`, ts])
      );

      // Load logo
      const logoBase64 = await loadImageAsBase64(supertiltLogoJpg);

      // Pre-compress all signature images (PNG → small JPEG) to reduce PDF size
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

      // Generate PDF
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - 2 * margin;

      // Helper: format date in French (uses shared formatters)
      const formatDateTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleString("fr-FR", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        });
      };
      const getPeriodLabel = getPeriodLabelShared;

      // Determine participant name for single-participant export
      let participantName = "";
      if (participantId && signatures.length > 0) {
        const p = signatures[0].participant;
        participantName = `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email;
      }

      // ── Page header ──
      doc.addImage(logoBase64, "JPEG", margin, 8, 35, 13);

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Feuille d'émargement", pageWidth / 2, 16, { align: "center" });

      // Yellow accent line
      doc.setDrawColor(234, 179, 8);
      doc.setLineWidth(0.8);
      doc.line(margin, 24, pageWidth - margin, 24);

      // ── Meta info ──
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
      if (participantId) {
        drawMetaField("Participant :", participantName);
      }

      yPos += 3;

      // ── Group signatures by slot ──
      const groupedBySlot = new Map<string, typeof signatures>();
      for (const sig of signatures) {
        const key = `${sig.schedule_date}-${sig.period}`;
        if (!groupedBySlot.has(key)) groupedBySlot.set(key, []);
        groupedBySlot.get(key)!.push(sig);
      }
      const sortedSlots = Array.from(groupedBySlot.entries()).sort((a, b) => a[0].localeCompare(b[0]));

      if (participantId) {
        // ── Single participant view ──
        const colWidths = [30, 30, 20, contentWidth - 80];
        const headers = ["Date", "Demi-journée", "Statut", "Signature"];

        // Table header
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
          if (yPos + rowHeight > pageHeight - 30) {
            doc.addPage();
            yPos = margin;
          }

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
        // ── Full session view: one table per slot ──
        for (const [slotKey, slotSignatures] of sortedSlots) {
          const [date, period] = slotKey.split("-");
          const signedCount = slotSignatures.filter(s => s.signed_at).length;
          const trainerSig = trainerSigMap.get(slotKey);

          // Check if we need a new page (header + at least 1 row + trainer section)
          const estimatedHeight = 8 + (slotSignatures.length * 18) + 25;
          if (yPos + Math.min(estimatedHeight, 50) > pageHeight - 30) {
            doc.addPage();
            yPos = margin;
          }

          // Slot header
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

          // Table header
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

          // Rows
          for (const sig of slotSignatures) {
            const rowHeight = 18;
            if (yPos + rowHeight > pageHeight - 30) {
              doc.addPage();
              yPos = margin;
            }

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
          if (yPos + 20 > pageHeight - 30) {
            doc.addPage();
            yPos = margin;
          }

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

      // ── Legal notice ──
      if (yPos + 25 > pageHeight - 15) {
        doc.addPage();
        yPos = margin;
      }

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
      doc.text(
        "Ces signatures électroniques ont valeur légale conformément au règlement européen eIDAS (UE n° 910/2014).",
        margin + 2, yPos + 9
      );
      doc.text(
        "Chaque signature est horodatée et associée à l'identité du signataire (email, adresse IP, navigateur).",
        margin + 2, yPos + 13
      );
      doc.setTextColor(0, 0, 0);

      yPos += 20;
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Document généré le ${new Date().toLocaleString("fr-FR")} — SuperTilt`,
        pageWidth / 2, yPos, { align: "center" }
      );
      doc.setTextColor(0, 0, 0);

      // ── Generate file ──
      const safeName = trainingName.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s-]/g, "").replace(/\s+/g, "_");
      const dateStr = format(parseISO(startDate), "yyyy-MM-dd");
      const filename = participantId
        ? `Emargement_${participantName.replace(/\s+/g, "_")}_${safeName}_${dateStr}.pdf`
        : `Emargement_${safeName}_${dateStr}.pdf`;

      // Download
      doc.save(filename);

      // Upload to storage and replace previous electronic attendance sheet (full session only)
      if (!participantId) {
        try {
          const pdfBlob = doc.output("blob");
          const storagePath = `${trainingId}/emargement_electronique_${Date.now()}.pdf`;

          // Fetch current URLs to find and remove old electronic attendance sheets
          const { data: trainingData } = await supabase
            .from("trainings")
            .select("attendance_sheets_urls")
            .eq("id", trainingId)
            .single();

          const currentUrls: string[] = (trainingData?.attendance_sheets_urls as string[]) || [];

          // Remove old electronic attendance sheets from storage
          const oldElectronicUrls = currentUrls.filter(url => url.includes("/emargement_electronique_"));
          for (const oldUrl of oldElectronicUrls) {
            try {
              const oldPath = oldUrl.split("/training-documents/").pop();
              if (oldPath) {
                await supabase.storage.from("training-documents").remove([decodeURIComponent(oldPath)]);
              }
            } catch {
              // Non-blocking: old file cleanup is best-effort
            }
          }

          const { error: uploadError } = await supabase.storage
            .from("training-documents")
            .upload(storagePath, pdfBlob, { contentType: "application/pdf" });

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from("training-documents")
              .getPublicUrl(storagePath);

            // Keep non-electronic URLs, replace with new one
            const nonElectronicUrls = currentUrls.filter(url => !url.includes("/emargement_electronique_"));
            const newUrls = [...nonElectronicUrls, publicUrl];

            await supabase
              .from("trainings")
              .update({ attendance_sheets_urls: newUrls })
              .eq("id", trainingId);

            onUpdate?.();
          }
        } catch (uploadErr) {
          console.error("Error uploading PDF to storage:", uploadErr);
          // Non-blocking: PDF was already downloaded
        }
      }

      toast({
        title: "PDF exporté",
        description: participantId
          ? "La feuille d'émargement a été téléchargée."
          : "La feuille d'émargement a été téléchargée et ajoutée aux documents.",
      });

    } catch (err) {
      console.error("Error exporting attendance PDF:", err);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'export.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const formatSlotDate = formatDateSlot;

  const getPeriodLabel = getPeriodLabelShared;

  const getParticipantName = (p: { first_name: string | null; last_name: string | null; email: string }) => {
    const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
    return name || p.email;
  };

  const totalExpected = signatureStatuses.length * participantsCount;
  const totalSigned = signatureStatuses.reduce((sum, s) => sum + s.totalSigned, 0);
  const totalTrainerSigned = signatureStatuses.filter(s => s.trainerSigned).length;
  const hasUnsignedTrainerSlots = signatureStatuses.some(s => !s.trainerSigned);

  if (!shouldShowBlock() || loading) {
    if (loading) {
      return (
        <Card>
          <CardContent className="py-6">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  if (signatureStatuses.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PenLine className="h-5 w-5" />
                Émargement électronique
              </CardTitle>
              <CardDescription>
                Envoyez les demandes de signature pour chaque demi-journée
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {/* Trainer sign all button */}
              {hasUnsignedTrainerSlots && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSigningSlot(null);
                    setShowTrainerSignDialog(true);
                  }}
                >
                  <UserPen className="h-4 w-4 mr-2" />
                  Signer (formateur)
                </Button>
              )}

              {/* Export dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={exporting}>
                    {exporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Exporter PDF
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Exporter les émargements</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExportPdf()}>
                    <FileDown className="h-4 w-4 mr-2" />
                    Toute la session ({totalSigned}/{totalExpected} signatures)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Par participant
                  </DropdownMenuLabel>
                  {participants.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => handleExportPdf(p.id)}
                    >
                      {getParticipantName(p)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {signatureStatuses.map((status) => {
              const slotKey = `${status.date}-${status.period}`;
              const isSending = sendingSlot === slotKey;
              const isComplete = status.totalSigned === participantsCount && participantsCount > 0;

              return (
                <div
                  key={slotKey}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <span className="font-medium">{formatSlotDate(status.date)}</span>
                      <span className="text-muted-foreground ml-2">{getPeriodLabel(status.period)}</span>
                    </div>
                    <Badge variant={isComplete ? "default" : "secondary"} className="text-xs">
                      {status.totalSigned}/{participantsCount} signés
                    </Badge>
                    {status.trainerSigned ? (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                        <Check className="h-3 w-3 mr-1" />
                        Formateur
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs text-orange-500 border-orange-200 cursor-pointer hover:bg-orange-50"
                        onClick={() => openTrainerSignDialog(status.date, status.period)}
                      >
                        <UserPen className="h-3 w-3 mr-1" />
                        Signer
                      </Badge>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant={status.hasSent ? "outline" : "default"}
                    onClick={() => handleSendSignatureRequests(status.date, status.period)}
                    disabled={isSending || isComplete}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Envoi...
                      </>
                    ) : isComplete ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Complet
                      </>
                    ) : status.hasSent ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Renvoyer
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1" />
                        Envoyer
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Trainer signature summary */}
          <div className="mt-3 text-xs text-muted-foreground">
            Formateur : {totalTrainerSigned}/{signatureStatuses.length} demi-journée(s) signée(s)
          </div>
        </CardContent>
      </Card>

      {/* Trainer Signature Dialog */}
      <Dialog open={showTrainerSignDialog} onOpenChange={(open) => {
        if (!open) {
          setShowTrainerSignDialog(false);
          setSigningSlot(null);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPen className="h-5 w-5" />
              Signature du formateur
            </DialogTitle>
            <DialogDescription>
              {signingSlot
                ? `Signez pour le ${formatSlotDate(signingSlot.date)} — ${getPeriodLabel(signingSlot.period)}`
                : `Signez pour toutes les demi-journées non signées (${signatureStatuses.filter(s => !s.trainerSigned).length})`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="border rounded-lg overflow-hidden bg-white relative">
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ height: "180px", touchAction: "none" }}
            />
            {!signaturePadReady && !signatureInitError && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Initialisation de la zone de signature…
                </div>
              </div>
            )}
            {signatureInitError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 gap-2">
                <p className="text-sm text-destructive">
                  Impossible d'initialiser la zone de signature.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => initSignaturePad()}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Réessayer
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signaturePadRef.current?.clear()}
              disabled={!signaturePadReady}
            >
              Effacer
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTrainerSignDialog(false);
                  setSigningSlot(null);
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={signingSlot ? handleSaveTrainerSignature : handleSignAllSlots}
                disabled={savingTrainerSig || !signaturePadReady}
              >
                {savingTrainerSig ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PenLine className="h-4 w-4 mr-2" />
                )}
                {signingSlot ? "Valider" : "Signer tout"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AttendanceSignatureBlock;
