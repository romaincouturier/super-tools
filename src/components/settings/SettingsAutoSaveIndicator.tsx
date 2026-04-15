import { Check } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

export const AutoSaveIndicator = ({ status }: { status: "idle" | "saving" | "saved" }) => {
  if (status === "saving") return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner />
      Enregistrement...
    </div>
  );
  if (status === "saved") return (
    <div className="flex items-center gap-2 text-sm text-green-600">
      <Check className="h-4 w-4" />
      Enregistré
    </div>
  );
  return null;
};
