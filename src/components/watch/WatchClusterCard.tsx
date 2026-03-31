import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, Send, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import type { WatchCluster } from "@/hooks/useWatch";

interface WatchClusterCardProps {
  cluster: WatchCluster;
  itemCount: number;
}

const WatchClusterCard = ({ cluster, itemCount }: WatchClusterCardProps) => {
  const isPosted = !!cluster.slack_posted_at;

  return (
    <Card className="p-4 space-y-2 border-primary/20 bg-primary/5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">{cluster.title}</h3>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {itemCount} contenu{itemCount !== 1 ? "s" : ""}
        </Badge>
      </div>

      {cluster.summary && (
        <p className="text-sm text-muted-foreground line-clamp-3">
          {cluster.summary}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(cluster.created_at), { addSuffix: true, locale: fr })}
        </span>

        {isPosted ? (
          <Badge variant="outline" className="text-[10px] gap-1 text-green-600">
            <Check className="h-3 w-3" />
            Publié sur Slack
          </Badge>
        ) : (
          <Button variant="outline" size="sm" className="gap-1 text-xs h-7" disabled>
            <Send className="h-3 w-3" />
            Proposer sur Slack
          </Button>
        )}
      </div>
    </Card>
  );
};

export default WatchClusterCard;
