import { useCallback, useState } from "react";
import { toast } from "sonner";

export interface UseCopyToClipboardOptions {
  autoResetMs?: number;
  defaultToastTitle?: string;
}

export function useCopyToClipboard({
  autoResetMs = 2000,
  defaultToastTitle = "Lien copié",
}: UseCopyToClipboardOptions = {}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (
      text: string,
      options?: { title?: string; description?: string; silent?: boolean },
    ) => {
      let success = false;

      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch {
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.top = "0";
          ta.style.left = "0";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          ta.setSelectionRange(0, text.length);
          success = document.execCommand("copy");
          document.body.removeChild(ta);
        } catch {
          success = false;
        }
      }

      if (success) {
        setCopied(true);
        if (!options?.silent) {
          toast.success(options?.title ?? defaultToastTitle, {
            description: options?.description,
          });
        }
        setTimeout(() => setCopied(false), autoResetMs);
      } else {
        toast.error("Impossible de copier dans le presse-papier.");
      }

      return success;
    },
    [autoResetMs, defaultToastTitle],
  );

  return { copied, copy };
}
