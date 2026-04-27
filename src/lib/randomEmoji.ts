/** Curated list of emojis used to auto-assign a visual marker to newly created records. */
export const RANDOM_EMOJIS = [
  "🚀", "💡", "🎯", "⭐", "🔥", "💎", "🏆", "📈", "🤝", "💼",
  "🎪", "🌟", "⚡", "🎲", "🎸", "🌈", "🦁", "🐙", "🎨", "🍀",
  "🧩", "🔮", "🎁", "🛸", "🌊", "🏔️", "🎵", "🦊", "🐝", "🌻",
];

export function pickRandomEmoji(): string {
  return RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];
}
