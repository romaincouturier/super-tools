import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import SignaturePad from "signature_pad";
import type { SignatureStatus, TrainerSignature } from "./types";

interface UseAttendanceSignaturesOptions {
  trainingId: string;
  trainingName: string;
  trainerName: string;
  schedules: Array<{ id: string; day_date: string; start_time: string; end_time: string }>;
  participantsCount: number;
  onUpdate?: () => void;
}

export function useAttendanceSignatures({
  trainingId,
  trainerName,
  schedules,
  participantsCount,
  onUpdate,
}: UseAttendanceSignaturesOptions) {
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

  const initSignaturePad = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setSignatureInitError(true);
      return () => {};
    }

    setSignaturePadReady(false);
    setSignatureInitError(false);

    if (signaturePadRef.current) {
      signaturePadRef.current.off();
      signaturePadRef.current = null;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;

    const tryInit = () => {
      if (cancelled) return;
      try {
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
          if (!ctx) { setSignatureInitError(true); return; }
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          signaturePadRef.current = new SignaturePad(canvas, {
            backgroundColor: "rgb(255, 255, 255)",
            penColor: "rgb(0, 0, 0)",
          });
          signaturePadRef.current.clear();
          setSignaturePadReady(true);
          return;
        }
        attempts += 1;
        if (attempts < maxAttempts) {
          requestAnimationFrame(tryInit);
        } else {
          setSignatureInitError(true);
        }
      } catch {
        setSignatureInitError(true);
      }
    };

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
    const timer = setTimeout(() => { initSignaturePad(); }, 100);
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
        supabase.from("attendance_signatures").select("*").eq("training_id", trainingId),
        supabase.from("trainer_attendance_signatures")
          .select("schedule_date, period, signature_data, signed_at, trainer_name")
          .eq("training_id", trainingId),
      ]);
      if (sigResult.error) throw sigResult.error;

      const signatures = sigResult.data;
      const trainerSigs = trainerSigResult.data || [];
      setTrainerSignatures(trainerSigs);

      const trainerSigMap = new Map(trainerSigs.map(ts => [`${ts.schedule_date}-${ts.period}`, ts]));
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
      const { error } = await supabase.functions.invoke("send-attendance-signature-request", {
        body: { trainingId, scheduleDate: date, period },
      });
      if (error) throw error;
      toast({ title: "Emails envoyés", description: "Les demandes de signature ont été envoyées aux participants." });
      await fetchSignatureStatuses();
    } catch (err) {
      console.error("Error sending signature requests:", err);
      toastError(toast, "Une erreur est survenue lors de l'envoi des demandes de signature.");
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
      toastError(toast, "Veuillez signer avant de valider.", { title: "Signature manquante" });
      return;
    }
    setSavingTrainerSig(true);
    try {
      const signatureData = signaturePadRef.current.toDataURL("image/png");
      const { error } = await supabase.from("trainer_attendance_signatures").upsert({
        training_id: trainingId,
        schedule_date: signingSlot.date,
        period: signingSlot.period,
        signature_data: signatureData,
        signed_at: new Date().toISOString(),
        trainer_name: trainerName,
      }, { onConflict: "training_id,schedule_date,period" });
      if (error) throw error;
      toast({ title: "Signature enregistrée", description: "La signature du formateur a été enregistrée." });
      setShowTrainerSignDialog(false);
      setSigningSlot(null);
      await fetchSignatureStatuses();
    } catch (err) {
      console.error("Error saving trainer signature:", err);
      toastError(toast, "Impossible d'enregistrer la signature.");
    } finally {
      setSavingTrainerSig(false);
    }
  };

  const handleSignAllSlots = async () => {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      toastError(toast, "Veuillez signer avant de valider.", { title: "Signature manquante" });
      return;
    }
    setSavingTrainerSig(true);
    try {
      const signatureData = signaturePadRef.current.toDataURL("image/png");
      const unsignedSlots = signatureStatuses.filter(s => !s.trainerSigned);
      for (const slot of unsignedSlots) {
        const { error } = await supabase.from("trainer_attendance_signatures").upsert({
          training_id: trainingId,
          schedule_date: slot.date,
          period: slot.period,
          signature_data: signatureData,
          signed_at: new Date().toISOString(),
          trainer_name: trainerName,
        }, { onConflict: "training_id,schedule_date,period" });
        if (error) throw error;
      }
      toast({ title: "Signatures enregistrées", description: `${unsignedSlots.length} demi-journée(s) signée(s).` });
      setShowTrainerSignDialog(false);
      setSigningSlot(null);
      await fetchSignatureStatuses();
    } catch (err) {
      console.error("Error saving trainer signatures:", err);
      toastError(toast, "Impossible d'enregistrer les signatures.");
    } finally {
      setSavingTrainerSig(false);
    }
  };

  const totalExpected = signatureStatuses.length * participantsCount;
  const totalSigned = signatureStatuses.reduce((sum, s) => sum + s.totalSigned, 0);
  const totalTrainerSigned = signatureStatuses.filter(s => s.trainerSigned).length;
  const hasUnsignedTrainerSlots = signatureStatuses.some(s => !s.trainerSigned);

  return {
    signatureStatuses,
    trainerSignatures,
    loading,
    sendingSlot,
    exporting,
    setExporting,
    showTrainerSignDialog,
    setShowTrainerSignDialog,
    signingSlot,
    setSigningSlot,
    savingTrainerSig,
    signaturePadReady,
    signatureInitError,
    canvasRef,
    signaturePadRef,
    shouldShowBlock,
    handleSendSignatureRequests,
    openTrainerSignDialog,
    handleSaveTrainerSignature,
    handleSignAllSlots,
    initSignaturePad,
    totalExpected,
    totalSigned,
    totalTrainerSigned,
    hasUnsignedTrainerSlots,
    toast,
    fetchSignatureStatuses,
    onUpdate,
  };
}
