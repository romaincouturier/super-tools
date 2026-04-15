import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Sparkles, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Card as ContentCard } from "./KanbanBoard";

interface AiIdeasSearchProps {
  onSelectCard: (cardId: string) => void;
}

interface SearchResult {
  card: ContentCard;
  relevance: string;
}

const AiIdeasSearch = ({ onSelectCard }: AiIdeasSearchProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Entrez une question");
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke("search-content-ideas", {
        body: { query: query.trim() },
      });

      if (error) throw error;

      setResults(data.results || []);

      if (!data.results?.length) {
        toast.info("Aucune idée correspondante trouvée");
      }
    } catch (error) {
      console.error("Error searching ideas:", error);
      toast.error("Erreur lors de la recherche");
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    setQuery("");
    setHasSearched(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans les idées avec l'IA..."
            className="pl-10"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? (
            <Spinner />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
        {hasSearched && (
          <Button variant="ghost" size="icon" onClick={clearResults}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {results.length} idée(s) pertinente(s) trouvée(s)
          </p>
          {results.map((result) => (
            <Card
              key={result.card.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => onSelectCard(result.card.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{result.card.title}</h4>
                    {result.card.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {result.card.description.replace(/<[^>]*>/g, "")}
                      </p>
                    )}
                    {result.card.tags && result.card.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {result.card.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                    {result.relevance}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aucun résultat pour cette recherche
        </p>
      )}
    </div>
  );
};

export default AiIdeasSearch;
