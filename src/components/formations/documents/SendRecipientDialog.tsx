import { Send, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DocumentType } from "./types";

interface SendRecipientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sendToSponsorWithOptions: boolean;
  pendingDocumentType: DocumentType | null;
  customRecipientEmail: string;
  setCustomRecipientEmail: (email: string) => void;
  ccEmail: string;
  setCcEmail: (email: string) => void;
  sendingDocuments: boolean;
  onSend: () => void;
  onCancel: () => void;
}

const getDocumentTypeLabel = (type: DocumentType | null): string => {
  switch (type) {
    case "invoice": return "la facture";
    case "sheets": return "les feuilles d'émargement";
    case "certificates": return "les certificats";
    case "evaluations": return "les évaluations participants";
    default: return "tous les documents";
  }
};

const SendRecipientDialog = ({
  open,
  onOpenChange,
  sendToSponsorWithOptions,
  pendingDocumentType,
  customRecipientEmail,
  setCustomRecipientEmail,
  ccEmail,
  setCcEmail,
  sendingDocuments,
  onSend,
  onCancel,
}: SendRecipientDialogProps) => {
  const docLabel = getDocumentTypeLabel(pendingDocumentType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {sendToSponsorWithOptions ? "Envoyer au commanditaire" : "Envoyer à un autre destinataire"}
          </DialogTitle>
          <DialogDescription>
            {sendToSponsorWithOptions
              ? `Envoi de ${docLabel} au commanditaire. Vous pouvez ajouter un email en copie.`
              : `Entrez l'adresse email du destinataire pour ${docLabel}.`
            }
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="customEmail">Email du destinataire</Label>
            <Input
              id="customEmail"
              type="email"
              value={customRecipientEmail}
              onChange={(e) => setCustomRecipientEmail(e.target.value)}
              placeholder="destinataire@exemple.fr"
              disabled={sendToSponsorWithOptions}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ccEmail">Email en copie (CC) - optionnel</Label>
            <Input
              id="ccEmail"
              type="email"
              value={ccEmail}
              onChange={(e) => setCcEmail(e.target.value)}
              placeholder="copie@exemple.fr"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button onClick={onSend} disabled={!customRecipientEmail || sendingDocuments}>
            {sendingDocuments ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SendRecipientDialog;
