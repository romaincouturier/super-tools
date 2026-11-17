import { Progress } from "@/components/ui/progress";

export interface MediaUploadState {
  done: number;
  total: number;
  fileName: string;
  percent: number;
  failed: number;
}

export default function MediaUploadProgress({ state }: { state: MediaUploadState }) {
  return (
    <div className="w-full min-w-0 space-y-2 py-3" role="status" aria-live="polite">
      <div className="flex justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">{state.fileName}</span>
        <span className="shrink-0 tabular-nums">{state.percent} %</span>
      </div>
      <Progress value={state.percent} aria-label="Progression du fichier" className="h-2" />
      <p className="text-sm text-muted-foreground tabular-nums">
        {state.done} / {state.total} fichiers envoyés
        {state.failed > 0 && ` · ${state.failed} en échec`}
        {state.percent === 100 && state.done + state.failed < state.total && " · Enregistrement en cours"}
      </p>
    </div>
  );
}