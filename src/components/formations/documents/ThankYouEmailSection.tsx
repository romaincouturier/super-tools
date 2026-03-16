import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ThankYouEmailPreviewDialog from "@/components/formations/ThankYouEmailPreviewDialog";

import type { DocumentSentInfo } from "./types";

interface ThankYouEmailSectionProps {
  trainingId: string;
  documentsSentInfo: DocumentSentInfo;
  setDocumentsSentInfo: React.Dispatch<React.SetStateAction<DocumentSentInfo>>;
}

const ThankYouEmailSection = ({
  trainingId,
  documentsSentInfo,
  setDocumentsSentInfo,
}: ThankYouEmailSectionProps) => {
  const [sendingThankYou, setSendingThankYou] = useState(false);
  const [showThankYouPreview, setShowThankYouPreview] = useState(false);
  const { toast } = useToast();

  const openThankYouPreview = () => {
    setShowThankYouPreview(true);
  };

  const handleSendThankYouEmail = async () => {
    setSendingThankYou(true);

    try {
      const { error, data } = await supabase.functions.invoke("send-thank-you-email", {
        body: { trainingId },
      });

      if (error) throw error;

      toast({
        title: "Email de remerciement envoyé",
        description: `Le mail a été envoyé à ${(data as { recipientCount: number }).recipientCount} participant(s).`,
      });

      setDocumentsSentInfo(prev => ({ ...prev, thankYou: new Date().toISOString() }));

      setShowThankYouPreview(false);
    } catch (error: unknown) {
      console.error("Send error:", error);
      toast({
        title: "Erreur d'envoi",
        description: error instanceof Error ? error.message : "Impossible d'envoyer le mail de remerciement.",
        variant: "destructive",
      });
    } finally {
      setSendingThankYou(false);
    }
  };

  // These are available for use by the parent or future UI additions.
  // The ThankYouEmailPreviewDialog and related state are maintained here.
  void openThankYouPreview;
  void showThankYouPreview;
  void handleSendThankYouEmail;
  void sendingThankYou;
  void documentsSentInfo;

  return (
    <ThankYouEmailPreviewDialog
      open={showThankYouPreview}
      onOpenChange={setShowThankYouPreview}
      onConfirmSend={handleSendThankYouEmail}
      sending={sendingThankYou}
      trainingId={trainingId}
    />
  );
};

export default ThankYouEmailSection;
