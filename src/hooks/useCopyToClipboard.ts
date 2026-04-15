import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export interface UseCopyToClipboardOptions {
  /** Milliseconds before `copied` resets to false. Defaults to 2000. */
  autoResetMs?: number;
  /** Default toast title shown on success. Defaults to "Lien copié". */
  defaultToastTitle?: string;
}

/**
 * Unified copy-to-clipboard behaviour.
 *
 * Returns:
 *  - `copied` — true for `autoResetMs` ms after a successful copy (for
 *    swapping a ✓ icon, etc.).
 *  - `copy(text, { title?, description?, silent? })` — writes to the
 *    clipboard. Shows a toast by default; pass `silent: true` to skip it.
 *
 * Why: `navigator.clipboard.writeText` is called 28 times across 22 files
 * with inconsistent toast/copied-state handling. This centralises the UX.
 */
export function useCopyToClipboard({
  autoResetMs = 2000,
  defaultToastTitle = "Lien copié",
}: UseCopyToClipboardOptions = {}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (
      text: string,
      options?: { title?: string; description?: string; silent?: boolean },
    ) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        if (!options?.silent) {
          toast({
            title: options?.title ?? defaultToastTitle,
            description: options?.description,
          });
        }
        setTimeout(() => setCopied(false), autoResetMs);
        return true;
      } catch {
        toast({
          title: "Erreur",
          description: "Impossible de copier dans le presse-papier.",
          variant: "destructive",
        });
        return false;
      }
    },
    [toast, autoResetMs, defaultToastTitle],
  );

  return { copied, copy };
}
