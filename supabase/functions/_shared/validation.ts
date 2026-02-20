/**
 * Zod Validation Module for Edge Functions
 *
 * Provides reusable schemas and a parseBody helper that validates
 * request JSON against a Zod schema, returning a typed result or
 * an error Response.
 */

import { z } from "https://esm.sh/zod@3.23.8";
import { createErrorResponse } from "./cors.ts";

export { z };

// ── Common reusable schemas ────────────────────────────────────────

export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const nonEmptyString = z.string().min(1);
export const isoDateString = z.string().min(1);

// Common field schemas used across many functions
export const trainingIdSchema = z.object({ trainingId: uuidSchema });
export const participantIdSchema = z.object({ participantId: uuidSchema });
export const tokenSchema = z.object({ token: nonEmptyString });

// ── parseBody helper ───────────────────────────────────────────────

/**
 * Parse and validate the JSON body of a Request against a Zod schema.
 *
 * Returns either `{ data, error: null }` or `{ data: null, error: Response }`.
 * The error Response is a 400 JSON response with CORS headers.
 *
 * Usage:
 * ```ts
 * const { data, error } = await parseBody(req, mySchema);
 * if (error) return error;
 * // data is fully typed
 * ```
 */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T>; error: null } | { data: null; error: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      data: null,
      error: createErrorResponse("Invalid JSON body", 400, req),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      data: null,
      error: createErrorResponse(`Validation error: ${issues}`, 400, req),
    };
  }

  return { data: result.data, error: null };
}
