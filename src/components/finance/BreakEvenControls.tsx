import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface SliderFieldProps {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}

export function SliderField({ label, value, suffix, min, max, step, onChange, badge, action }: SliderFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-sm">{label}</Label>
          {badge}
        </div>
        <div className="flex items-center gap-2">
          {action}
          <span className="text-sm font-medium tabular-nums">{suffix}</span>
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[Math.min(Math.max(value, min), max)]}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}

interface MetricProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative";
}

export function Metric({ label, value, hint, tone = "default" }: MetricProps) {
  const toneClass =
    tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "text-foreground";
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
