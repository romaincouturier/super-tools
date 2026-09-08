interface WatermarkOverlayProps {
  text: string;
  dense?: boolean;
}

export default function WatermarkOverlay({ text, dense = false }: WatermarkOverlayProps) {
  const rows = dense ? 5 : 4;
  const cols = dense ? 3 : 2;
  const cells = Array.from({ length: rows * cols });

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden select-none"
      style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div
        className="absolute grid w-[160%] h-[160%] -left-[30%] -top-[30%]"
        style={{
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          transform: 'rotate(-24deg)',
        }}
      >
        {cells.map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            <span
              className="whitespace-nowrap font-semibold text-white/25"
              style={{
                fontSize: dense ? '11px' : 'clamp(14px, 2vw, 22px)',
                textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                letterSpacing: '0.05em',
              }}
            >
              {text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
