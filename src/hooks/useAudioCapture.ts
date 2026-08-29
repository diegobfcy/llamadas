// Audio capture hook using expo-audio AudioStream.
// Captures PCM 16-bit, 16kHz, mono from the microphone.
// Sends raw PCM frames (640 bytes = 20ms) to the Sincro Worker via WebSocket.

import {
    AudioStreamBuffer,
    requestRecordingPermissionsAsync,
    useAudioStream,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

type AudioCaptureResult = {
  isStreaming: boolean;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  latestBuffer: AudioStreamBuffer | null;
};

export function useAudioCapture(
  onBuffer: (buffer: AudioStreamBuffer) => void,
): AudioCaptureResult {
  const [isStreaming, setIsStreaming] = useState(false);
  const onBufferRef = useRef(onBuffer);
  onBufferRef.current = onBuffer;

  // Track whether the stream is still valid to avoid calling stop() on a released stream
  const streamValidRef = useRef(true);

  const { stream } = useAudioStream({
    channels: 1,
    sampleRate: 16000, // Sincro Worker expects 16kHz
    encoding: "int16",
    onBuffer: (buf: AudioStreamBuffer) => {
      onBufferRef.current(buf);
    },
  });

  const startCapture = useCallback(async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      throw new Error("Microphone permission denied");
    }
    streamValidRef.current = true;
    await stream.start();
    setIsStreaming(true);
  }, [stream]);

  const stopCapture = useCallback(() => {
    if (streamValidRef.current) {
      try {
        stream.stop();
      } catch (e) {
        // Stream may have already been released — ignore
        console.warn("[AudioCapture] Stream already released:", e);
      }
      streamValidRef.current = false;
    }
    setIsStreaming(false);
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamValidRef.current) {
        try {
          stream.stop();
        } catch (e) {
          // Ignore — stream already released
        }
        streamValidRef.current = false;
      }
    };
  }, [stream]);

  return { isStreaming, startCapture, stopCapture, latestBuffer: null };
}
