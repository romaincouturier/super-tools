export interface RentalState {
  game_type: string | null;
  kanban_status: string;
  location_contract_file_url: string | null;
  email_sent_at: string | null;
  archived_at: string | null;
  signed: boolean;
}

export function rentalSignaturePatch(signedAt: string) {
  const parisDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(signedAt));
  const end = new Date(`${parisDay}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 30);
  return { kanban_status: "location_active", location_end_date: end.toISOString().slice(0, 10), block_reason: null };
}

export async function prepareRentalContract(
  state: RentalState,
  autoSend: boolean,
  invoke: (name: string) => Promise<void>,
): Promise<boolean> {
  if (state.game_type !== "location" || state.archived_at || state.signed || state.kanban_status === "location_active" || state.kanban_status === "processed") return false;
  if (!state.location_contract_file_url) await invoke("generate-location-contract");
  if (autoSend && !state.email_sent_at) {
    await invoke("send-location-contract-email");
    return true;
  }
  return false;
}

export async function runRentalWorkflow(admin: any, orderItemId: string, autoSend: boolean): Promise<boolean> {
  const { data: item, error } = await admin.from("order_items")
    .select("game_type, kanban_status, location_contract_file_url, email_sent_at, archived_at")
    .eq("id", orderItemId).single();
  if (error || !item) throw new Error(error?.message ?? "Location introuvable");
  const { data: signatures, error: signatureError } = await admin.from("location_contract_signatures")
    .select("status, email_sent_at").eq("order_item_id", orderItemId).is("location_extension_id", null);
  if (signatureError) throw new Error(signatureError.message);
  const state = {
    ...item,
    signed: (signatures ?? []).some((s: any) => s.status === "signed"),
    email_sent_at: item.email_sent_at ?? (signatures ?? []).find((s: any) => s.status === "pending" && s.email_sent_at)?.email_sent_at ?? null,
  };
  try {
    return await prepareRentalContract(state, autoSend, async (name) => {
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ orderItemId, reuseExisting: true }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(`${name}: ${result.error ?? response.status}`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from("order_items").update({ kanban_status: "blocked", block_reason: `Contrat de location : ${message}` }).eq("id", orderItemId);
    await admin.from("order_email_log").insert({ order_item_id: orderItemId, template_key: "location_contract", status: "failed", error: message, sent_to: [] });
    throw error;
  }
}