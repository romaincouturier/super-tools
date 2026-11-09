import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useVoiceDictation } from "./useVoiceDictation";

const mocks = vi.hoisted(() => ({ transcribe: vi.fn(), invalidate: vi.fn(), error: vi.fn() }));
vi.mock("@/services/voiceDictation", () => ({ transcribeDictation: mocks.transcribe }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock("@/lib/toast", () => ({ toast: { error: mocks.error, warning: vi.fn() } }));

class Recorder {
  static instances: Recorder[] = [];
  static isTypeSupported() { return true; }
  state = "inactive";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  id = Recorder.instances.length;
  constructor() { Recorder.instances.push(this); }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob([`audio-${this.id}`]) });
    this.onstop?.();
  }
}

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); Recorder.instances = [];
  vi.stubGlobal("MediaRecorder", Recorder);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("reste en enregistrement pendant la transcription puis restitue chaque segment dans l’ordre après Arrêter", async () => {
  let release: (text: string) => void = () => {};
  mocks.transcribe.mockImplementationOnce(() => new Promise<string>((resolve) => { release = resolve; })).mockResolvedValue("deuxième segment");
  const onTranscript = vi.fn();
  const { result } = renderHook(() => useVoiceDictation({ onTranscript, maxDurationMs: 5000, context: { entity: "crm_card", entityId: "card-a", title: "Rendez-vous" } }));
  await act(async () => { await result.current.startRecording(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(result.current.isRecording).toBe(true);
  expect(result.current.isTranscribing).toBe(true);
  expect(Recorder.instances).toHaveLength(2);
  await act(async () => {
    const stopped = result.current.stopRecording();
    release("premier segment");
    await stopped;
  });
  expect(onTranscript.mock.calls).toEqual([["premier segment"], ["deuxième segment"]]);
  expect(mocks.transcribe.mock.calls.every(([, context]) => context.entityId === "card-a")).toBe(true);
  expect(result.current.isRecording).toBe(false);
  expect(result.current.isTranscribing).toBe(false);
});

it("garde l’audio téléchargeable après une erreur et traite quand même le segment suivant", async () => {
  mocks.transcribe.mockRejectedValueOnce(new Error("réseau coupé")).mockResolvedValue("suite conservée");
  const onTranscript = vi.fn();
  const { result } = renderHook(() => useVoiceDictation({ onTranscript, maxDurationMs: 5000 }));
  await act(async () => { await result.current.startRecording(); await vi.advanceTimersByTimeAsync(5000); });
  expect(result.current.isRecording).toBe(true);
  expect(mocks.error.mock.calls[0]?.[1]?.action?.label).toBe("Sauver l’audio");
  await act(async () => { await result.current.stopRecording(); });
  expect(onTranscript).toHaveBeenCalledWith("suite conservée");
});