// Active call screen — uses Sincro Dispatcher + Worker for real-time audio translation.

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
import { createSession, deleteSession } from "@/lib/dispatcher";
import { SincroWorkerSocket } from "@/lib/translation-ws";
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

  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "connecting" | "waiting_peer" | "connected" | "disconnected"
  >("idle");
  const [subtitles, setSubtitles] = useState<
    { id: string; text: string; isMine: boolean }[]
  >([]);

  const wsRef = useRef<SincroWorkerSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Audio capture — sends PCM to Worker
  const { startCapture, stopCapture } = useAudioCapture((buffer) => {
    if (wsRef.current && buffer.data) {
      wsRef.current.sendAudio(buffer.data);
    }
  });

  // Audio playback — receives PCM from Worker
  const { enqueueFrame, stopPlayback } = useAudioPlayback();

  // Connect to Sincro when call is active
  useEffect(() => {
    if (!call || call.status !== "active" || !myParticipant || !participants)
      return;

    const otherParticipant = participants.find(
      (p: any) => p.userId !== myUser?._id,
    );
    if (!otherParticipant) return;

    let cancelled = false;

    async function setupSincro() {
      try {
        setConnectionStatus("connecting");

        const myLang = myParticipant!.lang || "es";
        const otherLang = otherParticipant!.lang || "en";

        console.log("[CallScreen] Creating session:", {
          myId: myParticipant!._id,
          otherId: otherParticipant!._id,
          myLang,
          otherLang,
          myParticipant: JSON.stringify(myParticipant),
          otherParticipant: JSON.stringify(otherParticipant),
        });

        // 1. Create session via Dispatcher
        const session = await createSession({
          user_a_id: myParticipant!._id,
          user_b_id: otherParticipant!._id,
          src_lang: myLang,
          dst_lang: otherLang,
        });

        console.log("[CallScreen] Session created:", JSON.stringify(session));

        if (cancelled) {
          // Clean up session if component unmounted during setup
          deleteSession(session.session_id).catch(() => {});
          return;
        }

        sessionIdRef.current = session.session_id;

        // Tokens are keyed by participant ID
        const myToken = session.tokens[myParticipant!._id];
        if (!myToken) {
          throw new Error(
            `No token found for participant ${myParticipant!._id}. Available: ${Object.keys(session.tokens).join(", ")}`,
          );
        }

        console.log("[CallScreen] My token:", myToken.substring(0, 30) + "...");
        console.log("[CallScreen] Worker URL:", session.ws_url);

        // 2. Connect to Worker via WebSocket (awaits /readyz first)
        const ws = new SincroWorkerSocket(myToken, session.ws_url, {
          onAudio: (pcmFrame: ArrayBuffer) => {
            enqueueFrame(pcmFrame);
          },
          onStatus: (status) => {
            setConnectionStatus(status);
          },
          onError: () => {
            setConnectionStatus("disconnected");
          },
        });

        await ws.connect();
        wsRef.current = ws;

        // 3. Start capturing microphone
        await startCapture();
      } catch (e) {
        console.error("[CallScreen] Failed to setup Sincro:", e);
        if (!cancelled) {
          setConnectionStatus("disconnected");
          Alert.alert(
            "Connection Error",
            "Failed to connect to translation service.",
          );
        }
      }
    }

    setupSincro();

    return () => {
      cancelled = true;
      wsRef.current?.disconnect();
      stopCapture();
      stopPlayback();

      // Clean up session on Dispatcher
      if (sessionIdRef.current) {
        deleteSession(sessionIdRef.current).catch((e) =>
          console.warn("[CallScreen] Failed to delete session:", e),
        );
        sessionIdRef.current = null;
      }
    };
  }, [call?.status, myParticipant?._id, participants?.length]);

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

    if (sessionIdRef.current) {
      deleteSession(sessionIdRef.current).catch(() => {});
      sessionIdRef.current = null;
    }

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

  const statusLabel: Record<string, string> = {
    idle: "Ready",
    connecting: "🔵 Connecting...",
    waiting_peer: "🟡 Waiting for peer...",
    connected: "🟢 Connected",
    disconnected: "🔴 Disconnected",
  };

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
          {statusLabel[connectionStatus] || connectionStatus}
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
