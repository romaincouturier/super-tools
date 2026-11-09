import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface LineRect { left: number; top: number; width: number }

/** Texte souligné d'un trait jaune « crayonné », un trait sous chaque ligne réelle. */
export function HandDrawnUnderline({ children, color = "#FFD100" }: { children: ReactNode; color?: string }) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [lines, setLines] = useState<LineRect[]>([]);

  useLayoutEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current, text = textRef.current;
      if (!wrap || !text) return;
      const base = wrap.getBoundingClientRect();
      const rows = new Map<number, LineRect>();
      for (const r of Array.from(text.getClientRects())) {
        if (r.width < 1) continue;
        const key = Math.round(r.bottom);
        const prev = rows.get(key);
        const left = r.left - base.left, right = r.right - base.left;
        if (prev) {
          const pr = prev.left + prev.width;
          prev.left = Math.min(prev.left, left);
          prev.width = Math.max(pr, right) - prev.left;
        } else rows.set(key, { left, top: r.bottom - base.top, width: right - left });
      }
      setLines(Array.from(rows.values()));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current?.parentElement) ro.observe(wrapRef.current.parentElement);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [children]);

  return (
    <span ref={wrapRef} className="relative inline">
      <span ref={textRef} className="relative" style={{ zIndex: 1 }}>{children}</span>
      {lines.map((l, i) => (
        <svg
          key={i}
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 200 12"
          preserveAspectRatio="none"
          className="pointer-events-none absolute"
          style={{ left: l.left - 2, top: l.top - 6, width: l.width + 4, height: 12, zIndex: 0, overflow: "visible" }}
        >
          <path
            d="M3 7.5 C 30 4.5, 55 9, 85 6.2 S 140 4, 165 7 S 190 6.5, 197 5"
            fill="none"
            stroke={color}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ))}
    </span>
  );
}
