import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Maximize2, RotateCcw, X } from "lucide-react";

interface Props {
  src: string;
  alt?: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;

export default function ImageLightbox({ src, alt, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);
  const lastTouchPos = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  // Lock body scroll + Escape key
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const applyZoom = (delta: number) => {
    setScale((prev) => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev + delta));
      if (next <= MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    applyZoom(e.deltaY < 0 ? 0.2 : -0.2);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    dragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).style.cursor = "grabbing";
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    dragging.current = false;
    (e.currentTarget as HTMLElement).style.cursor = scale > 1 ? "grab" : "default";
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      lastPinchDist.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && scale > 1) {
      const dx = e.touches[0].clientX - lastTouchPos.current.x;
      const dy = e.touches[0].clientY - lastTouchPos.current.y;
      lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    } else if (e.touches.length === 2 && lastPinchDist.current !== null) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy);
      applyZoom((dist - lastPinchDist.current) * 0.008);
      lastPinchDist.current = dist;
    }
  };

  const handleTouchEnd = () => { lastPinchDist.current = null; };

  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  const handleDownload = async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = src.split("/").pop()?.split("?")[0] || "image";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank");
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const btnStyle = (accent?: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontSize: ".8125rem",
    fontWeight: 600,
    fontFamily: "inherit",
    background: accent ? "#FFD100" : "rgba(255,255,255,0.14)",
    color: accent ? "#101820" : "#fff",
    transition: "background 120ms",
  });

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(16,24,32,0.93)",
        backdropFilter: "blur(6px)",
        cursor: scale > 1 ? "grab" : "default",
        touchAction: "none",
        userSelect: "none",
      }}
    >
      {/* Top controls */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 1,
        }}
      >
        {scale !== 1 && (
          <button
            style={btnStyle()}
            onClick={reset}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.24)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
            title="Réinitialiser le zoom"
          >
            <RotateCcw size={14} />
            {Math.round(scale * 100)} %
          </button>
        )}
        <button
          style={btnStyle(true)}
          onClick={handleDownload}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f0c400")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#FFD100")}
        >
          <Download size={14} />
          Télécharger
        </button>
        <button
          onClick={onClose}
          aria-label="Fermer (Échap)"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: "rgba(255,255,255,0.14)",
            color: "#fff",
            transition: "background 120ms",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.28)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
        >
          <X size={18} />
        </button>
      </div>

      {/* Image */}
      <img
        src={src}
        alt={alt || "Image agrandie"}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          objectFit: "contain",
          display: "block",
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: dragging.current ? "none" : "transform 80ms ease-out",
          pointerEvents: "none",
        }}
      />

      {/* Bottom hint */}
      <p
        style={{
          position: "absolute",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.38)",
          fontSize: ".6875rem",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        Molette / pincement pour zoomer · Glisser pour déplacer · Échap pour fermer
      </p>
    </div>,
    document.body,
  );
}

// ── Convenience wrapper used by viewers ──────────────────────────────────────

interface ImageWithLightboxProps {
  src: string;
  alt?: string;
  className?: string;
  imgStyle?: React.CSSProperties;
}

export function ImageWithLightbox({ src, alt, className, imgStyle }: ImageWithLightboxProps) {
  const [open, setOpen] = useState(false);

  const handleDownload = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = src.split("/").pop()?.split("?")[0] || "image";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Agrandir l'image"
        className={`relative group inline-block max-w-full rounded-lg overflow-hidden border-0 p-0 bg-transparent cursor-zoom-in align-top ${className ?? ""}`}
        style={{ fontFamily: "inherit" }}
      >
        <img
          src={src}
          alt={alt ?? ""}
          style={imgStyle}
          className="block max-w-full h-auto object-contain"
        />
        {/* Hover overlay — centered call to action */}
        <span
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ background: "rgba(16,24,32,0.32)" }}
        >
          <span
            className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-full"
            style={{ background: "rgba(16,24,32,0.82)" }}
          >
            <Maximize2 size={13} />
            Cliquer pour agrandir
          </span>
        </span>
        {/* Persistent corner badge — always visible affordance */}
        <span
          className="absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-full shadow-md transition-transform group-hover:scale-110 pointer-events-none"
          style={{ background: "rgba(255,255,255,0.92)", color: "#101820" }}
          aria-hidden
        >
          <Maximize2 size={14} />
        </span>
        {/* Download — discreet, on hover */}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => handleDownload(e)}
          onKeyDown={(e) => { if (e.key === "Enter") handleDownload(e); }}
          className="absolute bottom-2 right-2 flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(16,24,32,0.82)", color: "#fff", cursor: "pointer" }}
          title="Télécharger"
        >
          <Download size={11} />
          Télécharger
        </span>
      </button>
      {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
