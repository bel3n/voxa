/**
 * Audio Capture Service using Web Audio API and AudioWorklet
 * Delivers continuous 16kHz mono 16-bit Little-Endian PCM in ~100ms chunks.
 */

// AudioWorklet processor code fallback as string if loading from URL fails in sandboxed iframe
const WORKLET_PROCESSOR_CODE = `
class PCM16kWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.chunkSize = 1600;
    this.outputBuffer = new Int16Array(this.chunkSize);
    this.outputIndex = 0;
    this.isMuted = false;
    this.resamplePhase = 0;
    this.lastInputSample = 0;
    this.sumSquares = 0;
    this.peakValue = 0;
    this.sampleCountSinceMetric = 0;

    this.port.onmessage = (event) => {
      if (event.data && event.data.type === 'setMuted') {
        this.isMuted = !!event.data.muted;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    const inputRate = sampleRate;
    const ratio = inputRate / this.targetSampleRate;
    const inputLength = channelData.length;

    let inputIdxFloat = this.resamplePhase;

    while (inputIdxFloat < inputLength) {
      const prevIdx = Math.floor(inputIdxFloat);
      const frac = inputIdxFloat - prevIdx;
      const sample1 = prevIdx >= 0 ? channelData[prevIdx] : this.lastInputSample;
      const sample2 = (prevIdx + 1 < inputLength) ? channelData[prevIdx + 1] : channelData[inputLength - 1];

      let s = sample1 + frac * (sample2 - sample1);
      if (this.isMuted) s = 0;

      const absVal = Math.abs(s);
      if (absVal > this.peakValue) this.peakValue = absVal;
      this.sumSquares += s * s;
      this.sampleCountSinceMetric++;

      const clamped = Math.max(-1.0, Math.min(1.0, s));
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      this.outputBuffer[this.outputIndex++] = int16;

      if (this.outputIndex >= this.chunkSize) {
        const rms = Math.sqrt(this.sumSquares / Math.max(1, this.sampleCountSinceMetric));
        const peak = this.peakValue;

        this.port.postMessage(
          {
            type: 'chunk',
            buffer: this.outputBuffer.buffer,
            rms,
            peak,
            samples: this.chunkSize,
          },
          [this.outputBuffer.buffer]
        );

        this.outputBuffer = new Int16Array(this.chunkSize);
        this.outputIndex = 0;
        this.sumSquares = 0;
        this.peakValue = 0;
        this.sampleCountSinceMetric = 0;
      }

      inputIdxFloat += ratio;
    }

    this.resamplePhase = inputIdxFloat - inputLength;
    this.lastInputSample = channelData[inputLength - 1] || 0;
    return true;
  }
}
registerProcessor('pcm-16k-processor', PCM16kWorkletProcessor);
`;

export interface AudioCaptureCallbacks {
  onChunk: (base64Chunk: string, timestamp: number, rms: number, peak: number) => void;
  onMeter: (rms: number, peak: number) => void;
  onError: (error: Error) => void;
}

export class AudioCaptureService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private isCapturing = false;
  private isMuted = false;
  private callbacks: AudioCaptureCallbacks;

  constructor(callbacks: AudioCaptureCallbacks) {
    this.callbacks = callbacks;
  }

  // Must be called in direct response to user gesture (e.g. click handler)
  public async startCapture(): Promise<void> {
    if (this.isCapturing) return;

    try {
      // 1. Initialize AudioContext
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) {
        throw new Error('Web Audio API no está soportada en este navegador.');
      }

      this.audioContext = new AudioCtxClass();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // 2. Load AudioWorklet module
      try {
        await this.audioContext.audioWorklet.addModule('/audio-processor.js');
      } catch (err) {
        console.warn('Could not load /audio-processor.js from static URL, using inline Blob fallback', err);
        const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        await this.audioContext.audioWorklet.addModule(blobUrl);
        URL.revokeObjectURL(blobUrl);
      }

      // 3. Request user microphone
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 4. Connect Audio graph
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-16k-processor');

      this.workletNode.port.onmessage = (event) => {
        const msg = event.data;
        if (msg && msg.type === 'chunk') {
          const buffer = msg.buffer as ArrayBuffer;
          const base64 = this.arrayBufferToBase64(buffer);
          const now = Date.now();
          this.callbacks.onChunk(base64, now, msg.rms, msg.peak);
          this.callbacks.onMeter(msg.rms, msg.peak);
        }
      };

      this.sourceNode.connect(this.workletNode);
      // Connect to a silent dummy destination or don't connect to speaker destination to prevent feedback
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0;
      this.workletNode.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      this.isCapturing = true;
    } catch (err: any) {
      this.stopCapture();
      this.callbacks.onError(err);
      throw err;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'setMuted', muted });
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsCapturing(): boolean {
    return this.isCapturing;
  }

  public stopCapture(): void {
    this.isCapturing = false;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        // ignore
      }
      this.audioContext = null;
    }
  }

  /**
   * Fast base64 encoding of ArrayBuffer
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
