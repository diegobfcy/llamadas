// Active call screen — handles WebSocket audio streaming, subtitles, and hangup.

import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import {
    useAddUtterance,
    useCallById,
    useEndCall,
    useParticipantsByCall,
    useUserByClerkId,
    useUtterancesByCall,
} from "@/hooks/useConvex";
import { TranslationMessage, TranslationWebSocket } from "@/lib/translation-ws";
import { useUser } from "@clerk/expo";
import type { Id } from "convex/_generated/dataModel";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Button,
    FlatList,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const callId = id as Id<"calls">;
  const router = useRouter();
  const { user } = useUser();

  const call = useCallById(callId);
  const participants = useParticipantsByCall(callId);
  const utterances = useUtterancesByCall(callId);
  const endCall = useEndCall();
  const addUtterance = useAddUtterance();

  const clerkId = user?.id;
  const myUser = useUserByClerkId(clerkId);
  const myParticipant = participants?.find(
    (p: any) => p.userId === myUser?._id,
  );

  const [isConnected, setIsConnected] = useState(false);
  const [subtitles, setSubtitles] = useState<
    { id: string; text: string; isMine: boolean }[]
  >([]);

  const wsRef = useRef<TranslationWebSocket | null>(null);

  // Audio capture
  const { startCapture, stopCapture } = useAudioCapture((buffer) => {
    // Send PCM buffer to WebSocket (the Python service handles Opus encoding)
    if (wsRef.current && buffer.data) {
      wsRef.current.sendAudio(buffer.data);
    }
  });

  // Audio playback
  const { enqueueFrame, stopPlayback } = useAudioPlayback();

  // Connect WebSocket when call is active
  useEffect(() => {
    if (!call || call.status !== "active" || !myParticipant) return;

    const ws = new TranslationWebSocket(
      callId,
      myParticipant._id,
      myParticipant.lang,
      {
        onControl: (msg: TranslationMessage) => {
          // Persist utterance to Convex
          addUtterance({
            callId,
            speakerId: msg.speakerId as Id<"participants">,
            sourceLang: msg.sourceLang,
            targetLang: msg.targetLang,
            sourceText: msg.sourceText,
            translatedText: msg.translatedText,
            isFinal: msg.isFinal,
          }).catch(console.error);

          // Show subtitle
          setSubtitles((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              text: msg.translatedText || msg.sourceText,
              isMine: msg.speakerId === myParticipant._id,
            },
          ]);
        },
        onAudio: (opusFrame: ArrayBuffer) => {
          enqueueFrame(opusFrame);
        },
        onClose: () => setIsConnected(false),
        onError: () => setIsConnected(false),
      },
    );

    ws.connect();
    wsRef.current = ws;
    setIsConnected(true);

    // Start capturing microphone
    startCapture().catch(console.error);

    return () => {
      ws.disconnect();
      stopCapture();
      stopPlayback();
    };
  }, [call?.status, myParticipant?._id]);

  // Handle hangup
  const handleHangup = useCallback(async () => {
    try {
      await endCall({ callId });
    } catch (e) {
      console.error("Failed to end call:", e);
    }
    wsRef.current?.disconnect();
    stopCapture();
    stopPlayback();
    router.back();
  }, [callId, endCall, stopCapture, stopPlayback, router]);

  // Auto-hangup if call ended by other party
  useEffect(() => {
    if (call?.status === "ended") {
      Alert.alert("Call Ended", "The call has ended.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [call?.status]);

  if (!call || call.status === "ended") {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.statusText}>Call ended</Text>
        <Button title="Go back" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (call.status === "waiting") {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#208AEF" />
        <Text style={styles.statusText}>Waiting for answer...</Text>
        <Button title="Cancel" onPress={handleHangup} />
      </SafeAreaView>
    );
  }

  const otherParticipant = participants?.find(
    (p: any) => p.userId !== myUser?._id,
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Call with {otherParticipant?.displayName ?? "Unknown"}
        </Text>
        <Text style={styles.connectionStatus}>
          {isConnected ? "🟢 Connected" : "🔴 Connecting..."}
        </Text>
      </View>

      {/* Subtitles */}
      <View style={styles.subtitleContainer}>
        <FlatList
          data={subtitles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={[
                styles.subtitleBubble,
                item.isMine ? styles.myBubble : styles.theirBubble,
              ]}
            >
              <Text style={styles.subtitleText}>{item.text}</Text>
            </View>
          )}
          inverted
        />
      </View>

      {/* Hangup button */}
      <View style={styles.controls}>
        <Button title="📞 Hang Up" color="red" onPress={handleHangup} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    gap: 16,
  },
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  header: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#16213e",
  },
  headerText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  connectionStatus: {
    color: "#4ecca3",
    fontSize: 12,
    marginTop: 4,
  },
  statusText: {
    fontSize: 18,
    color: "#666",
  },
  subtitleContainer: {
    flex: 1,
    padding: 12,
  },
  subtitleBubble: {
    padding: 10,
    borderRadius: 12,
    marginVertical: 4,
    maxWidth: "80%",
  },
  myBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#208AEF",
  },
  theirBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#333",
  },
  subtitleText: {
    color: "#fff",
    fontSize: 16,
  },
  controls: {
    padding: 20,
    alignItems: "center",
  },
});
