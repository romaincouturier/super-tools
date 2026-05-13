import { useEffect, useRef, useState } from "react";
import { Settings, X } from "lucide-react";

interface TweakValues {
  contentWidth: number;
  h1Size: number;
  blockRadius: number;
  density: "compact" | "normal" | "spacious";
  showArc: boolean;
}

interface Props {
  values: TweakValues;
  onChange: (values: TweakValues) => void;
}

export default function BuilderTweaksPanel({ values, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const set = <K extends keyof TweakValues>(key: K, value: TweakValues[K]) =>
    onChange({ ...values, [key]: value });

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <>
      {/* Floating gear button */}
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 w-10 h-10 flex items-center justify-center rounded-full transition-all duration-150 shadow-md hover:scale-105"
        style={{
          background: "var(--st-ink)",
          color: "#fff",
          fontFamily: "inherit",
        }}
        aria-label="Paramètres d'affichage"
      >
        <Settings size={16} />
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-20 right-6 z-40 w-72 p-5 flex flex-col gap-5"
          style={{
            background: "var(--st-white)",
            borderRadius: "var(--st-radius-block)",
            boxShadow: "0 8px 32px rgba(16,24,32,0.14)",
            border: "1px solid rgba(16,24,32,0.09)",
            fontFamily: "inherit",
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--st-ink)" }}>
              Apparence
            </p>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 flex items-center justify-center rounded-full transition-colors hover:bg-black/[0.08]"
              style={{ color: "var(--st-ink-muted)" }}
            >
              <X size={14} />
            </button>
          </div>

          <Slider
            label="Largeur du contenu"
            value={values.contentWidth}
            min={600}
            max={1000}
            step={20}
            display={`${values.contentWidth}px`}
            onChange={(v) => set("contentWidth", v)}
          />

          <Slider
            label="Taille du titre H1"
            value={values.h1Size}
            min={28}
            max={60}
            step={2}
            display={`${values.h1Size}px`}
            onChange={(v) => set("h1Size", v)}
          />

          <Slider
            label="Arrondi des blocs"
            value={values.blockRadius}
            min={0}
            max={28}
            step={4}
            display={`${values.blockRadius}px`}
            onChange={(v) => set("blockRadius", v)}
          />

          {/* Density */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium" style={{ color: "var(--st-ink-muted)" }}>
              Densité
            </p>
            <div className="flex gap-1">
              {(["compact", "normal", "spacious"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => set("density", d)}
                  className="flex-1 py-1.5 text-xs font-medium rounded-full transition-all capitalize"
                  style={{
                    background: values.density === d ? "var(--st-ink)" : "var(--st-surface)",
                    color: values.density === d ? "#fff" : "var(--st-ink-muted)",
                    fontFamily: "inherit",
                  }}
                >
                  {d === "compact" ? "Serré" : d === "normal" ? "Normal" : "Aéré"}
                </button>
              ))}
            </div>
          </div>

          {/* Arc Tilt toggle */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium" style={{ color: "var(--st-ink-muted)" }}>
              Arc Tilt décoratif
            </p>
            <button
              onClick={() => set("showArc", !values.showArc)}
              className="w-10 h-5 rounded-full relative"
              style={{
                background: values.showArc ? "var(--st-yellow)" : "rgba(16,24,32,0.15)",
                transition: "background 150ms",
              }}
              aria-checked={values.showArc}
              role="switch"
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full"
                style={{
                  background: "var(--st-white)",
                  left: values.showArc ? "calc(100% - 18px)" : "2px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  transition: "left 150ms ease",
                }}
              />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: "var(--st-ink-muted)" }}>
          {label}
        </p>
        <span className="text-xs font-semibold" style={{ color: "var(--st-ink)" }}>
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--st-ink) 0%, var(--st-ink) ${((value - min) / (max - min)) * 100}%, rgba(16,24,32,0.12) ${((value - min) / (max - min)) * 100}%, rgba(16,24,32,0.12) 100%)`,
          accentColor: "var(--st-ink)",
        }}
      />
    </div>
  );
}

export type { TweakValues };
