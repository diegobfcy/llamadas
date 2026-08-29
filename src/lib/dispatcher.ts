// Dispatcher REST API client for Sincro.
// Handles session creation, deletion, and voice enrollment.

import { ENV } from "@/lib/env";

const BASE = ENV.SINCRO_DISPATCHER_URL;

export type SessionResponse = {
  session_id: string;
  ws_url: string;
  tokens: Record<string, string>;
  expires_in: number;
};

export type VoiceResponse = {
  voice_id: string;
  user_id: string;
};

export type VoiceListResponse = {
  user_id: string;
  voices: { voice_id: string; created_at: string }[];
};

/**
 * Create a call session between two users.
 * Returns tokens and the worker WebSocket URL.
 */
export async function createSession(params: {
  user_a_id: string;
  user_b_id: string;
  src_lang: string;
  dst_lang: string;
}): Promise<SessionResponse> {
  const body = {
    participants: [
      { user_id: params.user_a_id, lang: params.src_lang },
      { user_id: params.user_b_id, lang: params.dst_lang },
    ],
  };

  console.log(
    "[Dispatcher] createSession request:",
    JSON.stringify(body, null, 2),
  );

  const res = await fetch(`${BASE}/v1/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log("[Dispatcher] createSession response:", res.status, text);

  if (!res.ok) {
    throw new Error(`Dispatcher createSession failed (${res.status}): ${text}`);
  }

  return JSON.parse(text);
}

/**
 * Release a session when the call ends.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(
    `${BASE}/v1/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "DELETE",
    },
  );

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Dispatcher deleteSession failed (${res.status}): ${text}`);
  }
}

/**
 * Enroll a voice fingerprint for timbre cloning.
 * @param userId - The user ID
 * @param audioFile - WAV file (PCM 16-bit, 16kHz, mono)
 */
export async function enrollVoice(
  userId: string,
  audioFile: { uri: string; name: string; type: string },
): Promise<VoiceResponse> {
  const formData = new FormData();
  formData.append("user_id", userId);
  formData.append("audio", {
    uri: audioFile.uri,
    name: audioFile.name,
    type: audioFile.type,
  } as any);

  const res = await fetch(`${BASE}/v1/voices`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dispatcher enrollVoice failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Get enrolled voices for a user.
 */
export async function getVoices(userId: string): Promise<VoiceListResponse> {
  const res = await fetch(`${BASE}/v1/voices/${encodeURIComponent(userId)}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dispatcher getVoices failed (${res.status}): ${text}`);
  }

  return res.json();
}
