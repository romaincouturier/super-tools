import { supabase } from "@/integrations/supabase/client";
import type { SendEmailInput } from "@/types/crm";
import { useCrmMutation } from "./useCrmMutation";

export const useSendEmail = () =>
  useCrmMutation(
    async ({
      input,
      senderEmail,
    }: {
      input: SendEmailInput;
      senderEmail: string;
    }) => {
      // senderEmail kept for future use / audit trail
      void senderEmail;

      const { data, error } = await supabase.functions.invoke(
        "crm-send-email",
        {
          body: {
            card_id: input.card_id,
            recipient_email: input.recipient_email,
            subject: input.subject,
            body_html: input.body_html,
            attachments: input.attachments,
            cc: input.cc,
            bcc: input.bcc,
          },
        }
      );

      if (error) {
        throw new Error(error.message || "\u00c9chec de l'envoi de l'email");
      }
      if (!data?.success) {
        throw new Error(
          (data as { message?: string })?.message ||
            "Erreur lors de l'envoi de l'email"
        );
      }
      return data as { success: boolean };
    },
    { successMessage: "Email envoy\u00e9" }
  );
