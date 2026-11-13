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
  // Only parse sample tables; expanding every video/audio sample exceeds serverless CPU and memory.
  mp4.buildSampleLists = () => {
    for (const track of mp4.moov.traks) {
      track.samples = [];
      track.samples_duration = 0;
      track.samples_size = 0;
    }
  };
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
  const audioTrack = mp4.getTrackById(track.id);
  const expected = audioTrack.mdia.mdhd.duration / audioTrack.mdia.mdhd.timescale;
  const start = partIndex * AUDIO_PART_SECONDS;
  if (start >= expected) throw new Error("Morceau audio hors durée de l’enregistrement.");
  const table = audioTrack.mdia.minf.stbl;
  const sizes = table.stsz?.sample_sizes;
  const offsets = table.stco?.chunk_offsets ?? table.co64?.chunk_offsets;
  if (!sizes || !offsets || !table.stsc || !table.stts) throw new Error("Tables audio MP4 manquantes.");
  const samples: Array<{ offset: number; size: number; dts: number; duration: number; timescale: number }> = [];
  let sampleIndex = 0;
  let dts = 0;
  let timingRun = 0;
  let timingRemaining = table.stts.sample_counts[0];
  let chunkRun = 0;
  for (let chunk = 0; chunk < offsets.length; chunk++) {
    if (chunkRun + 1 < table.stsc.first_chunk.length && chunk + 1 >= table.stsc.first_chunk[chunkRun + 1]) chunkRun++;
    let position = offsets[chunk];
    for (let n = 0; n < table.stsc.samples_per_chunk[chunkRun] && sampleIndex < sizes.length; n++, sampleIndex++) {
      if (!timingRemaining) { timingRun++; timingRemaining = table.stts.sample_counts[timingRun]; }
      const duration = table.stts.sample_deltas[timingRun];
      if (dts / track.timescale >= start && dts / track.timescale < start + AUDIO_PART_SECONDS) {
        samples.push({ offset: position, size: sizes[sampleIndex], dts, duration, timescale: track.timescale });
      }
      position += sizes[sampleIndex];
      dts += duration;
      timingRemaining--;
    }
    if (dts / track.timescale >= start + AUDIO_PART_SECONDS) break;
  }
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