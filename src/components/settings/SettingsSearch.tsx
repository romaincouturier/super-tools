import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  SETTINGS_CATALOG,
  SETTINGS_TAB_LABELS,
  type SettingsCatalogEntry,
} from "./settingsCatalog";

interface SettingsSearchProps {
  isAdmin: boolean;
  onSelect: (entry: SettingsCatalogEntry) => void;
}

const SettingsSearch = ({ isAdmin, onSelect }: SettingsSearchProps) => {
  const [open, setOpen] = useState(false);
  const entries = SETTINGS_CATALOG.filter((e) => isAdmin || !e.adminOnly);

  // "/" opens the palette (unless typing in a field).
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement | null)?.isContentEditable) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full max-w-md items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Rechercher un paramètre…</span>
        <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded border bg-muted text-[10px]">/</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Rechercher un paramètre (ex: Sentry, Stripe, BCC, TVA…)" />
        <CommandList>
          <CommandEmpty>Aucun paramètre trouvé.</CommandEmpty>
          <CommandGroup heading="Paramètres">
            {entries.map((entry) => (
              <CommandItem
                key={entry.id}
                value={`${entry.label} ${entry.keywords ?? ""} ${entry.id}`}
                onSelect={() => {
                  setOpen(false);
                  onSelect(entry);
                }}
              >
                <span className="flex-1 truncate">{entry.label}</span>
                <span className="ml-auto pl-2 text-xs text-muted-foreground shrink-0">
                  {SETTINGS_TAB_LABELS[entry.tab]}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default SettingsSearch;
