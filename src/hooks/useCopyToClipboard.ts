import { useCallback, useState } from "react";
import { toast } from "@/lib/toast";

export interface UseCopyToClipboardOptions {
  autoResetMs?: number;
  defaultToastTitle?: string;
}

export function useCopyToClipboard({
  autoResetMs = 2000,
  defaultToastTitle = "Lien copié",
}: UseCopyToClipboardOptions = {}) {
  const [copied, setCopied] = useState(false);

  const copyWithCopyEvent = useCallback((text: string) => {
    const onCopy = (event: ClipboardEvent) => {
      event.clipboardData?.setData("text/plain", text);
      event.preventDefault();
    };

    document.addEventListener("copy", onCopy);
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.removeEventListener("copy", onCopy);
    }
  }, []);

  const copyWithTextarea = useCallback((text: string) => {
    let ta: HTMLTextAreaElement | null = null;

    try {
      const openDialog = document.querySelector<HTMLElement>(
        "[role='dialog'][data-state='open']",
      );
      const host = openDialog ?? document.body;
      ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.width = "1px";
      ta.style.height = "1px";
      ta.style.opacity = "0";
      ta.style.pointerEvents = "none";
      host.appendChild(ta);
      ta.focus({ preventScroll: true });
      ta.select();
      ta.setSelectionRange(0, text.length);
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      ta?.parentNode?.removeChild(ta);
    }
  }, []);

  const copy = useCallback(
    async (
      text: string,
      options?: { title?: string; description?: string; silent?: boolean },
    ) => {
      let success = copyWithCopyEvent(text) || copyWithTextarea(text);

      if (!success && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          success = true;
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
    [autoResetMs, copyWithCopyEvent, copyWithTextarea, defaultToastTitle],
  );

  return { copied, copy };
}
