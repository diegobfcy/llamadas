// Audio playback hook using expo-audio.
// Receives PCM 16-bit, 16kHz ArrayBuffers from Sincro Worker and plays them.

import { AudioPlayer, createAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef } from "react";

export function useAudioPlayback() {
  const playerRef = useRef<AudioPlayer | null>(null);
  const playerValidRef = useRef(true);
  const queueRef = useRef<ArrayBuffer[]>([]);
  const playingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    playerRef.current = createAudioPlayer(null);
    playerValidRef.current = true;
    return () => {
      playerValidRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      try {
        playerRef.current?.release();
      } catch (e) {
        // Player may already be released
      }
    };
  }, []);

  const enqueueFrame = useCallback((pcmFrame: ArrayBuffer) => {
    queueRef.current.push(pcmFrame);
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

    const frames = queueRef.current.splice(0);
    const totalLength = frames.reduce((acc, f) => acc + f.byteLength, 0);

    console.log(
      "[AudioPlayback] Received",
      frames.length,
      "PCM frames, total bytes:",
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
    if (playerValidRef.current && playerRef.current) {
      try {
        playerRef.current.pause();
      } catch (e) {
        // Player may already be released — ignore
        console.warn("[AudioPlayback] Player already released:", e);
      }
    }
  }, []);

  return { enqueueFrame, stopPlayback };
}
