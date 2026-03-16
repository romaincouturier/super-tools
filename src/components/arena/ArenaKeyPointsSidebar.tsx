interface ArenaKeyPointsSidebarProps {
  keyPoints: string[];
}

export default function ArenaKeyPointsSidebar({ keyPoints }: ArenaKeyPointsSidebarProps) {
  if (keyPoints.length === 0) return null;

  return (
    <div className="hidden w-72 shrink-0 border-l border-border p-4 lg:block">
      <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase">Points cles</h3>
      <div className="space-y-2">
        {keyPoints.map((point, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span className="text-muted-foreground">{point}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
