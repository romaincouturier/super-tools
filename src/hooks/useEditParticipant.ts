import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { capitalizeName } from "@/lib/stringUtils";
import type { FormationFormula } from "@/types/training";
import {
  updateParticipant,
  updateParticipantEvaluation,
} from "@/services/participants";

import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";
import type { AutoSaveFormValues } from "@/hooks/useAutoSaveForm";
import { useParticipantForm } from "@/hooks/participants/useParticipantForm";
import { useSponsorInfo } from "@/hooks/participants/useSponsorInfo";
import { useFinanceurInfo } from "@/hooks/participants/useFinanceurInfo";
import { usePaymentInfo } from "@/hooks/participants/usePaymentInfo";
import { useParticipantFiles } from "@/hooks/participants/useParticipantFiles";
import { useParticipantConvention } from "@/hooks/participants/useParticipantConvention";

export interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  company_address?: string | null;
  company_zip?: string | null;
  company_city?: string | null;
  sponsor_first_name?: string | null;
  sponsor_last_name?: string | null;
  sponsor_email?: string | null;
  sponsor_phone?: string | null;
  financeur_same_as_sponsor?: boolean;
  financeur_name?: string | null;
  financeur_url?: string | null;
  payment_mode?: string;
  sold_price_ht?: number | null;
  signed_convention_url?: string | null;
  notes?: string | null;
  formula?: string | null;
  formula_id?: string | null;
  coaching_sessions_total?: number;
  coaching_sessions_completed?: number;
  coaching_deadline?: string | null;
  repositioned_to_training_id?: string | null;
  repositioned_at?: string | null;
  type_stagiaire_bpf?: string | null;
  source_financement_bpf?: string | null;
}

export interface UseEditParticipantOptions {
  participant: Participant;
  trainingId: string;
  formatFormation?: string | null;
  isInterEntreprise: boolean;
  availableFormulas: FormationFormula[];
  onParticipantUpdated: () => void;
}

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  companyAddress: string;
  companyZip: string;
  companyCity: string;
  sponsorFirstName: string;
  sponsorLastName: string;
  sponsorEmail: string;
  sponsorPhone: string;
  financeurSameAsSponsor: boolean;
  financeurName: string;
  financeurUrl: string;
  paymentMode: string;
  soldPriceHt: string;
  notes: string;
  formula: string;
  coachingSessionsTotal: string;
  typeStagiaireBpf: string;
  sourceFinancementBpf: string;
}

