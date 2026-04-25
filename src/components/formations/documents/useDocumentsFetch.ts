import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DocumentSentInfo, ConventionSignatureStatus, JourneyEvent } from "./types";

interface UseDocumentsFetchParams {
  trainingId: string;
  participants: { id: string }[];
}

interface UseDocumentsFetchResult {
  documentsSentInfo: DocumentSentInfo;
  setDocumentsSentInfo: React.Dispatch<React.SetStateAction<DocumentSentInfo>>;
  conventionSentAt: string | null;
  setConventionSentAt: (date: string | null) => void;
  conventionSignatureStatus: ConventionSignatureStatus | null;
  conventionSignatureUrl: string | null;
  setConventionSignatureUrl: (url: string | null) => void;
  certificateUrls: string[];
  evaluationCount: number;
  saveSupportsUrl: (url: string) => Promise<void>;
  saveSupportsType: (type: "url" | "file" | "lms") => Promise<void>;
  saveSupportsFile: (url: string | null, fileName: string | null) => Promise<void>;
  saveSupportsLmsCourseId: (courseId: string | null) => Promise<void>;
}

export function useDocumentsFetch({ trainingId, participants }: UseDocumentsFetchParams): UseDocumentsFetchResult {
  const [documentsSentInfo, setDocumentsSentInfo] = useState<DocumentSentInfo>({ invoice: null, sheets: null, thankYou: null });
  const [conventionSentAt, setConventionSentAt] = useState<string | null>(null);
  const [conventionSignatureUrl, setConventionSignatureUrl] = useState<string | null>(null);
  const [conventionSignatureStatus, setConventionSignatureStatus] = useState<ConventionSignatureStatus | null>(null);
  const [certificateUrls, setCertificateUrls] = useState<string[]>([]);
  const [evaluationCount, setEvaluationCount] = useState(0);

  // Fetch document send dates from activity logs
  useEffect(() => {
    const fetchDocumentsSentInfo = async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("created_at, action_type, details")
        .in("action_type", ["training_documents_sent", "thank_you_email_sent", "convention_email_sent"])
        .order("created_at", { ascending: false });

      if (error || !data) return;

      let invoiceSentAt: string | null = null;
      let sheetsSentAt: string | null = null;
      let thankYouSentAt: string | null = null;
      let conventionSent: string | null = null;

      for (const log of data) {
        const details = log.details as { training_id?: string; document_type?: string } | null;
        if (details?.training_id !== trainingId) continue;

        if (log.action_type === "convention_email_sent") {
          if (!conventionSent) {
            conventionSent = log.created_at;
          }
        } else if (log.action_type === "thank_you_email_sent") {
          if (!thankYouSentAt) {
            thankYouSentAt = log.created_at;
          }
        } else if (log.action_type === "training_documents_sent") {
          const docType = details?.document_type;
          if (!invoiceSentAt && (docType === "invoice" || docType === "all")) {
            invoiceSentAt = log.created_at;
          }
          if (!sheetsSentAt && (docType === "sheets" || docType === "all")) {
            sheetsSentAt = log.created_at;
          }
        }

        if (invoiceSentAt && sheetsSentAt && thankYouSentAt && conventionSent) break;
      }

      setDocumentsSentInfo({ invoice: invoiceSentAt, sheets: sheetsSentAt, thankYou: thankYouSentAt });
      setConventionSentAt(conventionSent);
    };

    fetchDocumentsSentInfo();
  }, [trainingId]);

  // Fetch convention signature status
  useEffect(() => {
    const fetchConventionSignatureStatus = async () => {
      const { data, error } = await supabase
        .from("convention_signatures")
        .select("status, signed_at, audit_metadata, ip_address, proof_file_url, proof_hash, signed_pdf_url, journey_events, pdf_hash")
        .eq("training_id", trainingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const audit = data.audit_metadata as Record<string, string | null> | null;
        setConventionSignatureStatus({
          status: data.status,
          signed_at: data.signed_at,
          signer_name: audit?.signer_name || null,
          signer_function: audit?.signer_function || null,
          ip_address: data.ip_address,
          signature_hash: audit?.signature_hash || null,
          pdf_hash: data.pdf_hash,
          proof_file_url: data.proof_file_url,
          proof_hash: data.proof_hash,
          signed_pdf_url: data.signed_pdf_url,
          journey_events: data.journey_events as unknown as JourneyEvent[] | null,
          consent_timestamp: audit?.consent_timestamp || null,
        });
      }
    };

    fetchConventionSignatureStatus();
  }, [trainingId]);

  // Fetch certificate URLs and evaluation count for all participants
  useEffect(() => {
    const fetchCertificatesAndEvaluations = async () => {
      const { data, error } = await supabase
        .from("training_evaluations")
        .select("certificate_url, etat")
        .eq("training_id", trainingId);

      if (!error && data) {
        const urls = data
          .map((e: { certificate_url: string | null }) => e.certificate_url as string)
          .filter(Boolean);
        setCertificateUrls(urls);

        const submitted = data.filter((e: { etat: string }) => e.etat === "soumis").length;
        setEvaluationCount(submitted);
      }
    };

    fetchCertificatesAndEvaluations();
  }, [trainingId, participants]);

  const saveSupportsUrl = useCallback(async (url: string) => {
    const { error } = await supabase.from("trainings").update({ supports_url: url || null }).eq("id", trainingId);
    if (error) throw error;
  }, [trainingId]);

  const saveSupportsType = useCallback(async (type: "url" | "file" | "lms") => {
    // Clear the payload columns that don't belong to the new mode, so the
    // effective support kind (derived from populated columns) stays unambiguous.
    const update: {
      supports_type: "url" | "file" | "lms";
      supports_url?: null;
      supports_file_name?: null;
      supports_lms_course_id?: null;
    } = { supports_type: type };
    if (type === "url") {
      update.supports_file_name = null;
      update.supports_lms_course_id = null;
    } else if (type === "file") {
      update.supports_lms_course_id = null;
    } else if (type === "lms") {
      update.supports_url = null;
      update.supports_file_name = null;
    }
    const { error } = await supabase
      .from("trainings")
      .update(update)
      .eq("id", trainingId);
    if (error) throw error;
  }, [trainingId]);

  const saveSupportsFile = useCallback(async (url: string | null, fileName: string | null) => {
    const { error } = await supabase
      .from("trainings")
      .update({ supports_url: url, supports_file_name: fileName })
      .eq("id", trainingId);
    if (error) throw error;
  }, [trainingId]);

  const saveSupportsLmsCourseId = useCallback(async (courseId: string | null) => {
    const { error } = await supabase
      .from("trainings")
      .update({ supports_lms_course_id: courseId })
      .eq("id", trainingId);
    if (error) throw error;
  }, [trainingId]);

  return {
    documentsSentInfo,
    setDocumentsSentInfo,
    conventionSentAt,
    setConventionSentAt,
    conventionSignatureStatus,
    conventionSignatureUrl,
    setConventionSignatureUrl,
    certificateUrls,
    evaluationCount,
    saveSupportsUrl,
    saveSupportsType,
    saveSupportsFile,
    saveSupportsLmsCourseId,
  };
}
