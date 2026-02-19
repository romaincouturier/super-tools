import { useRef } from "react";
import type { AgentConfig, Provider, ApiKeys, DiscussionMode, Stance, ContextFile } from "@/lib/arena/types";
import { AVAILABLE_MODELS } from "@/lib/arena/types";

interface AgentCardProps {
  agent: AgentConfig;
  index: number;
  onUpdate: (agent: AgentConfig) => void;
  onRemove: () => void;
  canRemove: boolean;
  apiKeys: ApiKeys;
  mode: DiscussionMode;
}

export default function AgentCard({
  agent,
  index,
  onUpdate,
  onRemove,
  canRemove,
  apiKeys,
  mode,
}: AgentCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (partial: Partial<AgentConfig>) => {
    onUpdate({ ...agent, ...partial });
  };

  const providerAvailable = (p: Provider) => {
    if (p === "claude") return !!apiKeys.claude;
    if (p === "openai") return !!apiKeys.openai;
    if (p === "gemini") return !!apiKeys.gemini;
    return false;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles: ContextFile[] = [...(agent.contextFiles || [])];

    Array.from(files).forEach((file) => {
      if (file.size > 100_000) return;
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        newFiles.push({ name: file.name, content: content.slice(0, 50_000) });
        update({ contextFiles: [...newFiles] });
      };
      reader.readAsText(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    const files = [...(agent.contextFiles || [])];
    files.splice(idx, 1);
    update({ contextFiles: files });
  };

  const isExpert = !!agent.expertId;

  return (
    <div
      className="arena-card rounded-xl border p-5 transition-colors"
      style={{ borderLeftColor: agent.color, borderLeftWidth: 4 }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: agent.color }}
          >
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <input
              type="text"
              value={agent.name}
              onChange={(e) => update({ name: e.target.value })}
              className="bg-transparent text-lg font-semibold outline-none focus:underline"
              placeholder="Nom de l'agent"
            />
            {isExpert && (
              <p className="text-[10px] text-blue-500">Expert du pool</p>
            )}
          </div>
        </div>
        {canRemove && (
          <button
            onClick={onRemove}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Supprimer cet agent"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Provider</label>
            <select
              value={agent.provider}
              onChange={(e) => {
                const provider = e.target.value as Provider;
                const models = AVAILABLE_MODELS[provider];
                update({ provider, model: models[0].id });
              }}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="claude">Claude (Anthropic)</option>
              <option value="openai" disabled={!providerAvailable("openai")}>
                OpenAI {!apiKeys.openai && "(cle requise)"}
              </option>
              <option value="gemini" disabled={!providerAvailable("gemini")}>
                Gemini {!apiKeys.gemini && "(cle requise)"}
              </option>
            </select>
            <p className="mt-1 text-[10px] text-muted-foreground">Service IA qui alimente cet agent.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Modele</label>
            <select
              value={agent.model}
              onChange={(e) => update({ model: e.target.value })}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {AVAILABLE_MODELS[agent.provider].map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-muted-foreground">Modele plus puissant = meilleur mais plus cher.</p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Role</label>
          <input
            type="text"
            value={agent.role}
            onChange={(e) => update({ role: e.target.value })}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="Ex: Expert produit B2B SaaS"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Personnalite</label>
          <textarea
            value={agent.personality}
            onChange={(e) => update({ personality: e.target.value })}
            rows={2}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="Ex: Direct, data-driven, challenge les hypotheses"
          />
        </div>

        {isExpert && agent.frameworks && agent.frameworks.length > 0 && (
          <div className="rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-950/30">
            <p className="mb-1 text-[10px] font-medium text-blue-600 dark:text-blue-400">Frameworks de reference</p>
            <div className="flex flex-wrap gap-1">
              {agent.frameworks.map((f, i) => (
                <span key={i} className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">{f}</span>
              ))}
            </div>
            {agent.biases && (
              <>
                <p className="mt-2 mb-0.5 text-[10px] font-medium text-amber-500">Biais connus</p>
                <p className="text-[10px] text-muted-foreground">{agent.biases}</p>
              </>
            )}
            {agent.style && (
              <>
                <p className="mt-2 mb-0.5 text-[10px] font-medium text-emerald-500">Style de communication</p>
                <p className="text-[10px] text-muted-foreground">{agent.style}</p>
              </>
            )}
          </div>
        )}

        {mode === "decision" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Position</label>
            <select
              value={agent.stance || "neutre"}
              onChange={(e) => update({ stance: e.target.value as Stance })}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="pour">Pour</option>
              <option value="contre">Contre</option>
              <option value="neutre">Neutre</option>
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Documents de contexte</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              + Ajouter un fichier
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".txt,.md,.csv,.json,.yaml,.yml,.xml,.html,.js,.ts,.py,.java,.go,.rs"
              multiple
              onChange={handleFileUpload}
            />
            <span className="text-[10px] text-muted-foreground">Texte, Markdown, CSV, JSON... (max 100Ko)</span>
          </div>
          {agent.contextFiles && agent.contextFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              {agent.contextFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-muted px-2 py-1">
                  <svg className="h-3.5 w-3.5 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="flex-1 truncate text-[11px]">{file.name}</span>
                  <span className="text-[10px] text-muted-foreground">{(file.content.length / 1000).toFixed(1)}k</span>
                  <button
                    onClick={() => removeFile(i)}
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