export function useEditParticipant({
  participant,
  trainingId,
  formatFormation,
  isInterEntreprise,
  availableFormulas,
  onParticipantUpdated,
}: UseEditParticipantOptions) {
  const { toast } = useToast();

  // --- Dialog state ---
  const [open, setOpen] = useState(false);

  // --- Notes & formula (small enough to keep here) ---
  const [notes, setNotes] = useState(participant.notes || "");
  const [formula, setFormula] = useState(participant.formula || "");
  const [typeStagiaireBpf, setTypeStagiaireBpf] = useState(participant.type_stagiaire_bpf || "");
  const [sourceFinancementBpf, setSourceFinancementBpf] = useState(participant.source_financement_bpf || "");

  // Dérive la formule sélectionnée depuis la valeur courante du champ (pas depuis
  // participant.formula_id qui est stale si l'utilisateur vient de changer la formule).
  const selectedFormula = availableFormulas.find((f) => f.name === formula)
    ?? availableFormulas.find((f) => f.id === participant.formula_id);
  const formulaAllowsCoaching = (selectedFormula?.coaching_sessions_count ?? 0) > 0;
  const [coachingSessionsTotal, setCoachingSessionsTotal] = useState(
    participant.coaching_sessions_total != null
      ? String(participant.coaching_sessions_total)
      : "0",
  );

  // --- Sub-hooks ---
  const participantForm = useParticipantForm({ participant });
  const sponsorInfo = useSponsorInfo({ participant });
  const financeurInfo = useFinanceurInfo({ participant, open, isInterEntreprise });
  const paymentInfo = usePaymentInfo({
    participant,
    open,
    formatFormation,
  });
  const filesHook = useParticipantFiles({
    participantId: participant.id,
    trainingId,
    open,
    isInterEntreprise,
  });
  const conventionHook = useParticipantConvention({
    participantId: participant.id,
    trainingId,
    open,
    isInterEntreprise,
    sponsorEmail: participant.sponsor_email,
    initialSignedConventionUrl: participant.signed_convention_url || null,
    onParticipantUpdated,
  });

  // --- Reset local fields when participant changes ---
  useEffect(() => {
    setNotes(participant.notes || "");
    setFormula(participant.formula || "");
    setTypeStagiaireBpf(participant.type_stagiaire_bpf || "");
    setSourceFinancementBpf(participant.source_financement_bpf || "");
    setCoachingSessionsTotal(
      participant.coaching_sessions_total != null
        ? String(participant.coaching_sessions_total)
        : "0",
    );
  }, [participant]);

  // --- Build update data from form values ---
  const buildUpdateData = useCallback(
    (v: FormValues): Record<string, unknown> => {
      const updateData: Record<string, unknown> = {
        first_name: capitalizeName(v.firstName) || null,
        last_name: capitalizeName(v.lastName) || null,
        email: v.email.trim().toLowerCase(),
        company: v.company.trim() || null,
        type_stagiaire_bpf: v.typeStagiaireBpf || null,
        source_financement_bpf: v.sourceFinancementBpf || null,
      };

      if (isInterEntreprise) {
        updateData.company_address = v.companyAddress.trim() || null;
        updateData.company_zip = v.companyZip.trim() || null;
        updateData.company_city = v.companyCity.trim() || null;
      }

      if (isInterEntreprise) {
        updateData.notes = v.notes.trim() || null;
        updateData.sponsor_first_name = v.sponsorFirstName.trim() || null;
        updateData.sponsor_last_name = v.sponsorLastName.trim() || null;
        updateData.sponsor_email =
          v.sponsorEmail.trim().toLowerCase() || null;
        updateData.sponsor_phone = v.sponsorPhone.trim() || null;
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
        if (availableFormulas.length > 0) {
          updateData.formula = v.formula || null;
          const matched = availableFormulas.find((f) => f.name === v.formula);
          updateData.formula_id = matched?.id ?? null;
        }
      }

      // Toujours sauvegarder coaching_sessions_total quand le champ est visible
      // (formulaAllowsCoaching n'est qu'une contrainte UI, pas DB)
      if (formulaAllowsCoaching) {
        updateData.coaching_sessions_total = v.coachingSessionsTotal
          ? parseInt(v.coachingSessionsTotal, 10)
          : 0;
      }

      return updateData;
    },
    [isInterEntreprise, availableFormulas, formulaAllowsCoaching],
  );

  // --- Compose form values for auto-save tracking ---
  const formValues: AutoSaveFormValues = useMemo(() => ({
    firstName: participantForm.firstName,
    lastName: participantForm.lastName,
    email: participantForm.email,
    company: participantForm.company,
    companyAddress: participantForm.companyAddress,
    companyZip: participantForm.companyZip,
    companyCity: participantForm.companyCity,
    sponsorFirstName: sponsorInfo.sponsorFirstName,
    sponsorLastName: sponsorInfo.sponsorLastName,
    sponsorEmail: sponsorInfo.sponsorEmail,
    sponsorPhone: sponsorInfo.sponsorPhone,
    financeurSameAsSponsor: financeurInfo.financeurSameAsSponsor,
    financeurName: financeurInfo.financeurName,
    financeurUrl: financeurInfo.financeurUrl,
    paymentMode: paymentInfo.paymentMode,
    soldPriceHt: paymentInfo.soldPriceHt,
    notes,
    formula,
    coachingSessionsTotal,
    typeStagiaireBpf,
    sourceFinancementBpf,
  }), [participantForm.firstName, participantForm.lastName, participantForm.email, participantForm.company, participantForm.companyAddress, participantForm.companyZip, participantForm.companyCity, sponsorInfo.sponsorFirstName, sponsorInfo.sponsorLastName, sponsorInfo.sponsorEmail, sponsorInfo.sponsorPhone, financeurInfo.financeurSameAsSponsor, financeurInfo.financeurName, financeurInfo.financeurUrl, paymentInfo.paymentMode, paymentInfo.soldPriceHt, notes, formula, coachingSessionsTotal, typeStagiaireBpf, sourceFinancementBpf]);

  // --- Auto-save callback ---
  const handleAutoSave = useCallback(
    async (values: AutoSaveFormValues): Promise<boolean> => {
      const v = values as unknown as FormValues;
      if (!v.email.trim()) return false;

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
        return false;
      }

      await updateParticipantEvaluation(participant.id, {
        email: v.email.trim().toLowerCase(),
        first_name: capitalizeName(v.firstName) || null,
        last_name: capitalizeName(v.lastName) || null,
        company: v.company.trim() || null,
      });

      onParticipantUpdated();
      return true;
    },
    [buildUpdateData, participant.id, toast, onParticipantUpdated],
  );

  const autoSave = useAutoSaveForm({
    open,
    formValues,
    debounceMs: 800,
    onSave: handleAutoSave,
  });

  // --- Reset auto-save tracking when participant changes ---
  useEffect(() => {
    autoSave.resetTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant]);

  // --- Flush pending auto-save and close ---
  const handleClose = useCallback(() => {
    const pending = autoSave.flushAndGetPending();
    if (pending) {
      const v = pending as unknown as FormValues;
      if (v.email.trim()) {
        const updateData = buildUpdateData(v);
        updateParticipant(participant.id, updateData).then(
          () => onParticipantUpdated(),
          console.error,
        );
      }
    }
    setOpen(false);
    onParticipantUpdated();
  }, [autoSave, buildUpdateData, participant.id, onParticipantUpdated]);

  return {
    // Dialog
    open,
    setOpen,
    handleClose,

    // Auto-save status
    autoSaving: autoSave.autoSaving,
    lastSaved: autoSave.lastSaved,

    // Participant form fields
    firstName: participantForm.firstName,
    setFirstName: participantForm.setFirstName,
    lastName: participantForm.lastName,
    setLastName: participantForm.setLastName,
    email: participantForm.email,
    setEmail: participantForm.setEmail,
    company: participantForm.company,
    setCompany: participantForm.setCompany,
    companyAddress: participantForm.companyAddress,
    setCompanyAddress: participantForm.setCompanyAddress,
    companyZip: participantForm.companyZip,
    setCompanyZip: participantForm.setCompanyZip,
    companyCity: participantForm.companyCity,
    setCompanyCity: participantForm.setCompanyCity,

    // Sponsor fields
    sponsorFirstName: sponsorInfo.sponsorFirstName,
    setSponsorFirstName: sponsorInfo.setSponsorFirstName,
    sponsorLastName: sponsorInfo.sponsorLastName,
    setSponsorLastName: sponsorInfo.setSponsorLastName,
    sponsorEmail: sponsorInfo.sponsorEmail,
    setSponsorEmail: sponsorInfo.setSponsorEmail,
    sponsorPhone: sponsorInfo.sponsorPhone,
    setSponsorPhone: sponsorInfo.setSponsorPhone,

    // Financeur fields
    financeurSameAsSponsor: financeurInfo.financeurSameAsSponsor,
    setFinanceurSameAsSponsor: financeurInfo.setFinanceurSameAsSponsor,
    financeurName: financeurInfo.financeurName,
    setFinanceurName: financeurInfo.setFinanceurName,
    financeurUrl: financeurInfo.financeurUrl,
    setFinanceurUrl: financeurInfo.setFinanceurUrl,
    financeurPopoverOpen: financeurInfo.financeurPopoverOpen,
    setFinanceurPopoverOpen: financeurInfo.setFinanceurPopoverOpen,
    existingFinanceurs: financeurInfo.existingFinanceurs,

    // Payment & pricing
    paymentMode: paymentInfo.paymentMode,
    setPaymentMode: paymentInfo.setPaymentMode,
    soldPriceHt: paymentInfo.soldPriceHt,
    setSoldPriceHt: paymentInfo.setSoldPriceHt,

    // Notes
    notes,
    setNotes,

    // Formula & coaching
    formula,
    setFormula,
    selectedFormula,
    formulaAllowsCoaching,
    coachingSessionsTotal,
    setCoachingSessionsTotal,

    // BPF
    typeStagiaireBpf,
    setTypeStagiaireBpf,
    sourceFinancementBpf,
    setSourceFinancementBpf,

    // Convention
    signedConventionUrl: conventionHook.signedConventionUrl,
    uploadingConvention: conventionHook.uploadingConvention,
    conventionSignature: conventionHook.conventionSignature,
    handleConventionUpload: conventionHook.handleConventionUpload,
    handleConventionDelete: conventionHook.handleConventionDelete,

    // Files
    participantFiles: filesHook.participantFiles,
    uploadingFile: filesHook.uploadingFile,
    handleFileUpload: filesHook.handleFileUpload,
    handleDeleteFile: filesHook.handleDeleteFile,

    // Coupon
    couponCode: paymentInfo.couponCode,
  };
}
