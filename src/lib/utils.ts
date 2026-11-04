import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Tout token qui crée une classe Tailwind maison doit être déclaré ici, sinon
// tailwind-merge classe text-micro comme une couleur et supprime l'une des deux classes.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["micro", "caption", "prose"] }],
      h: [{ h: ["control-sm", "control-md"] }],
      duration: [{ duration: ["fast", "base", "slow"] }],
      ease: [{ ease: ["brand"] }],
      shadow: [{ shadow: ["block", "card"] }],
      rounded: [{ rounded: ["block", "card"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Open an external URL in a new tab via an anchor click (avoids popup-blocker issues with window.open). */
export function openExternalLink(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  a.click();
}
