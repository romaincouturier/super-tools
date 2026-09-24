import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarPlus, CheckCircle, Eye, FileText, Receipt, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { openStorageUrl } from "@/lib/storageUrl";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskAmount } from "@/lib/demoMask";
import {
  useLocationExtensionActions,
  useLocationExtensions,
  type LocationExtension,
} from "@/hooks/useLocationExtensions";
import LocationExtensionDialog from "./LocationExtensionDialog";

const day = (d: string) => format(parseISO(d), "dd/MM/yyyy");

interface Props {
  orderItemId: string;
  contratReference: string | null;
  locationEndDate: string | null;
}

function ExtensionRow({ ext, orderItemId }: { ext: LocationExtension; orderItemId: string }) {
  const { toast } = useToast();
  const { isDemoMode } = useDemoMode();
  const { generate, send, refresh } = useLocationExtensionActions(orderItemId);
  const sig = ext.signature;

  const handleGenerate = async () => {
    const res = await generate.invoke({ orderItemId, extensionId: ext.id });
    if (!res) return;
    refresh();
    toast({ title: "Avenant généré", description: `Réf. ${ext.contrat_reference}` });
  };

  const handleSend = async () => {
    const res = await send.invoke({ orderItemId, extensionId: ext.id, enableOnlineSignature: true });
    if (!res) return;
    refresh();
    toast({ title: "Avenant envoyé", description: "Email avec lien de signature envoyé au locataire." });
  };

  return (
    <div className="text-xs space-y-1 rounded border border-orange-200 p-1.5">
      <p className="font-medium">
        {ext.contrat_reference} : du {day(ext.start_date)} au {day(ext.end_date)}
      </p>
      <p className="text-muted-foreground flex items-center gap-1">
        <Receipt className="h-3 w-3" />
        {ext.invoice_url ? (
          <a href={ext.invoice_url} target="_blank" rel="noopener noreferrer" className="underline">
            {ext.invoice_number}
          </a>
        ) : (
          ext.invoice_number ?? "Pas de facture"
        )}
        {" · "}
        {isDemoMode ? maskAmount(ext.amount_ht) : `${Number(ext.amount_ht).toLocaleString("fr-FR")} € HT`}
      </p>
      {sig?.status === "signed" ? (
        <p className="flex items-center gap-1 text-green-700">
          <CheckCircle className="h-3 w-3" />
          Signé le {sig.signed_at ? day(sig.signed_at) : ""}
          {sig.signed_pdf_url && (
            <button type="button" onClick={() => openStorageUrl(sig.signed_pdf_url!)} className="ml-1 underline">
              Télécharger
            </button>
          )}
        </p>
      ) : sig?.email_sent_at ? (
        <p className="flex items-center gap-1 text-blue-700">
          <Send className="h-3 w-3" />
          En attente de signature (envoyé le {day(sig.email_sent_at)})
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1">
        {sig?.status !== "signed" && (
          <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={handleGenerate} disabled={generate.loading}>
            {generate.loading ? <Spinner className="mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
            {ext.contract_file_url ? "Regénérer" : "Générer l'avenant"}
          </Button>
        )}
        {ext.contract_file_url && sig?.status !== "signed" && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2 text-orange-700"
            onClick={handleSend}
            disabled={send.loading}
          >
            {send.loading ? <Spinner className="mr-1" /> : <Send className="h-3 w-3 mr-1" />}
            Envoyer + signer
          </Button>
        )}
        {ext.contract_file_url && (
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" asChild>
            <a href={ext.contract_file_url} target="_blank" rel="noopener noreferrer">
              <Eye className="h-3 w-3 mr-1" />PDF
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

export default function LocationExtensionsSection({ orderItemId, contratReference, locationEndDate }: Props) {
  const { data: extensions = [] } = useLocationExtensions(orderItemId);
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 pt-2 border-t border-orange-200 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Location</p>
        <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setOpen(true)}>
          <CalendarPlus className="h-3 w-3 mr-1" />Prolonger
        </Button>
      </div>
      {locationEndDate && <p className="text-xs text-muted-foreground">Fin de location : {day(locationEndDate)}</p>}
      {extensions.map((ext) => (
        <ExtensionRow key={ext.id} ext={ext} orderItemId={orderItemId} />
      ))}
      {open && (
        <LocationExtensionDialog
          open={open}
          onOpenChange={setOpen}
          orderItemId={orderItemId}
          contratReference={contratReference}
        />
      )}
    </div>
  );
}
