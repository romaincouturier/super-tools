import { supabase } from "@/integrations/supabase/client";

/** Fire-and-forget Slack notification when media is added to the library. */
export async function notifyMediaSlack(params: {
  fileCount: number;
  sourceType: string;
  sourceLabel: string;
  fileNames: string[];
}) {
  try {
    const { data: session } = await supabase.auth.getSession();
    const actorEmail = session.session?.user?.email;

    await supabase.functions.invoke("media-slack-notify", {
      body: {
        file_count: params.fileCount,
        source_type: params.sourceType,
        source_label: params.sourceLabel,
        file_names: params.fileNames,
        actor_email: actorEmail,
      },
    });
  } catch {
    // Slack is non-critical
    console.warn("[Slack] Failed to notify media upload");
  }
}
