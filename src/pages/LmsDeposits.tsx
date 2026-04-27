import { useMemo, useState } from "react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ClipboardList, Globe2, Lock, Search, Eye, EyeOff } from "lucide-react";
import { useAllDepositsAdmin } from "@/hooks/useLmsWorkDeposit";
import {
  PEDAGOGICAL_STATUS_LABELS,
  type AdminDepositRow,
  type DepositPedagogicalStatus,
} from "@/types/lms-work-deposit";
import DepositAdminDetail from "@/components/lms/DepositAdminDetail";
import { cn } from "@/lib/utils";

const STATUS_FILTER: ("all" | DepositPedagogicalStatus)[] = [
  "all",
  "submitted",
  "seen",
  "feedback_received",
  "needs_completion",
  "validated",
];

const STATUS_BADGE: Record<DepositPedagogicalStatus, string> = {
  submitted: "bg-gray-100 text-gray-700",
  seen: "bg-blue-50 text-blue-700",
  feedback_received: "bg-purple-50 text-purple-700",
  needs_completion: "bg-amber-50 text-amber-800",
  validated: "bg-green-50 text-green-700",
};

export default function LmsDeposits() {
  const { data: deposits = [], isLoading } = useAllDepositsAdmin();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DepositPedagogicalStatus>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "private" | "shared">("all");
  const [selected, setSelected] = useState<AdminDepositRow | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return deposits.filter((d) => {
      if (statusFilter !== "all" && d.pedagogical_status !== statusFilter) return false;
      if (visibilityFilter !== "all" && d.visibility !== visibilityFilter) return false;
      if (!term) return true;
      return (
        d.learner_email.toLowerCase().includes(term)
        || (d.lesson_title || "").toLowerCase().includes(term)
        || (d.course_title || "").toLowerCase().includes(term)
      );
    });
  }, [deposits, search, statusFilter, visibilityFilter]);

  // Refresh selected from the live list so the drawer stays in sync after mutations.
  const liveSelected = selected ? deposits.find((d) => d.id === selected.id) ?? selected : null;

  return (
    <ModuleLayout>
      <main className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-4">
        <PageHeader
          icon={ClipboardList}
          title="Travaux déposés"
          subtitle="Suivi et modération des dépôts apprenants"
        />

        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="relative sm:col-span-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher (apprenant, leçon, formation)…"
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "all" ? "Tous statuts" : PEDAGOGICAL_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={visibilityFilter} onValueChange={(v) => setVisibilityFilter(v as typeof visibilityFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Visibilité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes visibilités</SelectItem>
                  <SelectItem value="private">Privé</SelectItem>
                  <SelectItem value="shared">Partagé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Spinner /> Chargement…
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-8 text-center">
                Aucun dépôt correspondant.
              </p>
            ) : (
              <ul className="divide-y border rounded-lg">
                {filtered.map((d) => (
                  <li
                    key={d.id}
                    className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-muted/40 cursor-pointer"
                    onClick={() => setSelected(d)}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="break-all">{d.learner_email}</span>
                        <span>·</span>
                        <span className="break-words">{d.course_title || "—"}</span>
                        {d.module_title && (
                          <>
                            <span>·</span>
                            <span className="break-words">{d.module_title}</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm font-medium break-words">{d.lesson_title || "Leçon"}</p>
                      {d.comment && (
                        <p className="text-xs text-muted-foreground italic break-words">« {d.comment} »</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {d.publication_status === "hidden" ? (
                        <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                          <EyeOff className="h-3 w-3 mr-1" /> Masqué
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full",
                          d.visibility === "shared" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-gray-50 text-gray-700 border border-gray-200",
                        )}
                      >
                        {d.visibility === "shared" ? <Globe2 className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                        {d.visibility === "shared" ? "Partagé" : "Privé"}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full",
                          STATUS_BADGE[d.pedagogical_status],
                        )}
                      >
                        {PEDAGOGICAL_STATUS_LABELS[d.pedagogical_status]}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString("fr-FR")}
                      </span>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>

      <DepositAdminDetail
        deposit={liveSelected}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </ModuleLayout>
  );
}
