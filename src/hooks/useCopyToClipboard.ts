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
      const fallbackCopy = (value: string): boolean => {
        try {
          const ta = document.createElement("textarea");
          ta.value = value;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.top = "0";
          ta.style.left = "0";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          ta.setSelectionRange(0, value.length);
          const ok = document.execCommand("copy");
          document.body.removeChild(ta);
          return ok;
        } catch {
          return false;
        }
      };

      let success = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          success = true;
        }
      } catch {
        success = false;
      }
      if (!success) {
        success = fallbackCopy(text);
      }
      if (success) {
        setCopied(true);
        if (!options?.silent) {
          toast({
            title: options?.title ?? defaultToastTitle,
            description: options?.description,
          });
        }
        setTimeout(() => setCopied(false), autoResetMs);
        return true;
      }
      toast({
        title: "Erreur",
        description: "Impossible de copier dans le presse-papier.",
        variant: "destructive",
      });
      return false;
    },
    [toast, autoResetMs, defaultToastTitle],
  );

  return { copied, copy };
}
