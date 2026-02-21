import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Capitalize each part of a name: "jean-pierre" → "Jean-Pierre", "DE LA FONTAINE" → "De La Fontaine" */
export function capitalizeName(name: string): string;
export function capitalizeName(name: string | null | undefined): string | null;
export function capitalizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name
    .trim()
    .toLowerCase()
    .replace(/(^|[\s-])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
}

/** Normalize an email: trim and lowercase */
export function normalizeEmail(email: string): string;
export function normalizeEmail(email: string | null | undefined): string | null;
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}
