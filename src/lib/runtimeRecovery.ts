// Intentionally empty — runtime recovery removed to stabilise production builds.
// This file is kept to avoid broken imports during transition.

export function isChunkLoadError(_error: unknown): boolean {
  return false;
}

export async function recoverFromStaleBuildOnce(_source: string, _error?: unknown): Promise<boolean> {
  return false;
}

export function installGlobalChunkRecovery() {
  // no-op
}
