/**
 * Shared Tiptap mention suggestion config.
 * Fetches app users from the `profiles` table (once, cached) and renders
 * a small popup via tippy.js with keyboard navigation.
 *
 * The Tiptap `Mention` node writes `<span data-type="mention" data-id="<user_id>">@Name</span>`
 * into the HTML, so mentioned user IDs can be extracted from any saved HTML
 * via {@link extractMentionedUserIdsFromHtml}.
 *
 * Used by:
 *   - src/components/content/RichTextEditor.tsx (content module)
 *   - src/components/watch/WatchRichEditor.tsx (veille module)
 */
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface MentionItem {
  id: string;
  label: string;
}

interface MentionListProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}

const MentionList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  MentionListProps
>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const item = items[selectedIndex];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) return null;

  return (
    <div className="bg-popover border rounded-md shadow-md py-1 max-h-48 overflow-y-auto z-50">
      {items.map((item, index) => (
        <button
          key={item.id}
          onClick={() => command(item)}
          className={cn(
            "w-full text-left px-3 py-1.5 text-sm hover:bg-accent",
            index === selectedIndex && "bg-accent",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
});
MentionList.displayName = "MentionList";

let cachedProfiles: MentionItem[] | null = null;

async function fetchMentionProfiles(): Promise<MentionItem[]> {
  if (cachedProfiles) return cachedProfiles;
  const { data } = await supabase
    .from("profiles")
    .select("user_id, email, first_name, last_name, display_name")
    .order("first_name");
  cachedProfiles = (data || []).map((p) => ({
    id: p.user_id,
    label:
      p.first_name && p.last_name
        ? `${p.first_name} ${p.last_name}`
        : p.display_name || p.email,
  }));
  return cachedProfiles;
}

export const mentionSuggestion = {
  items: async ({ query }: { query: string }) => {
    const profiles = await fetchMentionProfiles();
    return profiles
      .filter((p) => p.label.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 6);
  },
  render: () => {
    let component: ReactRenderer;
    let popup: TippyInstance[];

    return {
      onStart: (props: { editor: unknown; clientRect?: (() => DOMRect | null) | null }) => {
        component = new ReactRenderer(MentionList, {
          props: props as unknown as MentionListProps,
          editor: props.editor as never,
        });

        if (!props.clientRect) return;

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
      },
      onUpdate: (props: { clientRect?: (() => DOMRect | null) | null }) => {
        component?.updateProps(props as unknown as MentionListProps);
        if (props.clientRect) {
          popup?.[0]?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
        }
      },
      onKeyDown: (props: { event: KeyboardEvent }) => {
        if (props.event.key === "Escape") {
          popup?.[0]?.hide();
          return true;
        }
        return (component?.ref as { onKeyDown?: (p: { event: KeyboardEvent }) => boolean } | null)?.onKeyDown?.(props) ?? false;
      },
      onExit: () => {
        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },
};

/**
 * Extract the user IDs mentioned in a Tiptap-produced HTML string.
 *
 * Tiptap's Mention node is serialised as:
 *   <span data-type="mention" data-id="<user_uuid>" data-label="@Name">@Name</span>
 *
 * This helper parses the HTML in a detached DOM and returns unique user IDs
 * in insertion order.
 */
export function extractMentionedUserIdsFromHtml(html: string | null | undefined): string[] {
  if (!html) return [];
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return [];
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const nodes = doc.querySelectorAll('[data-type="mention"][data-id]');
    const ids: string[] = [];
    nodes.forEach((n) => {
      const id = n.getAttribute("data-id");
      if (id && !ids.includes(id)) ids.push(id);
    });
    return ids;
  } catch {
    return [];
  }
}
