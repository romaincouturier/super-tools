/**
 * Mémorise, poste par poste, les avis dont le DCE a été ouvert.
 *
 * L'analyse du DCE se fait hors de l'application (Claude Cowork) : rien ne
 * revient en base. Un simple drapeau local suffit à distinguer « pas encore
 * regardé » de « en cours d'analyse », en attendant le Go / No Go.
 */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "tender-dce-opened";
/** Un événement maison : plusieurs cartes lisent la même clé au même moment. */
const CHANGE_EVENT = "tender-dce-opened-change";

function readSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set();
  }
}

export function useDceReviewFlag(tenderId: string) {
  const [opened, setOpened] = useState(() => readSet().has(tenderId));

  useEffect(() => {
    const sync = () => setOpened(readSet().has(tenderId));
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [tenderId]);

  const markOpened = useCallback(() => {
    const set = readSet();
    set.add(tenderId);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    } catch {
      // Mode privé ou quota : le drapeau reste en mémoire pour cette session.
    }
    setOpened(true);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [tenderId]);

  return { opened, markOpened };
}
