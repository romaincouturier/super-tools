import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { openStorageUrl } from "@/lib/storageUrl";
import { useCancelDevisOrder } from "@/hooks/useDevisOrders";
import { supabase } from "@/integrations/supabase/client";

export interface DevisOrderInfo {
  id: string;
  source?: string | null;
  crm_card_id?: string | null;
  devis_activity_log_id?: string | null;
  cancelled_at?: string | null;
  order_number?: string | null;
}

export function isDevisOrder(o: DevisOrderInfo | null | undefined): o is DevisOrderInfo {
  return o?.source === "devis";
}

export function DevisOrderBadge({ order }: { order: DevisOrderInfo | null | undefined }) {
  if (!isDevisOrder(order)) return null;
  return <Badge variant="secondary" className="text-[10px]">Commande issue d'un devis</Badge>;
}

/** Liens devis/opportunité et annulation, dans la fiche commande. */
export function DevisOrderPanel({ order }: { order: DevisOrderInfo | null | undefined }) {
  const { toast } = useToast();
  const cancel = useCancelDevisOrder();
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);
  if (!isDevisOrder(order)) return null;

  const openPdf = async () => {
    if (!order.devis_activity_log_id) return;
    const { data } = await supabase.from("activity_logs").select("details").eq("id", order.devis_activity_log_id).maybeSingle();
    const path = (data?.details as Record<string, string> | null)?.pdf_storage_path;
    if (path) openStorageUrl("devis-pdfs", path);
    else toast({ title: "PDF du devis introuvable" });
  };

  const doCancel = async () => {
    try {
      const res = await cancel.mutateAsync({ orderId: order.id, reason });
      toast({
        title: "Commande annulée",
        description: res.partners_already_notified ? "Pensez à prévenir l'auteur ou le partenaire déjà informé." : undefined,
      });
      setAsking(false);
    } catch (e) {
      toastError(toast, e, { title: "Annulation impossible" });
    }
  };

  return (
    <div className="space-y-2 rounded border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <DevisOrderBadge order={order} />
        {order.cancelled_at && <Badge variant="destructive">Annulée</Badge>}
        {order.crm_card_id && <Link className="text-xs underline" to={`/crm?card=${order.crm_card_id}`}>Voir l'opportunité</Link>}
        {order.devis_activity_log_id && <button className="text-xs underline" onClick={openPdf}>Voir le devis</button>}
      </div>
      <p className="text-xs text-muted-foreground">Facturée directement au client : aucune commande ni facture sur la boutique.</p>
      {!order.cancelled_at && (asking ? (
        <div className="space-y-2">
          <Textarea placeholder="Motif de l'annulation (optionnel)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={doCancel} disabled={cancel.isPending}>Confirmer l'annulation</Button>
            <Button size="sm" variant="outline" onClick={() => setAsking(false)}>Retour</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAsking(true)}>Annuler la commande</Button>
      ))}
    </div>
  );
}
