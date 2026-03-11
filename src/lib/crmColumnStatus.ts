/**
 * Helpers for detecting CRM column statuses based on column names.
 * Centralises the "gagné" / "perdu" magic-string checks.
 */

export const isWonColumnName = (name: string): boolean =>
  name.toLowerCase().includes("gagné");

export const isLostColumnName = (name: string): boolean =>
  name.toLowerCase().includes("perdu");
