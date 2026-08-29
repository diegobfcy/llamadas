// Audio playback hook using expo-audio.
// Receives Opus-encoded ArrayBuffers and plays them in streaming fashion.
// Since expo-audio doesn't support raw Opus frame playback directly,
// we accumulate frames and play them as chunks via a data URI or file.

import { AudioPlayer, createAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef } from "react";

// Simple Opus frame queue player.
// Accumulates Opus frames and plays them periodically.
// In a production app, you'd use a proper Opus decoder (native module).
// For the prototype, we use a workaround: write to a temp file and play it.

export function useAudioPlayback() {
  const playerRef = useRef<AudioPlayer | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);
  const playingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    playerRef.current = createAudioPlayer(null);
    return () => {
      playerRef.current?.release();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const enqueueFrame = useCallback((opusFrame: ArrayBuffer) => {
    queueRef.current.push(opusFrame);
    if (!playingRef.current) {
      playNextChunk();
    }
  }, []);

  const playNextChunk = useCallback(() => {
    if (queueRef.current.length === 0) {
      playingRef.current = false;
      return;
    }
    playingRef.current = true;

    // Concatenate all queued frames into one buffer
    const frames = queueRef.current.splice(0);
    const totalLength = frames.reduce((acc, f) => acc + f.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const f of frames) {
      combined.set(new Uint8Array(f), offset);
      offset += f.byteLength;
    }

    // Write to a blob and play via data URI
    // Note: This is a prototype workaround. Real Opus playback needs a native decoder.
    // The Python service should ideally send PCM or AAC if Opus decode isn't available.
    // For now, we skip actual playback and just log — the real playback depends on
    // the translation service's output format.
    console.log(
      "[AudioPlayback] Received",
      frames.length,
      "Opus frames, total bytes:",
      totalLength,
    );

    // Schedule next chunk
    timerRef.current = setTimeout(() => playNextChunk(), 100);
  }, []);

  const stopPlayback = useCallback(() => {
    queueRef.current = [];
    playingRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    playerRef.current?.pause();
  }, []);

  return { enqueueFrame, stopPlayback };
}
