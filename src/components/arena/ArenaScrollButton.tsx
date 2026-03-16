interface ArenaScrollButtonProps {
  visible: boolean;
  onClick: () => void;
}

export default function ArenaScrollButton({ visible, onClick }: ArenaScrollButtonProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full border border-border bg-card/95 backdrop-blur-sm px-3 py-1.5 text-xs text-muted-foreground shadow-lg transition-all hover:text-foreground hover:border-primary"
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
      Nouveaux messages
    </button>
  );
}
