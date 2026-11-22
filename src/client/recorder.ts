// src/client/recorder.ts: MediaRecorder wrapper using recorderMime.ts + recorderGate.ts. DOM
// APIs are referenced directly (this file is DOM-only, per plan §1.4), but every pure decision
// (which mime type, whether to accept the take) is delegated to src/lib/ui so it stays testable.
import { LIMITS } from '../lib/types.ts';
import { evaluateRecorderGate, type RecorderGateResult } from '../lib/ui/recorderGate.ts';
import { pickRecorderMime } from '../lib/ui/recorderMime.ts';

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  gate: RecorderGateResult;
}

export interface RecorderHandle {
  stop(): void;
}

/**
 * Starts recording from `stream`, sampling level via an AnalyserNode fed into `recorderGate`.
 * `onLevel` (optional) lets a caller show a live meter; the gate decision is only made at stop.
 */
export function startRecording(
  stream: MediaStream,
  audioContext: AudioContext,
  onDone: (result: RecordingResult) => void,
  onLevel?: (rms: number) => void,
): RecorderHandle {
  const mimeType = pickRecorderMime((m) => MediaRecorder.isTypeSupported(m)) ?? '';
  const recorder = new MediaRecorder(stream, {
    ...(mimeType !== '' ? { mimeType } : {}),
    audioBitsPerSecond: LIMITS.recorderBitsPerSecond,
  });

  const chunks: Blob[] = [];
  const startedAt = Date.now();

  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  let lastRms = 0;

  let rafId: number | null = null;
  function sample(): void {
    analyser.getFloatTimeDomainData(samples);
    let sumSquares = 0;
    for (const s of samples) sumSquares += s * s;
    lastRms = Math.sqrt(sumSquares / samples.length);
    onLevel?.(lastRms);
    rafId = requestAnimationFrame(sample);
  }
  rafId = requestAnimationFrame(sample);

  recorder.ondataavailable = (event: BlobEvent) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onstop = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    const durationMs = Date.now() - startedAt;
    const blob = new Blob(chunks, { type: mimeType });
    const gate = evaluateRecorderGate({ durationMs, rmsLevel: lastRms });
    onDone({ blob, mimeType, durationMs, gate });
  };

  recorder.start();
  const stopAt = setTimeout(() => recorder.stop(), LIMITS.maxRecordingSec * 1000);

  return {
    stop() {
      clearTimeout(stopAt);
      if (recorder.state !== 'inactive') recorder.stop();
    },
  };
}
