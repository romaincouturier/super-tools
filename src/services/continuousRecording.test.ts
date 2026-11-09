import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContinuousRecording } from "./continuousRecording";

class Recorder {
  static instances: Recorder[] = [];
  static events: string[] = [];
  state = "inactive";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  onerror?: (error: unknown) => void;
  id = Recorder.instances.length;
  constructor() { Recorder.instances.push(this); }
  start() { this.state = "recording"; Recorder.events.push(`start-${this.id}`); }
  stop() {
    this.state = "inactive";
    Recorder.events.push(`stop-${this.id}`);
    this.ondataavailable?.({ data: new Blob([`segment-${this.id}`]) });
    this.onstop?.();
  }
}

describe("enregistrement continu", () => {
  beforeEach(() => { vi.useFakeTimers(); Recorder.instances = []; Recorder.events = []; vi.stubGlobal("MediaRecorder", Recorder); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  const setup = (onSegment = vi.fn(async () => {})) => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const error = vi.fn();
    return { recording: new ContinuousRecording(stream, "audio/webm;codecs=opus", 300000, onSegment, error), track, error, onSegment };
  };
  it("relance après cinq minutes avant d’arrêter le segment précédent sans couper le micro", async () => {
    const { recording, track, onSegment } = setup();
    recording.start();
    await vi.advanceTimersByTimeAsync(600000);
    expect(Recorder.events).toEqual(["start-0", "start-1", "stop-0", "start-2", "stop-1"]);
    expect(track.stop).not.toHaveBeenCalled();
    await recording.stop();
    expect(onSegment).toHaveBeenCalledTimes(3);
    expect(onSegment.mock.calls.map(([blob]) => blob.type)).toEqual(["audio/webm", "audio/webm", "audio/webm"]);
    await vi.advanceTimersByTimeAsync(300000);
    expect(Recorder.instances).toHaveLength(3);
  });
  it("continue à capturer même si la transcription précédente attend le réseau", async () => {
    let release: () => void = () => {};
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const { recording, onSegment } = setup(vi.fn(() => waiting));
    recording.start();
    await vi.advanceTimersByTimeAsync(600000);
    expect(Recorder.instances).toHaveLength(3);
    const stopped = recording.stop();
    release();
    await stopped;
    expect(onSegment).toHaveBeenCalledTimes(3);
  });
  it("signale l’échec d’un segment sans abandonner les segments suivants", async () => {
    const { recording, error, onSegment } = setup(vi.fn().mockRejectedValueOnce(new Error("réseau")).mockResolvedValue(undefined));
    recording.start();
    await vi.advanceTimersByTimeAsync(300000);
    await recording.stop();
    expect(error).toHaveBeenCalledTimes(1);
    expect(onSegment).toHaveBeenCalledTimes(2);
  });
});