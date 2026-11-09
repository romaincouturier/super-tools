export class ContinuousRecording {
  private recorder: MediaRecorder | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private active = false;
  private pending = new Set<Promise<void>>();

  constructor(
    private stream: MediaStream,
    private mimeType: string,
    private segmentDuration: number,
    private onSegment: (blob: Blob) => Promise<void>,
    private onError: (error: unknown) => void,
  ) {}

  start() {
    this.active = true;
    this.startSegment();
  }

  private startSegment() {
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(this.stream, { mimeType: this.mimeType });
    let finished: () => void = () => {};
    const complete = new Promise<void>((resolve) => { finished = resolve; });
    this.pending.add(complete);
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: this.mimeType.split(";")[0] });
      Promise.resolve().then(() => blob.size ? this.onSegment(blob) : undefined)
        .catch(this.onError).finally(() => { this.pending.delete(complete); finished(); });
    };
    recorder.onerror = (event) => {
      this.onError(event);
      void this.stop();
    };
    recorder.start(1000);
    this.recorder = recorder;
    this.timer = setTimeout(() => {
      if (!this.active) return;
      try {
        // Start the successor before closing the previous container: no capture gap.
        this.startSegment();
        recorder.stop();
      } catch (error) {
        this.onError(error);
        void this.stop();
      }
    }, this.segmentDuration);
  }

  async stop() {
    this.active = false;
    clearTimeout(this.timer);
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.stream.getTracks().forEach((track) => track.stop());
    await Promise.all([...this.pending]);
  }
}