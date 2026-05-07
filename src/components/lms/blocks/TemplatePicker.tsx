import { useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LESSON_TEMPLATES } from "@/types/lms-templates";
import { useInsertLessonTemplate } from "@/hooks/useLmsBlocks";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { cn } from "@/lib/utils";

interface Props {
  lessonId: string;
  disabled?: boolean;
}

export default function TemplatePicker({ lessonId, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const insert = useInsertLessonTemplate(lessonId);
  const { toast } = useToast();

  const handlePick = (templateId: string) => {
    const tpl = LESSON_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    insert.mutate(tpl.blocks, {
      onSuccess: () => {
        toast({ title: `Modèle « ${tpl.label} » inséré` });
        setOpen(false);
      },
      onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur lors de l'insertion du modèle"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled} className="w-full sm:w-auto">
          <LayoutTemplate className="w-4 h-4 mr-2" />
          Insérer un modèle
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choisir un modèle de section</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {LESSON_TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            const isPending = insert.isPending;
            return (
              <button
                key={tpl.id}
                type="button"
                disabled={isPending}
                onClick={() => handlePick(tpl.id)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                  "hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isPending && "opacity-50 cursor-not-allowed",
                )}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  {isPending ? (
                    <Spinner className="h-4 w-4 text-primary" />
                  ) : (
                    <Icon className="h-4 w-4 text-primary" />
                  )}
                </span>
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium leading-tight">{tpl.label}</span>
                  <span className="block text-xs text-muted-foreground leading-snug">{tpl.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
