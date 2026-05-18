import { useCallback, useRef } from "react";

/**
 * Returns a stable Tiptap/ProseMirror `handlePaste` function that intercepts
 * pasted image files, uploads them, and inserts the result as an image node.
 *
 * The returned function never changes reference (safe to pass to editorProps
 * once), but always reads the latest `upload` and `setUploading` values via
 * internal refs.
 */
export function useTiptapImagePaste(
  upload: ((file: File) => Promise<string | null>) | undefined,
  setUploading?: (v: boolean) => void,
): (view: any, event: ClipboardEvent) => boolean {
  const uploadRef = useRef(upload);
  uploadRef.current = upload;
  const setUploadingRef = useRef(setUploading);
  setUploadingRef.current = setUploading;

  return useCallback((view: any, event: ClipboardEvent): boolean => {
    if (!uploadRef.current) return false;
    const items = event.clipboardData?.items;
    if (!items) return false;

    for (const item of Array.from(items) as DataTransferItem[]) {
      if (item.type.startsWith("image/")) {
        event.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        setUploadingRef.current?.(true);
        uploadRef
          .current(file)
          .then((url) => {
            if (!url) return;
            const { schema, tr } = view.state;
            if (!schema.nodes.image) return;
            view.dispatch(tr.replaceSelectionWith(schema.nodes.image.create({ src: url })));
          })
          .catch((err) => console.error("Image paste upload error:", err))
          .finally(() => setUploadingRef.current?.(false));

        return true;
      }
    }
    return false;
  }, []); // stable — reads from refs at call time
}
