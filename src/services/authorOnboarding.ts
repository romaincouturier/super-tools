import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

const FN = "author-onboarding";
const BUCKET = "author-onboarding";

export class OnboardingError extends Error {
  constructor(message: string, public missing?: string[]) { super(message); }
}

async function call<T>(body: Record<string, unknown> | FormData): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FN, { body });
  if (error) {
    let msg = error.message; let missing: string[] | undefined;
    if (error instanceof FunctionsHttpError) {
      try { const j = await error.context.json(); msg = j.error ?? msg; missing = j.missing; } catch { /* corps non JSON */ }
    }
    throw new OnboardingError(msg, missing);
  }
  return data as T;
}

export interface OnboardingFile { id: string; kind: "logo" | "photo" | "pdf"; original_name: string | null; mime_type: string; size_bytes: number }
export interface PublicOnboarding {
  status: "form" | "submitted" | "contract" | "signed";
  game_name?: string;
  commission: string;
  expires_at: string;
  form: Record<string, string | number | boolean | null>;
  files: OnboardingFile[];
  contract: null | { reference: string; status: string; signed_at: string | null; otp_verified: boolean; recipient_email: string };
  contract_pdf_url?: string | null;
  contract_error?: string;
}
export interface InvitationDraft { invitation_id?: string; link: string; subject: string; content: string; to: string }

export const publicOnboarding = {
  get: (token: string) => call<PublicOnboarding>({ action: "get", token }),
  save: (token: string, form: Record<string, unknown>) => call<{ saved_at: string }>({ action: "save", token, form }),
  check: (token: string, form: Record<string, unknown>) => call<{ saved_at: string; missing: string[] }>({ action: "save", token, form, check: true }),
  edit: (token: string) => call<{ reopened: boolean }>({ action: "edit", token }),
  submit: (token: string, form: Record<string, unknown>) => call<PublicOnboarding & { submitted?: boolean }>({ action: "submit", token, form }),
  upload: (token: string, kind: string, file: File) => {
    const fd = new FormData(); fd.append("token", token); fd.append("kind", kind); fd.append("file", file);
    return call<{ files: OnboardingFile[] }>(fd);
  },
  deleteFile: (token: string, fileId: string) => call<{ files: OnboardingFile[] }>({ action: "delete_file", token, file_id: fileId }),
  sendOtp: (token: string) => call<{ sent_to: string }>({ action: "send_otp", token }),
  sign: (token: string, payload: Record<string, unknown>) =>
    call<{ signed: boolean; download_url: string | null }>({ action: "sign", token, ...payload }),
};

export const staffOnboarding = {
  invite: (p: { email: string; first_name: string; last_name: string; game_name: string; commission_rate: number }) =>
    call<InvitationDraft>({ action: "invite", ...p }),
  newLink: (invitationId: string) => call<InvitationDraft>({ action: "new_link", invitation_id: invitationId }),
  sendInvitation: (p: { invitation_id: string; link: string; subject: string; content: string }) =>
    call<{ sent: boolean }>({ action: "send_invitation", ...p }),
  reopen: (invitationId: string) => call({ action: "reopen", invitation_id: invitationId }),
  setOnline: (invitationId: string) => call({ action: "set_online", invitation_id: invitationId }),
  retryContract: (invitationId: string) => call({ action: "retry_contract", invitation_id: invitationId }),
  distributorSignature: (dataUrl?: string) => call<{ url: string | null }>({ action: "distributor_signature", ...(dataUrl ? { dataUrl } : {}) }),

  async list() {
    const { data, error } = await (supabase as any)
      .from("author_onboarding_invitations")
      .select("id, recipient_email, commission_rate, expires_at, invitation_sent_at, opened_at, submitted_at, revoked_at, created_at, game_authors(id, name, onboarding_status), games(id, title), distribution_contract_signatures(id, contrat_reference, status, signed_at, pdf_url, signed_pdf_url, proof_file_url, reminder_count, created_at)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as any[];
  },
  async detail(invitationId: string) {
    const sb = supabase as any;
    const [inv, resp, files] = await Promise.all([
      sb.from("author_onboarding_invitations").select("*, game_authors(*), games(*), distribution_contract_signatures(*)").eq("id", invitationId).single(),
      sb.from("author_onboarding_responses").select("*").eq("invitation_id", invitationId).maybeSingle(),
      sb.from("author_onboarding_files").select("*").eq("invitation_id", invitationId).order("created_at"),
    ]);
    if (inv.error) throw inv.error;
    return { invitation: inv.data, response: resp.data, files: files.data ?? [] };
  },
  async fileUrl(path: string | null, download?: string) {
    if (!path) return null;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600, download ? { download } : undefined);
    return data?.signedUrl ?? null;
  },
};
