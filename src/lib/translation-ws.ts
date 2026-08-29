// WebSocket audio client for real-time voice translation.
// Connects to the external Python translation service.
// Sends Opus-encoded audio chunks, receives Opus audio + JSON control messages.

import { ENV } from "@/lib/env";

export type TranslationMessage = {
  type: "utterance";
  speakerId: string;
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  translatedText: string;
  isFinal: boolean;
};

type ControlHandler = (msg: TranslationMessage) => void;
type AudioHandler = (opusFrame: ArrayBuffer) => void;

export class TranslationWebSocket {
  private ws: WebSocket | null = null;
  private callId: string;
  private participantId: string;
  private lang: string;
  private onControl: ControlHandler;
  private onAudio: AudioHandler;
  private onClose?: () => void;
  private onError?: (err: Event) => void;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(
    callId: string,
    participantId: string,
    lang: string,
    handlers: {
      onControl: ControlHandler;
      onAudio: AudioHandler;
      onClose?: () => void;
      onError?: (err: Event) => void;
    },
  ) {
    this.callId = callId;
    this.participantId = participantId;
    this.lang = lang;
    this.onControl = handlers.onControl;
    this.onAudio = handlers.onAudio;
    this.onClose = handlers.onClose;
    this.onError = handlers.onError;
  }

  connect(): void {
    if (this.destroyed) return;
    const base = ENV.TRANSLATION_WS_URL;
    const url = `${base}/room/${this.callId}?participantId=${encodeURIComponent(this.participantId)}&lang=${encodeURIComponent(this.lang)}`;
    console.log("[WS] Connecting:", url);

    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      console.log("[WS] Connected");
    };

    this.ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === "string") {
        // JSON control message
        try {
          const msg = JSON.parse(event.data) as TranslationMessage;
          if (msg.type === "utterance") {
            this.onControl(msg);
          }
        } catch (e) {
          console.warn("[WS] Failed to parse control message:", e);
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Binary Opus audio frame
        this.onAudio(event.data);
      }
    };

    this.ws.onclose = (event) => {
      console.log("[WS] Closed:", event.code, event.reason);
      if (!this.destroyed) {
        this.onClose?.();
        // Auto-reconnect after 2s
        this.reconnectTimer = setTimeout(() => this.connect(), 2000);
      }
    };

    this.ws.onerror = (event) => {
      console.error("[WS] Error:", event);
      this.onError?.(event);
    };
  }

  sendAudio(opusFrame: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(opusFrame);
    }
  }

  disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect
      this.ws.close();
      this.ws = null;
    }
  }
}
