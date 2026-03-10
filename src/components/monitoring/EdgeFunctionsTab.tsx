import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Zap,
  CheckCircle2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface FunctionInfo {
  name: string;
  status: string;
}

interface HealthCheckResult {
  checked_at: string;
  total: number;
  deployed: number;
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

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fonctions déployées</p>
              <p className="text-2xl font-bold">{data?.total ?? "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
          Rafraîchir
        </Button>
      </div>

      {/* Functions grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Chargement...
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
    </div>
  );
};

export default EdgeFunctionsTab;
