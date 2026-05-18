import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useConfirm } from "@/hooks/useConfirm";
import {
  Inbox,
  Search,
  CheckCircle2,
  AlertTriangle,
  User,
  ShoppingCart,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Spinner } from "@/components/ui/spinner";

interface InboxItem {
  id: string;
  product_name: string;
  wc_product_id: number;
  game_type: string | null;
  block_reason: string | null;
  line_total: number;
  quantity: number;
  validation_status: string;
  woocommerce_orders: {
    wc_order_id: number;
    order_number: string | null;
    customer_first_name: string | null;
    customer_last_name: string | null;
    customer_email: string | null;
    date_created: string;
  } | null;
}

export default function WoocommerceInbox() {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["wc-inbox"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, product_name, wc_product_id, game_type, block_reason, line_total, quantity, validation_status, woocommerce_orders(wc_order_id, order_number, customer_first_name, customer_last_name, customer_email, date_created)")
        .eq("validation_status", "pending")
        .order("id", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as InboxItem[];
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("order_items")
        .update({ validation_status: "manually_processed", kanban_status: "received" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Vente marquée comme traitée" });
      queryClient.invalidateQueries({ queryKey: ["wc-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["routing-inbox-alert"] });
    },
    onError: (e: Error) => toastError(toast, e),
  });

  const handleResolve = async (item: InboxItem) => {
    const ok = await confirm({
      title: "Marquer comme traité ?",
      description: `La vente "${item.product_name}" sera marquée comme traitée manuellement et disparaîtra de l'inbox.`,
      confirmText: "Marquer traité",
    });
    if (!ok) return;
    resolveMutation.mutate(item.id);
  };

  const filtered = data.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.product_name?.toLowerCase().includes(q) ||
      item.woocommerce_orders?.customer_email?.toLowerCase().includes(q) ||
      item.woocommerce_orders?.customer_first_name?.toLowerCase().includes(q) ||
      item.woocommerce_orders?.customer_last_name?.toLowerCase().includes(q) ||
      String(item.woocommerce_orders?.wc_order_id ?? "").includes(q) ||
      item.block_reason?.toLowerCase().includes(q)
    );
  });

  const typeLabel = (item: InboxItem) => {
    if (item.game_type === "formation") return { label: "Formation", color: "bg-blue-500/10 text-blue-700 border-blue-200 border" };
    return { label: "Produit inconnu", color: "bg-orange-500/10 text-orange-700 border-orange-200 border" };
  };

  return (
    <ModuleLayout>
      <ConfirmDialog />
      <div className="container py-6 space-y-6 max-w-4xl">
        <PageHeader
          icon={Inbox}
          title="Inbox WooCommerce"
          subtitle="Ventes non routées automatiquement — à traiter manuellement"
          backTo="/commandes-jeux"
        />

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher client, produit, commande…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filtered.length} vente{filtered.length !== 1 ? "s" : ""} en attente
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500/60" />
              <p className="text-muted-foreground">
                {search ? "Aucun résultat pour cette recherche." : "Inbox vide — toutes les ventes ont été routées."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const { label, color } = typeLabel(item);
              const order = item.woocommerce_orders;
              const customerName = [order?.customer_first_name, order?.customer_last_name].filter(Boolean).join(" ") || "—";
              return (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-4 h-4 text-orange-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Produit #{item.wc_product_id} · {item.quantity} unité{item.quantity > 1 ? "s" : ""} · {item.line_total.toFixed(2)} €
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`${color} text-xs shrink-0`}>{label}</Badge>
                    </div>

                    {/* Raison du blocage */}
                    {item.block_reason && (
                      <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                        {item.block_reason}
                      </div>
                    )}

                    {/* Infos commande */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {order && (
                        <>
                          <span className="flex items-center gap-1">
                            <ShoppingCart className="w-3 h-3" />
                            Commande #{order.order_number ?? order.wc_order_id}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {customerName}
                            {order.customer_email && <span className="text-muted-foreground/70">· {order.customer_email}</span>}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(order.date_created), "d MMM yyyy", { locale: fr })}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <a
                        href={`https://supertilt.fr/wp-admin/post.php?post=${order?.wc_order_id}&action=edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> Voir dans WooCommerce
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolve(item)}
                        disabled={resolveMutation.isPending}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Marquer traité
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ModuleLayout>
  );
}
