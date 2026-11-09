import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomeBlockError({ title, onRetry, retrying = false }: {
  title: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div role="status" className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
      <p className="flex items-center gap-2"><AlertCircle size={16} className="shrink-0" />{title} temporairement indisponible.</p>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying} className="self-start">
        <RotateCcw size={14} className="mr-2" />Réessayer
      </Button>
    </div>
  );
}