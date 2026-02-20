import type { SessionConfig, SessionResult } from "./types";

export interface SavedSession {
  id: string;
  date: string;
  topic: string;
  mode: SessionConfig["mode"];
  agentNames: string[];
  turns: number;
  cost: number;
  config: SessionConfig;
  result: SessionResult;
}

const STORAGE_KEY_PREFIX = "ai-arena-history";
const MAX_SESSIONS = 30;

function storageKey(userId?: string): string {
  return userId ? `${STORAGE_KEY_PREFIX}-${userId}` : STORAGE_KEY_PREFIX;
}

export function getSavedSessions(userId?: string): SavedSession[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as SavedSession[];
  } catch {
    // intentionally empty – return empty array if localStorage parse fails
    return [];
  }
}

export function saveSession(config: SessionConfig, result: SessionResult, userId?: string): string {
  const sessions = getSavedSessions(userId);
  const id = crypto.randomUUID?.() || Date.now().toString(36);
  const entry: SavedSession = {
    id,
    date: new Date().toISOString(),
    topic: config.topic,
    mode: config.mode,
    agentNames: config.agents.map((a) => a.name),
    turns: result.metrics.totalTurns,
    cost: result.metrics.estimatedCost,
    config,
    result,
  };
  sessions.unshift(entry);
  if (sessions.length > MAX_SESSIONS) sessions.length = MAX_SESSIONS;
  localStorage.setItem(storageKey(userId), JSON.stringify(sessions));
  return id;
}

export function getSession(id: string, userId?: string): SavedSession | null {
  return getSavedSessions(userId).find((s) => s.id === id) || null;
}

export function deleteSession(id: string, userId?: string): void {
  const sessions = getSavedSessions(userId).filter((s) => s.id !== id);
  localStorage.setItem(storageKey(userId), JSON.stringify(sessions));
}
