import { reportEdgeError } from "./sentry.ts";

export async function reportDriveTranscriptionError(error: unknown, context: Record<string, unknown>): Promise<void> {
  await reportEdgeError(error, context);
}