import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Zap,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface FunctionInfo {
  name: string;
  status: "deployed" | "missing";
}

interface HealthCheckResult {
  checked_at: string;
  total: number;
  deployed: number;
  missing: number;
  functions: FunctionInfo[];
}

const EdgeFunctionsTab = () => {
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["functions-health"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("check-functions-health", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (response.error) throw response.error;
      return response.data as HealthCheckResult;
    },
    staleTime: 60000,
  });

  const functions = data?.functions || [];
  const filtered = search
    ? functions.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : functions;

  const missing = filtered.filter((f) => f.status === "missing");
  const deployed = filtered.filter((f) => f.status === "deployed");

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total attendues</p>
                <p className="text-2xl font-bold">{data?.total ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Déployées</p>
                <p className="text-2xl font-bold">{data?.deployed ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={data && data.missing > 0 ? "border-destructive" : undefined}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">À déployer</p>
                <p className="text-2xl font-bold">{data?.missing ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Rechercher une fonction..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Spinner className="mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Rafraîchir
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Chargement...
        </div>
      ) : (
        <>
          {/* Missing functions — shown first when present */}
          {missing.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                À déployer ({missing.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {missing.map((fn) => (
                  <div
                    key={fn.name}
                    className="flex items-center gap-3 rounded-lg border p-3 border-destructive/40 bg-destructive/5"
                  >
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fn.name}</p>
                    </div>
                    <Badge variant="destructive" className="text-[10px] shrink-0">
                      manquante
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Deployed functions */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Déployées ({deployed.length})
            </h3>
            {deployed.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{search ? "Aucune fonction trouvée." : "Aucune donnée disponible."}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {deployed.map((fn) => (
                  <div
                    key={fn.name}
                    className="flex items-center gap-3 rounded-lg border p-3 border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30"
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fn.name}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      déployée
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default EdgeFunctionsTab;
