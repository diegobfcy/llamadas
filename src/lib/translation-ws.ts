// WebSocket audio client for Sincro Worker.
// Connects to the Worker via JWT token (obtained from Dispatcher).
// Sends/receives raw PCM 16-bit, 16kHz, mono audio frames (640 bytes = 20ms).

type AudioHandler = (pcmFrame: ArrayBuffer) => void;
type StatusHandler = (
  status:
    | "connecting"
    | "connected"
    | "disconnected"
    | "waiting_peer"
    | "worker_unavailable",
) => void;

export class SincroWorkerSocket {
  private ws: WebSocket | null = null;
  private token: string;
  private workerUrl: string;
  private onAudio: AudioHandler;
  private onStatus: StatusHandler;
  private onError?: (err: Event) => void;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;

  constructor(
    token: string,
    workerUrl: string,
    handlers: {
      onAudio: AudioHandler;
      onStatus: StatusHandler;
      onError?: (err: Event) => void;
    },
  ) {
    this.token = token;
    this.workerUrl = workerUrl;
    this.onAudio = handlers.onAudio;
    this.onStatus = handlers.onStatus;
    this.onError = handlers.onError;
  }

  /**
   * Connect to the worker and complete the hello handshake.
   * Resolves when the worker sends "ready" or "waiting_for_peer".
   */
  async connect(): Promise<void> {
    if (this.destroyed) return;
    this.onStatus("connecting");

    // Create a promise that resolves when worker signals readiness
    this.readyPromise = new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });

    this.doConnect();
    await this.readyPromise;
  }

  private doConnect(): void {
    if (this.destroyed) return;

    // Token goes in the hello JSON, NOT in the query string
    console.log("[SincroWS] Connecting:", this.workerUrl);
    this.onStatus("connecting");

    this.ws = new WebSocket(this.workerUrl);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      console.log("[SincroWS] WebSocket open, sending hello...");
      this.reconnectAttempts = 0;

      // Send hello handshake — worker expects this as the FIRST message
      const hello = JSON.stringify({ t: "hello", token: this.token });
      this.ws!.send(hello);
      console.log("[SincroWS] Hello sent, waiting for worker response...");
    };

    this.ws.onmessage = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        // Binary PCM audio frame (640 bytes = 20ms @ 16kHz mono 16-bit)
        this.onAudio(event.data);

        // Once we start receiving audio, both peers are connected
        this.onStatus("connected");
      } else {
        // Text messages — control messages from the worker
        try {
          const msg = JSON.parse(event.data as string);
          console.log("[SincroWS] Control message:", msg);

          if (msg.t === "ready" || msg.t === "waiting_for_peer") {
            this.onStatus("waiting_peer");
            // Signal that the handshake is complete — caller can now start audio
            if (this.resolveReady) {
              this.resolveReady();
              this.resolveReady = null;
            }
          } else if (msg.t === "connected") {
            this.onStatus("connected");
          }
        } catch {
          console.log("[SincroWS] Text message:", event.data);
        }
      }
    };

    this.ws.onclose = (event) => {
      console.log("[SincroWS] Closed:", event.code, event.reason);

      // Map close codes to human-readable reasons
      const reasonMap: Record<number, string> = {
        1000: "Cierre normal",
        4001: "Token inválido o expirado",
        4002: "Sesión no encontrada",
        4003: "El otro participante se desconectó",
      };
      const reason = reasonMap[event.code] || `Código ${event.code}`;
      console.log("[SincroWS] Close reason:", reason);

      this.onStatus("disconnected");

      // Don't reconnect for normal close or auth/session errors
      if (event.code === 1000 || event.code === 4001 || event.code === 4002) {
        return;
      }

      // Reconnect with backoff for network issues (1006) or peer disconnect (4003)
      if (
        !this.destroyed &&
        this.reconnectAttempts < this.maxReconnectAttempts
      ) {
        this.reconnectAttempts++;
        const delay = Math.min(2000 * this.reconnectAttempts, 10000);
        console.log(
          `[SincroWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
        );
        this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
      } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log("[SincroWS] Max reconnect attempts reached");
      }
    };

    this.ws.onerror = (event) => {
      console.error("[SincroWS] Error:", event);
      this.onError?.(event);
    };
  }

  /**
   * Send a PCM audio frame to the worker.
   * Must be exactly 640 bytes (320 samples × 2 bytes = 20ms @ 16kHz mono).
   */
  sendAudio(pcmFrame: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(pcmFrame);
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

// Re-export for backward compatibility
export type TranslationMessage = {
  type: "utterance";
  speakerId: string;
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  translatedText: string;
  isFinal: boolean;
};

/** @deprecated Use SincroWorkerSocket instead */
export class TranslationWebSocket {
  private ws: SincroWorkerSocket;

  constructor(
    _callId: string,
    _participantId: string,
    _lang: string,
    handlers: {
      onControl: (msg: TranslationMessage) => void;
      onAudio: (frame: ArrayBuffer) => void;
      onClose?: () => void;
      onError?: (err: Event) => void;
    },
  ) {
    // This is a compatibility wrapper — the new API doesn't use callId/participantId/lang
    // directly in the WebSocket URL. Those are handled by the Dispatcher.
    // If you're using this class, you should migrate to SincroWorkerSocket + Dispatcher.
    console.warn(
      "[TranslationWebSocket] DEPRECATED — use SincroWorkerSocket + createSession() instead",
    );

    this.ws = new SincroWorkerSocket("", "", {
      onAudio: handlers.onAudio,
      onStatus: (status) => {
        if (status === "disconnected") handlers.onClose?.();
      },
      onError: handlers.onError,
    });
  }

  connect(): void {
    console.warn(
      "[TranslationWebSocket] Cannot connect — token not provided. Use SincroWorkerSocket.",
    );
  }

  sendAudio(frame: ArrayBuffer): void {
    this.ws.sendAudio(frame);
  }

  disconnect(): void {
    this.ws.disconnect();
  }
}
