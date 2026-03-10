import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { capitalizeName } from "@/lib/stringUtils";
import type { FormationFormula } from "@/types/training";
import {
  updateParticipant,
  updateParticipantEvaluation,
  fetchConventionSignature,
  fetchParticipantFiles,
  fetchExistingFinanceurs,
  fetchCouponCode,
  uploadParticipantFile,
  deleteParticipantFile,
  uploadSignedConvention,
  deleteSignedConvention,
} from "@/services/participants";
import type {
  ParticipantFile,
  ConventionSignatureStatus,
} from "@/services/participants";

export interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  sponsor_first_name?: string | null;
  sponsor_last_name?: string | null;
  sponsor_email?: string | null;
  financeur_same_as_sponsor?: boolean;
  financeur_name?: string | null;
  financeur_url?: string | null;
  payment_mode?: string;
  sold_price_ht?: number | null;
  signed_convention_url?: string | null;
  elearning_duration?: number | null;
  notes?: string | null;
  formula?: string | null;
  formula_id?: string | null;
  coaching_sessions_total?: number;
  coaching_sessions_completed?: number;
  coaching_deadline?: string | null;
}

export interface UseEditParticipantOptions {
  participant: Participant;
  trainingId: string;
  formatFormation?: string | null;
  isInterEntreprise: boolean;
  trainingElearningDuration?: number | null;
  availableFormulas: FormationFormula[];
  formulaAllowsCoaching: boolean;
  onParticipantUpdated: () => void;
}

