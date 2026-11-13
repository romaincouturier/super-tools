import { createFile } from "npm:mp4box@2.5.0";
import { adtsHeader, AUDIO_PART_SECONDS } from "./drive-transcription.ts";

const RANGE_BYTES = 4 * 1024 * 1024;

async function readRange(fileId: string, token: string, start: number, end: number): Promise<ArrayBuffer> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}`, Range: `bytes=${start}-${end}` },
  });
  if (res.status !== 206) {
    await res.body?.cancel();
    throw new Error(`Drive extraction audio : lecture partielle refusée (${res.status}).`);
  }
  return res.arrayBuffer();
}

export async function extractDriveAudioPart(fileId: string, token: string, size: number, partIndex: number) {
  const mp4 = createFile();
  let ready = false;
  let parseError = "";
  mp4.onReady = () => { ready = true; };
  mp4.onError = (_module, message) => { parseError = message; };
  let offset = 0;
  for (let count = 0; !ready && offset < size && count < 32; count++) {
    const buffer = await readRange(fileId, token, offset, Math.min(size - 1, offset + RANGE_BYTES - 1));
    const positioned = Object.assign(buffer, { fileStart: offset });
    const next = mp4.appendBuffer(positioned);
    if (parseError) throw new Error(`MP4 : ${parseError}`);
    offset = Math.max(offset + buffer.byteLength, next || 0);
  }
  if (!ready) throw new Error("Métadonnées MP4 introuvables : extraction audio impossible.");
  const info = mp4.getInfo();
  if (info.isFragmented) throw new Error("MP4 fragmenté : extraction audio non prise en charge.");
  const track = info.audioTracks[0];
  if (!track?.audio || !track.codec.startsWith("mp4a.40.")) throw new Error("La vidéo doit contenir une piste audio AAC (MP4 Google Meet).");
  const objectType = Number(track.codec.split(".")[2]);
  const expected = track.duration / track.timescale;
  const start = partIndex * AUDIO_PART_SECONDS;
  if (start >= expected) throw new Error("Morceau audio hors durée de l’enregistrement.");
  const samples = mp4.getTrackSamplesInfo(track.id).filter((s) => s.dts / s.timescale >= start && s.dts / s.timescale < start + AUDIO_PART_SECONDS);
  if (!samples.length) throw new Error("Aucun échantillon audio dans le morceau.");
  const totalBytes = samples.reduce((sum, s) => sum + s.size + 7, 0);
  if (totalBytes > 64 * 1024 * 1024) throw new Error("Morceau audio supérieur à 64 Mo : extraction arrêtée sans tronquer.");
  const bytes = new Uint8Array(totalBytes);
  let cacheStart = -1;
  let cache = new Uint8Array();
  let written = 0;
  for (const sample of samples) {
    if (sample.offset < cacheStart || sample.offset + sample.size > cacheStart + cache.length) {
      cacheStart = sample.offset;
      cache = new Uint8Array(await readRange(fileId, token, cacheStart, Math.min(size - 1, cacheStart + Math.max(RANGE_BYTES, sample.size) - 1)));
    }
    const header = adtsHeader(sample.size, track.audio.sample_rate, track.audio.channel_count, objectType);
    bytes.set(header, written);
    written += header.length;
    const data = cache.subarray(sample.offset - cacheStart, sample.offset - cacheStart + sample.size);
    if (data.length !== sample.size) throw new Error("Lecture Drive incomplète : échantillon audio manquant.");
    bytes.set(data, written);
    written += data.length;
  }
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last) throw new Error("Morceau audio vide.");
  return {
    bytes, expected,
    start: first.dts / first.timescale,
    duration: (last.dts + last.duration) / last.timescale - first.dts / first.timescale,
    totalParts: Math.ceil(expected / AUDIO_PART_SECONDS),
  };
}