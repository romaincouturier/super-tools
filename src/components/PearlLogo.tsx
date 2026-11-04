interface PearlLogoProps {
  size?: number;
  className?: string;
}

/** Coquillage ouvert avec une perle qui brille. */
export default function PearlLogo({ size = 24, className }: PearlLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="Perle client"
    >
      <path
        d="M4 30c0-11 8-20 20-20s20 9 20 20c0 6-8 11-20 11S4 36 4 30z"
        fill="#F3C9B6"
        stroke="#C98E75"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M24 10v31M16 12l4 29M32 12l-4 29M9 19l9 22M39 19l-9 22" stroke="#C98E75" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M6 31c4 7 10 10 18 10s14-3 18-10c-5 3-11 4-18 4S11 34 6 31z" fill="#E3A98F" />
      <circle cx="24" cy="26" r="7" fill="#FFFFFF" stroke="#D9DCE3" strokeWidth="1" />
      <ellipse cx="21.5" cy="23.5" rx="2.4" ry="1.7" fill="#FFFFFF" transform="rotate(-30 21.5 23.5)" opacity="0.95" />
      <path d="M38 6l1.2 3 3 1.2-3 1.2L38 14.4l-1.2-3-3-1.2 3-1.2z" fill="#F5C542" />
      <path d="M9 4l.8 2 2 .8-2 .8L9 9.6l-.8-2-2-.8 2-.8z" fill="#F5C542" />
    </svg>
  );
}
