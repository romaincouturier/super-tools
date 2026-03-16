import { supabase } from "@/integrations/supabase/client";

interface ContentNotificationBase {
  /** ID of the user who receives the in-app notification */
  userId: string;
  /** Notification type stored in DB */
  notificationType: string;
  /** Reference ID (card, review, etc.) */
  referenceId: string;
  /** Card ID for linking */
  cardId: string;
  /** In-app notification message */
  message: string;
}

interface ContentEmailPayload {
  type: string;
  recipientEmail: string;
  cardTitle: string;
  cardId?: string;
  authorName?: string;
  commentText?: string;
}

/**
 * Insert an in-app notification record AND fire the email edge function.
 * The email send is best-effort (errors are logged but not thrown).
 */
export async function notifyContentUser(
  notification: ContentNotificationBase,
  emailPayload: ContentEmailPayload,
): Promise<void> {
  await supabase.from("content_notifications").insert({
    user_id: notification.userId,
    type: notification.notificationType,
    reference_id: notification.referenceId,
    card_id: notification.cardId,
    message: notification.message,
  });

  try {
    await supabase.functions.invoke("send-content-notification", {
      body: emailPayload,
    });
  } catch (error: unknown) {
    console.error(
      "Error sending content notification email:",
      error instanceof Error ? error.message : "Erreur inconnue",
    );
  }
}
