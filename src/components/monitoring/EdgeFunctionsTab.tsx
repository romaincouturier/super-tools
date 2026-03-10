import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface FunctionHealth {
  name: string;
  status: string;
  response_time_ms: number;
}

interface HealthCheckResult {
  checked_at: string;
  total: number;
  up: number;
  down: number;
  functions: FunctionHealth[];
}

function statusIcon(status: string) {
  switch (status) {
    case "up":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "timeout":
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    default:
      return <XCircle className="h-4 w-4 text-red-600" />;
  }
}

function statusColor(status: string) {
  switch (status) {
    case "up":
      return "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30";
    case "timeout":
      return "border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/30";
    default:
      return "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30";
  }
}

const EdgeFunctionsTab = () => {
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["functions-health"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      // Trigger background refresh + get cached results
      const response = await supabase.functions.invoke("check-functions-health", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (response.error) throw response.error;
      return response.data as HealthCheckResult;
    },
    staleTime: 30000,
    refetchInterval: 15000, // Auto-refresh to pick up background results
  });

  const functions = data?.functions || [];
  const filtered = search
    ? functions.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : functions;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total fonctions</p>
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
                <p className="text-sm text-muted-foreground">En ligne</p>
                <p className="text-2xl font-bold text-green-600">{data?.up ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hors ligne</p>
                <p className="text-2xl font-bold text-red-600">{data?.down ?? "—"}</p>
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
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Relancer le check
        </Button>
        {data?.checked_at && (
          <span className="text-xs text-muted-foreground ml-auto">
            Dernier check : {new Date(data.checked_at).toLocaleTimeString("fr-FR")}
          </span>
        )}
      </div>

      {/* Functions grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Vérification des fonctions en cours...
        </div>
      ) : filtered.length === 0 ? (
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
          {filtered.map((fn) => (
            <div
              key={fn.name}
              className={`flex items-center gap-3 rounded-lg border p-3 ${statusColor(fn.status)}`}
            >
              {statusIcon(fn.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fn.name}</p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {fn.response_time_ms}ms
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EdgeFunctionsTab;
