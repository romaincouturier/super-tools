import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ThankYouEmailPreviewDialog from "@/components/formations/ThankYouEmailPreviewDialog";

import type { DocumentSentInfo } from "./types";

interface ThankYouEmailSectionProps {
  trainingId: string;
  trainingName: string;
  supportsUrl: string;
  documentsSentInfo: DocumentSentInfo;
  setDocumentsSentInfo: React.Dispatch<React.SetStateAction<DocumentSentInfo>>;
}

const ThankYouEmailSection = ({
  trainingId,
  trainingName,
  supportsUrl,
  documentsSentInfo,
  setDocumentsSentInfo,
}: ThankYouEmailSectionProps) => {
  const [sendingThankYou, setSendingThankYou] = useState(false);
  const [showThankYouPreview, setShowThankYouPreview] = useState(false);
  const { toast } = useToast();

  // Preserved for future UI integration - openThankYouPreview triggers the dialog
  void documentsSentInfo;

  const openThankYouPreview = () => {
    setShowThankYouPreview(true);
  };

  // Keep openThankYouPreview available (currently unused in JSX, as in original)
  void openThankYouPreview;

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

  return (
    <ThankYouEmailPreviewDialog
      open={showThankYouPreview}
      onOpenChange={setShowThankYouPreview}
      onConfirmSend={handleSendThankYouEmail}
      isSending={sendingThankYou}
      trainingId={trainingId}
      trainingName={trainingName}
      supportsUrl={supportsUrl || null}
    />
  );
};

export default ThankYouEmailSection;
