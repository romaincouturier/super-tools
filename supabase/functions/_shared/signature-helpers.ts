/**
 * Signature Helpers
 *
 * Shared utilities for submit-*-signature edge functions.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashArrayBuffer } from "./crypto.ts";

export interface JourneyEvent {
  event: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface DeviceInfo {
  screenWidth?: number;
  screenHeight?: number;
  timezone?: string;
  language?: string;
  colorDepth?: number;
  pixelRatio?: number;
  platform?: string;
  cookiesEnabled?: boolean;
  onLine?: boolean;
}

/**
 * Merge client-side journey events with the server submission event.
 */
export function buildJourneyEvents(
  clientEvents: JourneyEvent[] | undefined,
  signedAt: string,
  serverDetails: Record<string, unknown>,
): JourneyEvent[] {
  return [
    ...(clientEvents || []),
    {
      event: "signature_submitted_server",
      timestamp: signedAt,
      details: serverDetails,
    },
  ];
}

/** Standard legal block for proof files */
export const LEGAL_BLOCK = {
  regulation: "Règlement eIDAS (UE n° 910/2014)",
  civil_code: "Code Civil français, articles 1366 et 1367",
  signature_level: "SES (Signature Électronique Simple)",
  probative_value:
    "La charge de la preuve de l'authenticité incombe à l'émetteur en cas de contestation.",
  retention_period: "5 ans minimum après fin de relation contractuelle",
  data_protection:
    "Les données personnelles sont traitées conformément au RGPD (UE 2016/679).",
} as const;

/**
 * Generate a proof file, hash it, upload to storage, and update the signature record.
 *
 * @returns { proofFileUrl, proofHash } or nulls if upload failed
 */
export async function storeProofFile(
  supabase: SupabaseClient,
  tableName: string,
  recordId: string,
  filePrefix: string,
  token: string,
  proofFileContent: Record<string, unknown>,
): Promise<{ proofFileUrl: string | null; proofHash: string | null }> {
  let proofFileUrl: string | null = null;
  let proofHash: string | null = null;

  try {
    const proofContent = JSON.stringify(proofFileContent, null, 2);
    const proofBytes = new TextEncoder().encode(proofContent);
    proofHash = await hashArrayBuffer(proofBytes.buffer);

    const proofFileName = `${filePrefix}_${recordId}_${token}.json`;

    const { error: uploadError } = await supabase.storage
      .from("signature-proofs")
      .upload(proofFileName, proofBytes, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) {
      console.warn("Failed to upload proof file:", uploadError);
    } else {
      proofFileUrl = `signature-proofs/${proofFileName}`;
    }

    await supabase
      .from(tableName)
      .update({ proof_file_url: proofFileUrl, proof_hash: proofHash })
      .eq("id", recordId);

    console.log(`${filePrefix} proof file stored. Hash:`, proofHash);
  } catch (proofErr) {
    console.warn("Failed to generate proof file:", proofErr);
  }

  return { proofFileUrl, proofHash };
}
