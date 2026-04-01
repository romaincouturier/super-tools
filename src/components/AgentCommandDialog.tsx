import { useEffect, useState, type KeyboardEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bot, Send, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const QUICK_ACTIONS = [
  { label: "Résumé CRM de la semaine", query: "Donne-moi un résumé de l'activité CRM cette semaine : nouvelles opportunités, relances en attente, deals gagnés/perdus." },
  { label: "Devis en cours", query: "Liste les devis en cours (draft ou envoyés) avec leurs montants et clients." },
  { label: "Formations à venir", query: "Quelles formations sont prévues dans les 30 prochains jours ? Donne les dates, clients et lieux." },
  { label: "Emails non traités", query: "Y a-t-il des emails reçus non traités récemment ?" },
];

export default function AgentCommandDialog() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        // Don't intercept if already on agent page
        if (location.pathname === "/agent") return;
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [location.pathname]);

  const goToAgent = (query: string) => {
    if (!query.trim()) return;
    setOpen(false);
    setInput("");
    navigate(`/agent?q=${encodeURIComponent(query.trim())}`);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      goToAgent(input);
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden w-full">
        <DialogTitle className="sr-only">Agent IA</DialogTitle>
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Bot className="h-5 w-5 text-primary shrink-0" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez une question à l'agent..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            autoFocus
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={!input.trim()}
            onClick={() => goToAgent(input)}
            className="shrink-0 h-7 px-2"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="p-2 max-h-[280px] overflow-y-auto">
          <p className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Actions rapides
          </p>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => goToAgent(action.query)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-left hover:bg-muted transition-colors group"
            >
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
              <span className="truncate">{action.label}</span>
            </button>
          ))}
        </div>
        <div className="border-t px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Entrée pour envoyer</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px]">Esc</kbd>
            pour fermer
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
