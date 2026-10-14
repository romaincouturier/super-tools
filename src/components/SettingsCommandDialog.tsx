import { useEffect, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Cog, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { SETTINGS_CATALOG, SETTINGS_TAB_LABELS, matchesSettingQuery } from "@/components/settings/settingsCatalog";

export default function SettingsCommandDialog() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const navigate = useNavigate();
  const { isAdmin } = useModuleAccess();

  const settingsMatches = input.trim()
    ? SETTINGS_CATALOG.filter((e) => (isAdmin || !e.adminOnly) && matchesSettingQuery(e, input)).slice(0, 8)
    : [];

  const goToSetting = (id: string) => {
    setOpen(false);
    setInput("");
    navigate(`/parametres?find=${encodeURIComponent(id)}`);
  };

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && settingsMatches.length > 0) {
      e.preventDefault();
      goToSetting(settingsMatches[0].id);
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden w-full">
        <DialogTitle className="sr-only">Rechercher un paramètre</DialogTitle>
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher un paramètre..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
        <div className="p-2 max-h-[280px] overflow-y-auto">
          {input.trim() && settingsMatches.length === 0 && (
            <p className="px-2 py-2 text-sm text-muted-foreground">Aucun paramètre trouvé.</p>
          )}
          {settingsMatches.map((entry) => (
            <button
              key={entry.id}
              onClick={() => goToSetting(entry.id)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-left hover:bg-muted transition-colors group"
            >
              <Cog className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
              <span className="flex-1 truncate">{entry.label}</span>
              <span className="ml-auto pl-2 text-[10px] text-muted-foreground shrink-0">
                {SETTINGS_TAB_LABELS[entry.tab]}
              </span>
            </button>
          ))}
        </div>
        <div className="border-t px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Entrée pour ouvrir le premier résultat</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px]">Esc</kbd>
            pour fermer
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
