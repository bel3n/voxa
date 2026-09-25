/**
 * Nerdearla Live Captions - AudioWorkletProcessor
 * Continuous 16kHz 16-bit little-endian mono PCM streaming in ~100ms chunks (1600 samples).
 * Includes sample-rate continuous linear interpolation and live VU metrics.
 */

class PCM16kWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.chunkSize = 1600; // 1600 samples = 100ms at 16kHz
    this.outputBuffer = new Int16Array(this.chunkSize);
    this.outputIndex = 0;
    this.isMuted = false;

    // Resampling continuity state
    this.resamplePhase = 0;
    this.lastInputSample = 0;

    // Metrics for VU meter
    this.sumSquares = 0;
    this.peakValue = 0;
    this.sampleCountSinceMetric = 0;

    this.port.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === 'setMuted') {
        this.isMuted = !!data.muted;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    const channelData = input[0];
    if (!channelData || channelData.length === 0) {
      return true;
    }

    const inputRate = sampleRate; // Global AudioWorklet sampleRate (e.g. 44100, 48000, or 16000)
    const ratio = inputRate / this.targetSampleRate;
    const inputLength = channelData.length;

    // Resample from inputRate to 16000 Hz preserving phase continuity across process() blocks
    let inputIdxFloat = this.resamplePhase;

    while (inputIdxFloat < inputLength) {
      const prevIdx = Math.floor(inputIdxFloat);
      const frac = inputIdxFloat - prevIdx;
      
      const sample1 = prevIdx >= 0 ? channelData[prevIdx] : this.lastInputSample;
      const sample2 = (prevIdx + 1 < inputLength) ? channelData[prevIdx + 1] : channelData[inputLength - 1];

      // Linear interpolation
      let s = sample1 + frac * (sample2 - sample1);

      if (this.isMuted) {
        s = 0;
      }

      // Track live volume metrics
      const absVal = Math.abs(s);
      if (absVal > this.peakValue) this.peakValue = absVal;
      this.sumSquares += s * s;
      this.sampleCountSinceMetric++;

      // Clamp to [-1.0, 1.0] and convert to 16-bit signed integer (little-endian)
      const clamped = Math.max(-1.0, Math.min(1.0, s));
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      this.outputBuffer[this.outputIndex++] = int16;

      // When 100ms chunk (1600 samples) is reached, transfer buffer
      if (this.outputIndex >= this.chunkSize) {
        const rms = Math.sqrt(this.sumSquares / Math.max(1, this.sampleCountSinceMetric));
        const peak = this.peakValue;

        // Post transferrable ArrayBuffer
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

        // Reset buffer and metrics
        this.outputBuffer = new Int16Array(this.chunkSize);
        this.outputIndex = 0;
        this.sumSquares = 0;
        this.peakValue = 0;
        this.sampleCountSinceMetric = 0;
      }

      inputIdxFloat += ratio;
    }

    // Save carryover phase and last sample for the next block
    this.resamplePhase = inputIdxFloat - inputLength;
    this.lastInputSample = channelData[inputLength - 1] || 0;

    return true;
  }
}

registerProcessor('pcm-16k-processor', PCM16kWorkletProcessor);
