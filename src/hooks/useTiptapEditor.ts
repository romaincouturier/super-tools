import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import type { AnyExtension } from "@tiptap/core";
import LmsLinkDialog from "@/components/lms/LmsLinkDialog";

interface UseTiptapEditorOptions {
  content: string | null | undefined;
  onChange: (html: string) => void;
  extraExtensions?: AnyExtension[];
  editorProps?: Record<string, unknown>;
  onFocus?: (props: { editor: Editor }) => void;
}

/**
 * Shared Tiptap editor setup used by RichTextEditor and CrmDescriptionEditor.
 * Provides the common StarterKit + Link + Underline extensions and the setLink callback.
 * Also returns a `linkDialog` React element to render — opened by `setLink()`.
 */
export function useTiptapEditor({
  content,
  onChange,
  extraExtensions = [],
  editorProps,
  onFocus,
}: UseTiptapEditorOptions) {
  // Track whether the update came from the editor itself
  const isInternalUpdate = useRef(false);
  const safeContent = content ?? "";
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkDialogInitial, setLinkDialogInitial] = useState<string>("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
      Underline,
      ...extraExtensions,
    ],
    content: safeContent,
    editorProps: editorProps as any,
    onUpdate: ({ editor }) => {
      isInternalUpdate.current = true;
      onChange(editor.getHTML());
    },
    onFocus,
  });

  // Sync editor content when the prop changes externally.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (editor.isFocused) return;
    const currentHTML = editor.getHTML();
    if (currentHTML !== safeContent) {
      editor.commands.setContent(safeContent, { emitUpdate: false });
    }
  }, [editor, safeContent]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = (editor.getAttributes("link").href as string) || "";
    setLinkDialogInitial(previousUrl);
    setLinkDialogOpen(true);
  }, [editor]);

  const applyLink = useCallback(
    (url: string) => {
      if (!editor) return;
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    },
    [editor],
  );

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
  }, [editor]);

  const linkDialog = createElement(LmsLinkDialog, {
    open: linkDialogOpen,
    initialUrl: linkDialogInitial,
    onOpenChange: setLinkDialogOpen,
    onApply: applyLink,
    onRemove: removeLink,
  });

  return { editor, setLink, linkDialog };
}
