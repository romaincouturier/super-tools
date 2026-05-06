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
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } finally {
          document.body.removeChild(ta);
        }
      }
      setCopied(true);
      if (!options?.silent) {
        toast.success(options?.title ?? defaultToastTitle, {
          description: options?.description,
        });
      }
      setTimeout(() => setCopied(false), autoResetMs);
      return true;
    },
    [autoResetMs, defaultToastTitle],
  );

  return { copied, copy };
}
