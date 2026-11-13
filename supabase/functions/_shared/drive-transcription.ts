export const GOOGLE_MEET_ROOT = "1GzvSFXpyQHLTbXfY4OowRn6hrOeUzQHY";
export const AUDIO_PART_SECONDS = 45 * 60;
export const ASSEMBLY_UPLOAD_MAX_BYTES = 2_200_000_000;
export const ASSEMBLY_MAX_SECONDS = 10 * 60 * 60;

export interface AudioPart {
  index: number;
  start: number;
  duration: number;
  job_id: string;
  text?: string;
  actual_duration?: number;
}

export function assertCompleteDuration(expected: number, actual: number): void {
  if (expected > 0 && (!Number.isFinite(actual) || Math.abs(expected - actual) > Math.max(30, expected * 0.01))) {
    throw new Error(`Transcription incomplète : ${actual} s traitées pour ${Math.round(expected)} s attendues.`);
  }
}

export function assembleAudioParts(parts: AudioPart[], expected: number): { text: string; duration: number } {
  const ordered = [...parts].sort((a, b) => a.index - b.index);
  let end = 0;
  let duration = 0;
  for (const [index, part] of ordered.entries()) {
    if (part.index !== index || Math.abs(part.start - end) > 1 || part.text === undefined || part.actual_duration === undefined) {
      throw new Error("Transcription incomplète : un morceau audio manque.");
    }
    assertCompleteDuration(part.duration, part.actual_duration);
    end = part.start + part.duration;
    duration += part.actual_duration;
  }
  assertCompleteDuration(expected, end);
  assertCompleteDuration(expected, duration);
  return { text: ordered.map((p) => p.text).join("\n\n"), duration: Math.round(duration) };
}

export async function discoverDriveVideos<T extends { id: string; mimeType: string }>(
  roots: string[],
  list: (folder: string, pageToken?: string) => Promise<{ files: T[]; nextPageToken?: string }>,
): Promise<T[]> {
  const queue = [...new Set(roots)];
  const visited = new Set<string>();
  const videos = new Map<string, T>();
  for (let i = 0; i < queue.length; i++) {
    const folder = queue[i];
    if (visited.has(folder)) continue;
    visited.add(folder);
    let pageToken: string | undefined;
    do {
      const page = await list(folder, pageToken);
      for (const file of page.files) {
        if (file.mimeType === "application/vnd.google-apps.folder") queue.push(file.id);
        else if (file.mimeType.startsWith("video/")) videos.set(file.id, file);
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
  }
  return [...videos.values()];
}

export function adtsHeader(size: number, sampleRate: number, channels: number, objectType = 2): Uint8Array {
  const frequency = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350].indexOf(sampleRate);
  const length = size + 7;
  if (frequency < 0 || channels < 1 || channels > 7 || length > 8191 || objectType < 1 || objectType > 4) {
    throw new Error("Piste AAC non prise en charge pour l’extraction audio.");
  }
  return new Uint8Array([255, 241, ((objectType - 1) << 6) | (frequency << 2) | (channels >> 2), ((channels & 3) << 6) | (length >> 11), (length >> 3) & 255, ((length & 7) << 5) | 31, 252]);
}