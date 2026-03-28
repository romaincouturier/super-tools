import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Clock,
  CheckCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DashboardStats {
  totalCards: number;
  ideasCount: number;
  inProgressCount: number;
  archivedCount: number;
  pendingReviews: number;
}

const ContentDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalCards: 0,
    ideasCount: 0,
    inProgressCount: 0,
    archivedCount: 0,
    pendingReviews: 0,
  });
  const [isOpen, setIsOpen] = useState(() => window.innerWidth >= 768);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [columnsRes, cardsRes, reviewsRes] = await Promise.all([
        supabase.from("content_columns").select("id, name"),
        supabase.from("content_cards").select("id, column_id"),
        supabase
          .from("content_reviews")
          .select("id")
          .in("status", ["pending", "in_review"]),
      ]);

      if (columnsRes.error) throw columnsRes.error;
      if (cardsRes.error) throw cardsRes.error;

      const columns = columnsRes.data || [];
      const cards = cardsRes.data || [];

      const ideasColumn = columns.find((c) => c.name === "Idées");
      const archiveColumn = columns.find((c) => c.name === "Archive");

      const ideasCount = ideasColumn
        ? cards.filter((c) => c.column_id === ideasColumn.id).length
        : 0;
      const archivedCount = archiveColumn
        ? cards.filter((c) => c.column_id === archiveColumn.id).length
        : 0;
      const inProgressCount = cards.length - ideasCount - archivedCount;

      setStats({
        totalCards: cards.length,
        ideasCount,
        inProgressCount,
        archivedCount,
        pendingReviews: reviewsRes.data?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: "Idées",
      value: stats.ideasCount,
      icon: FileText,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "En cours",
      value: stats.inProgressCount,
      icon: Clock,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      label: "Archivés",
      value: stats.archivedCount,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Relectures en attente",
      value: stats.pendingReviews,
      icon: MessageSquare,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between mb-2"
        >
          <span className="font-medium">Tableau de bord</span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {loading ? "..." : stat.value}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ContentDashboard;
