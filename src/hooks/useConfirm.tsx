import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** "destructive" wires the confirm button to the destructive style (default). */
  variant?: "default" | "destructive";
}

export interface UseConfirmReturn {
  /**
   * Opens the confirm dialog. Resolves to `true` if the user confirms,
   * `false` if they cancel or dismiss.
   */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Must be rendered once in the component tree that uses `confirm`. */
  ConfirmDialog: () => JSX.Element;
}

/**
 * Hook replacement for the native `window.confirm()` — uses a shadcn
 * AlertDialog so confirmation UX matches the rest of the app.
 *
 * @example
 *   const { confirm, ConfirmDialog } = useConfirm();
 *   const handleDelete = async () => {
 *     const ok = await confirm({
 *       title: "Supprimer cet élément ?",
 *       description: "Cette action est irréversible.",
 *       confirmText: "Supprimer",
 *       variant: "destructive",
 *     });
 *     if (ok) { ... }
 *   };
 *   return <>... <ConfirmDialog /></>
 */
export function useConfirm(): UseConfirmReturn {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({});
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(opts);
      setOpen(true);
    });
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resolverRef.current?.(false);
      resolverRef.current = null;
    }
    setOpen(next);
  };

  const handleConfirm = () => {
    resolverRef.current?.(true);
    resolverRef.current = null;
    setOpen(false);
  };

  const handleCancel = () => {
    resolverRef.current?.(false);
    resolverRef.current = null;
    setOpen(false);
  };

  const ConfirmDialog = () => (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title ?? "Confirmer ?"}</AlertDialogTitle>
          {options.description && (
            <AlertDialogDescription>{options.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {options.cancelText ?? "Annuler"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={
              (options.variant ?? "destructive") === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {options.confirmText ?? "Confirmer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, ConfirmDialog };
}
