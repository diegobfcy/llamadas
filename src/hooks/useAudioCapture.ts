// Audio capture hook using expo-audio AudioStream.
// Captures PCM from the microphone and provides it as ArrayBuffers.
// The caller is responsible for Opus encoding before sending over WebSocket.

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

  const { stream } = useAudioStream({
    channels: 1,
    sampleRate: 48000,
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
    await stream.start();
    setIsStreaming(true);
  }, [stream]);

  const stopCapture = useCallback(() => {
    stream.stop();
    setIsStreaming(false);
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stream.stop();
    };
  }, [stream]);

  return { isStreaming, startCapture, stopCapture, latestBuffer: null };
}