export function useEditParticipant({
  participant,
  trainingId,
  formatFormation,
  isInterEntreprise,
  trainingElearningDuration,
  availableFormulas,
  formulaAllowsCoaching,
  onParticipantUpdated,
}: UseEditParticipantOptions) {
  const { toast } = useToast();

  // --- Form state ---
  const [open, setOpen] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [firstName, setFirstName] = useState(participant.first_name || "");
  const [lastName, setLastName] = useState(participant.last_name || "");
  const [email, setEmail] = useState(participant.email);
  const [company, setCompany] = useState(participant.company || "");
  const [sponsorFirstName, setSponsorFirstName] = useState(participant.sponsor_first_name || "");
  const [sponsorLastName, setSponsorLastName] = useState(participant.sponsor_last_name || "");
  const [sponsorEmail, setSponsorEmail] = useState(participant.sponsor_email || "");
  const [financeurSameAsSponsor, setFinanceurSameAsSponsor] = useState(
    participant.financeur_same_as_sponsor ?? true,
  );
  const [financeurName, setFinanceurName] = useState(participant.financeur_name || "");
  const [financeurUrl, setFinanceurUrl] = useState(participant.financeur_url || "");
  const [paymentMode, setPaymentMode] = useState<"online" | "invoice">(
    (participant.payment_mode as "online" | "invoice") || "invoice",
  );
  const [soldPriceHt, setSoldPriceHt] = useState(
    participant.sold_price_ht != null ? String(participant.sold_price_ht) : "",
  );
  const [elearningDuration, setElearningDuration] = useState(
    participant.elearning_duration != null
      ? String(participant.elearning_duration)
      : trainingElearningDuration != null
        ? String(trainingElearningDuration)
        : "",
  );
  const [notes, setNotes] = useState(participant.notes || "");
  const [formula, setFormula] = useState(participant.formula || "");
  const [coachingSessionsTotal, setCoachingSessionsTotal] = useState(
    participant.coaching_sessions_total != null
      ? String(participant.coaching_sessions_total)
      : "0",
  );

  // --- Async data state ---
  const [financeurPopoverOpen, setFinanceurPopoverOpen] = useState(false);
  const [existingFinanceurs, setExistingFinanceurs] = useState<string[]>([]);
  const [signedConventionUrl, setSignedConventionUrl] = useState(
    participant.signed_convention_url || null,
  );
  const [uploadingConvention, setUploadingConvention] = useState(false);
  const [conventionSignature, setConventionSignature] =
    useState<ConventionSignatureStatus | null>(null);
  const [participantFiles, setParticipantFiles] = useState<ParticipantFile[]>(
    [],
  );
  const [uploadingFile, setUploadingFile] = useState(false);
  const [couponCode, setCouponCode] = useState<string | null>(null);

  // --- Auto-save refs ---
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedHashRef = useRef("");
  const formValuesRef = useRef<Record<string, unknown>>({});

  // Always keep latest values in ref
  formValuesRef.current = {
    firstName,
    lastName,
    email,
    company,
    sponsorFirstName,
    sponsorLastName,
    sponsorEmail,
    financeurSameAsSponsor,
    financeurName,
    financeurUrl,
    paymentMode,
    soldPriceHt,
    elearningDuration,
    notes,
    formula,
    coachingSessionsTotal,
  };

  const formHash = JSON.stringify(formValuesRef.current);

  // --- Build update data from form values ---
  const buildUpdateData = useCallback(
    (v: {
      firstName: string;
      lastName: string;
      email: string;
      company: string;
      sponsorFirstName: string;
      sponsorLastName: string;
      sponsorEmail: string;
      financeurSameAsSponsor: boolean;
      financeurName: string;
      financeurUrl: string;
      paymentMode: string;
      soldPriceHt: string;
      elearningDuration: string;
      notes: string;
      formula: string;
      coachingSessionsTotal: string;
    }): Record<string, unknown> => {
      const updateData: Record<string, unknown> = {
        first_name: capitalizeName(v.firstName) || null,
        last_name: capitalizeName(v.lastName) || null,
        email: v.email.trim().toLowerCase(),
        company: v.company.trim() || null,
      };

      if (isInterEntreprise) {
        updateData.notes = v.notes.trim() || null;
        updateData.sponsor_first_name = v.sponsorFirstName.trim() || null;
        updateData.sponsor_last_name = v.sponsorLastName.trim() || null;
        updateData.sponsor_email =
          v.sponsorEmail.trim().toLowerCase() || null;
        updateData.financeur_same_as_sponsor = v.financeurSameAsSponsor;
        updateData.financeur_name = !v.financeurSameAsSponsor
          ? v.financeurName.trim() || null
          : null;
        updateData.financeur_url = !v.financeurSameAsSponsor
          ? v.financeurUrl.trim() || null
          : null;
        updateData.payment_mode = v.paymentMode;
        updateData.sold_price_ht = v.soldPriceHt
          ? parseFloat(v.soldPriceHt)
          : null;
        if (formatFormation === "e_learning") {
          updateData.elearning_duration = v.elearningDuration
            ? parseFloat(v.elearningDuration)
            : null;
        }
        if (availableFormulas.length > 0) {
          updateData.formula = v.formula || null;
        }
      }

      if (formulaAllowsCoaching) {
        updateData.coaching_sessions_total = v.coachingSessionsTotal
          ? parseInt(v.coachingSessionsTotal, 10)
          : 0;
      }

      return updateData;
    },
    [isInterEntreprise, formatFormation, availableFormulas.length, formulaAllowsCoaching],
  );

  // --- Auto-save effect ---
  useEffect(() => {
    if (!open) return;
    if (formHash === lastSavedHashRef.current) return;

    if (!lastSavedHashRef.current) {
      lastSavedHashRef.current = formHash;
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      const v = formValuesRef.current as Parameters<typeof buildUpdateData>[0];
      if (!v.email.trim()) return;

      setAutoSaving(true);
      try {
        const updateData = buildUpdateData(v);

        const { error } = await updateParticipant(participant.id, updateData);

        if (error) {
          if (error.code === "23505") {
            toast({
              title: "Email en double",
              description:
                "Un autre participant avec cet email est déjà inscrit à cette formation.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
          return;
        }

        await updateParticipantEvaluation(participant.id, {
          email: v.email.trim().toLowerCase(),
          first_name: capitalizeName(v.firstName) || null,
          last_name: capitalizeName(v.lastName) || null,
          company: v.company.trim() || null,
        });

        lastSavedHashRef.current = formHash;
        setLastSaved(new Date());
        onParticipantUpdated();
      } catch (error) {
        console.error("Auto-save error:", error);
      } finally {
        setAutoSaving(false);
      }
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formHash, open]);

  // --- Reset form values when participant changes ---
  useEffect(() => {
    setFirstName(participant.first_name || "");
    setLastName(participant.last_name || "");
    setEmail(participant.email);
    setCompany(participant.company || "");
    setSponsorFirstName(participant.sponsor_first_name || "");
    setSponsorLastName(participant.sponsor_last_name || "");
    setSponsorEmail(participant.sponsor_email || "");
    setFinanceurSameAsSponsor(participant.financeur_same_as_sponsor ?? true);
    setFinanceurName(participant.financeur_name || "");
    setFinanceurUrl(participant.financeur_url || "");
    setPaymentMode(
      (participant.payment_mode as "online" | "invoice") || "invoice",
    );
    setSoldPriceHt(
      participant.sold_price_ht != null
        ? String(participant.sold_price_ht)
        : "",
    );
    setElearningDuration(
      participant.elearning_duration != null
        ? String(participant.elearning_duration)
        : trainingElearningDuration != null
          ? String(trainingElearningDuration)
          : "",
    );
    setSignedConventionUrl(participant.signed_convention_url || null);
    setNotes(participant.notes || "");
    setFormula(participant.formula || "");
    setCoachingSessionsTotal(
      participant.coaching_sessions_total != null
        ? String(participant.coaching_sessions_total)
        : "0",
    );
    lastSavedHashRef.current = "";
    setLastSaved(null);
  }, [participant, trainingElearningDuration]);

  // --- Fetch convention signature ---
  useEffect(() => {
    if (!open || !isInterEntreprise || !participant.sponsor_email) return;

    fetchConventionSignature(trainingId, participant.sponsor_email).then(
      (data) => {
        if (data) setConventionSignature(data);
      },
    );
  }, [open, isInterEntreprise, trainingId, participant.sponsor_email]);

  // --- Fetch participant files ---
  useEffect(() => {
    if (!open || !isInterEntreprise) return;

    fetchParticipantFiles(participant.id).then(setParticipantFiles);
  }, [open, isInterEntreprise, participant.id]);

  // --- Fetch existing financeurs ---
  useEffect(() => {
    if (!open || !isInterEntreprise) return;

    fetchExistingFinanceurs().then(setExistingFinanceurs);
  }, [open, isInterEntreprise]);

  // --- Fetch WooCommerce coupon ---
  useEffect(() => {
    if (!open || formatFormation !== "e_learning") return;

    fetchCouponCode(participant.id).then(setCouponCode);
  }, [open, formatFormation, participant.id]);

  // --- File upload handler ---
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setUploadingFile(true);
      const uploadedFiles: ParticipantFile[] = [];
      let errorCount = 0;

      try {
        for (const file of Array.from(files)) {
          try {
            const uploaded = await uploadParticipantFile(
              trainingId,
              participant.id,
              file,
            );
            uploadedFiles.push(uploaded);
          } catch (err) {
            console.error(`File upload error for ${file.name}:`, err);
            errorCount++;
          }
        }

        if (uploadedFiles.length > 0) {
          setParticipantFiles((prev) => [...uploadedFiles, ...prev]);
          toast({
            title: `${uploadedFiles.length} fichier${uploadedFiles.length > 1 ? "s" : ""} ajouté${uploadedFiles.length > 1 ? "s" : ""}`,
            ...(errorCount > 0 && {
              description: `${errorCount} fichier${errorCount > 1 ? "s" : ""} en erreur.`,
              variant: "destructive" as const,
            }),
          });
        } else if (errorCount > 0) {
          toast({
            title: "Erreur d'upload",
            description: "Aucun fichier n'a pu être uploadé.",
            variant: "destructive",
          });
        }
      } finally {
        setUploadingFile(false);
        e.target.value = "";
      }
    },
    [trainingId, participant.id, toast],
  );

  // --- File delete handler ---
  const handleDeleteFile = useCallback(
    async (fileToDelete: ParticipantFile) => {
      try {
        await deleteParticipantFile(fileToDelete);
        setParticipantFiles((prev) =>
          prev.filter((f) => f.id !== fileToDelete.id),
        );
        toast({ title: "Fichier supprimé" });
      } catch (err) {
        console.error("Delete file error:", err);
        toast({
          title: "Erreur",
          description: "Impossible de supprimer le fichier.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  // --- Convention upload handler ---
  const handleConventionUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.includes("pdf")) {
        toast({
          title: "Format non supporté",
          description: "Seuls les fichiers PDF sont acceptés.",
          variant: "destructive",
        });
        return;
      }
      setUploadingConvention(true);
      try {
        const publicUrl = await uploadSignedConvention(
          trainingId,
          participant.id,
          file,
        );
        setSignedConventionUrl(publicUrl);
        onParticipantUpdated();
        toast({ title: "Convention uploadée" });
      } catch (err) {
        console.error(err);
        toast({
          title: "Erreur d'upload",
          description:
            err instanceof Error ? err.message : "Erreur.",
          variant: "destructive",
        });
      } finally {
        setUploadingConvention(false);
      }
    },
    [trainingId, participant.id, onParticipantUpdated, toast],
  );

  // --- Convention delete handler ---
  const handleConventionDelete = useCallback(async () => {
    if (!signedConventionUrl) return;
    try {
      await deleteSignedConvention(participant.id, signedConventionUrl);
      setSignedConventionUrl(null);
      onParticipantUpdated();
      toast({ title: "Convention supprimée" });
    } catch (err) {
      console.error(err);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer.",
        variant: "destructive",
      });
    }
  }, [signedConventionUrl, participant.id, onParticipantUpdated, toast]);

  // --- Flush pending auto-save and close ---
  const handleClose = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      if (formHash !== lastSavedHashRef.current && email.trim()) {
        const v = formValuesRef.current as Parameters<
          typeof buildUpdateData
        >[0];
        const updateData = buildUpdateData(v);
        updateParticipant(participant.id, updateData).then(
          () => onParticipantUpdated(),
          console.error,
        );
      }
    }
    setOpen(false);
    onParticipantUpdated();
  }, [formHash, email, participant.id, buildUpdateData, onParticipantUpdated]);

  return {
    // Dialog
    open,
    setOpen,
    handleClose,

    // Auto-save status
    autoSaving,
    lastSaved,

    // Participant form fields
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    company,
    setCompany,

    // Sponsor fields
    sponsorFirstName,
    setSponsorFirstName,
    sponsorLastName,
    setSponsorLastName,
    sponsorEmail,
    setSponsorEmail,

    // Financeur fields
    financeurSameAsSponsor,
    setFinanceurSameAsSponsor,
    financeurName,
    setFinanceurName,
    financeurUrl,
    setFinanceurUrl,
    financeurPopoverOpen,
    setFinanceurPopoverOpen,
    existingFinanceurs,

    // Payment & pricing
    paymentMode,
    setPaymentMode,
    soldPriceHt,
    setSoldPriceHt,
    elearningDuration,
    setElearningDuration,

    // Notes
    notes,
    setNotes,

    // Formula & coaching
    formula,
    setFormula,
    coachingSessionsTotal,
    setCoachingSessionsTotal,

    // Convention
    signedConventionUrl,
    uploadingConvention,
    conventionSignature,
    handleConventionUpload,
    handleConventionDelete,

    // Files
    participantFiles,
    uploadingFile,
    handleFileUpload,
    handleDeleteFile,

    // Coupon
    couponCode,
  };
}
