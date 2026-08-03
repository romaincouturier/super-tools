/**
 * Sous-module CRM « Marchés publics » : la revue Go / No Go.
 *
 * Trié par date limite, pas par date d'arrivée : c'est l'échéance qui commande.
 * Voir docs/marches-publics.md.
 */
import { useMemo, useState } from "react";
import { Gavel } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useCrmBoard } from "@/hooks/useCrmBoard";
import {
  useTenderGo,
  useTenderNoGo,
  useTenderOpportunities,
  useTenderReopen,
} from "@/hooks/crm/useTenderOpportunities";
import { TenderCard } from "@/components/crm/TenderCard";
import { isTenderUrgent } from "@/lib/tenders";
import { TenderGoDialog, TenderNoGoDialog } from "@/components/crm/TenderDecisionDialogs";
import type { TenderWithContext } from "@/types/tenders";
import type { ServiceType } from "@/types/crm";

export default function CrmTenders() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"open" | "decided">("open");
  const [goTarget, setGoTarget] = useState<TenderWithContext | null>(null);
  const [noGoTarget, setNoGoTarget] = useState<TenderWithContext | null>(null);

  const { data: tenders, isLoading } = useTenderOpportunities(tab);
  const { data: board } = useCrmBoard();
  const goMutation = useTenderGo();
  const noGoMutation = useTenderNoGo();
  const reopenMutation = useTenderReopen();

  const actorEmail = user?.email ?? "";
  const targetColumn = useMemo(
    () => board?.columns.find((c) => c.name === "Entrant") || board?.columns[0],
    [board],
  );
  const tenderTagId = useMemo(
    () => board?.tags.find((t) => t.name === "Marché public")?.id ?? null,
    [board],
  );

  const rows = tenders ?? [];
  const urgent = rows.filter((t) => isTenderUrgent(t.datelimitereponse)).length;

  return (
    <ModuleLayout>
      <PageHeader
        icon={Gavel}
        title="Marchés publics"
        subtitle="Appels d'offres détectés sur le BOAMP, PLACE et AWS. Rien n'entre dans le kanban sans un Go."
        backTo="/crm"
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "open" | "decided")} className="mt-4">
        <TabsList>
          <TabsTrigger value="open">
            À décider{rows.length && tab === "open" ? ` (${rows.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="decided">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {tab === "open" && urgent > 0 && (
            <p className="text-sm text-destructive">
              {urgent} avis à moins de 12 jours de la date limite.
            </p>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              {tab === "open"
                ? "Aucun appel d'offres en attente de décision."
                : "Aucune décision enregistrée pour l'instant."}
            </p>
          ) : (
            rows.map((tender) => (
              <TenderCard
                key={tender.id}
                tender={tender}
                decided={tab === "decided"}
                onGo={() => setGoTarget(tender)}
                onNoGo={() => setNoGoTarget(tender)}
                onReopen={() => reopenMutation.mutate(tender.id)}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <TenderNoGoDialog
        tender={noGoTarget}
        open={!!noGoTarget}
        onOpenChange={(v) => !v && setNoGoTarget(null)}
        pending={noGoMutation.isPending}
        onConfirm={(reason, detail) => {
          if (!noGoTarget) return;
          noGoMutation.mutate({ id: noGoTarget.id, reason, detail, actorEmail });
          setNoGoTarget(null);
        }}
      />

      <TenderGoDialog
        tender={goTarget}
        open={!!goTarget}
        onOpenChange={(v) => !v && setGoTarget(null)}
        pending={goMutation.isPending}
        onConfirm={(serviceType: ServiceType, estimatedValue: number) => {
          if (!goTarget || !targetColumn) return;
          goMutation.mutate({
            tender: goTarget,
            serviceType,
            estimatedValue,
            columnId: targetColumn.id,
            tagId: tenderTagId,
            actorEmail,
          });
          setGoTarget(null);
        }}
      />
    </ModuleLayout>
  );
}
