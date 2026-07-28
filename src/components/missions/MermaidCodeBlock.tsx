import { useEffect, useMemo, useRef, useState } from "react";
import CodeBlock from "@tiptap/extension-code-block";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { Code2, Workflow } from "lucide-react";

/** Heuristic: does the code block content look like a Mermaid diagram? */
export function looksLikeMermaid(text: string): boolean {
  const first = text.trim().split("\n")[0]?.trim().toLowerCase() ?? "";
  return /^(graph\s|flowchart\s|sequencediagram|statediagram(-v2)?|classdiagram|erdiagram|journey|gantt|pie\b|mindmap|timeline|quadrantchart|gitgraph|c4context|requirementdiagram|sankey-beta|xychart-beta|block-beta)/.test(
    first,
  );
}

let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      m.default.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "default",
        fontFamily: "inherit",
      });
      return m.default;
    });
  }
  return mermaidPromise;
}

function MermaidPreview({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mmd-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadMermaid()
      .then((mermaid) => mermaid.render(idRef.current, code))
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Diagramme invalide");
        document.getElementById(`d${idRef.current}`)?.remove();
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
        Mermaid : {error}
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-md border bg-background p-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function MermaidCodeBlockView({ node }: NodeViewProps) {
  const code = node.textContent;
  const isMermaid = useMemo(() => looksLikeMermaid(code), [code]);
  const [showSource, setShowSource] = useState(false);

  if (!isMermaid) {
    return (
      <NodeViewWrapper>
        <pre className="bg-muted/50 rounded-md p-4 font-mono text-sm">
          <NodeViewContent as="code" />
        </pre>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="my-4 not-prose">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <Workflow size={12} /> Mermaid
        </span>
        <button
          type="button"
          contentEditable={false}
          onClick={() => setShowSource((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          <Code2 size={12} />
          {showSource ? "Masquer la source" : "Voir la source"}
        </button>
      </div>

      {!showSource && <MermaidPreview code={code} />}

      <pre
        className={`bg-muted/50 rounded-md p-4 font-mono text-sm ${showSource ? "" : "hidden"}`}
      >
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

/** CodeBlock that renders Mermaid sources as diagrams, with a source toggle. */
export const MermaidCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MermaidCodeBlockView);
  },
});
