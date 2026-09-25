import { ConnectionState, QAQuestion, RoomMetadata, TranscriptEntry, TranscriptionState } from '../types';

export interface SocketClientCallbacks {
  onConnectionChange: (state: ConnectionState) => void;
  onRoomSync: (data: { room: RoomMetadata; role: string; clientId: string }) => void;
  onInterimCaption: (text: string, timestamp: number) => void;
  onFinalCaption: (entry: TranscriptEntry, timestamp: number) => void;
  onCaptionTranslated: (entryId: string, textEs?: string, status?: string, error?: string) => void;
  onTranscriptionStatus: (status: TranscriptionState, error?: string | null, initialConnectMs?: number) => void;
  onRoomMeta: (meta: { title: string; glossary: string[]; broadcasterActive: boolean; viewersCount: number }) => void;
  onQAUpdated?: (questions: QAQuestion[]) => void;
  onError: (message: string, code?: string) => void;
  onBroadcasterLeft: () => void;
}

export class SocketClient {
  private ws: WebSocket | null = null;
  private currentRoomId: string = 'sala-principal';
  private role: 'broadcaster' | 'viewer' = 'viewer';
  private talkTitle: string = 'Nerdearla Keynote 2026';
  private glossary: string[] = ['Kubernetes', 'Docker', 'Microservicios', 'TypeScript', 'Gemini'];
  private isExplicitlyClosed: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private callbacks: SocketClientCallbacks;

  constructor(callbacks: SocketClientCallbacks) {
    this.callbacks = callbacks;
  }

  public connect(roomId: string, role: 'broadcaster' | 'viewer', talkTitle?: string, glossary?: string[]): void {
    this.currentRoomId = roomId;
    this.role = role;
    if (talkTitle) this.talkTitle = talkTitle;
    if (glossary) this.glossary = glossary;
    this.isExplicitlyClosed = false;

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }

    this.callbacks.onConnectionChange(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.callbacks.onConnectionChange('connected');
        this.startHeartbeat();

        // Join the target room
        this.send({
          type: 'join:room',
          roomId: this.currentRoomId,
          role: this.role,
          title: this.talkTitle,
          glossary: this.glossary,
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (err) {
          console.error('Error parsing WS message', err);
        }
      };

      this.ws.onerror = (e) => {
        console.warn('WebSocket error', e);
        this.callbacks.onConnectionChange('error');
      };

      this.ws.onclose = (e) => {
        this.stopHeartbeat();
        this.callbacks.onConnectionChange('disconnected');

        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch (err: any) {
      console.error('Failed to create WebSocket', err);
      this.callbacks.onConnectionChange('error');
      this.scheduleReconnect();
    }
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case 'room:sync':
        this.callbacks.onRoomSync(msg);
        break;

      case 'caption:interim':
        this.callbacks.onInterimCaption(msg.text, msg.timestamp);
        break;

      case 'caption:final':
        this.callbacks.onFinalCaption(msg.entry, msg.timestamp);
        break;

      case 'caption:translated':
        this.callbacks.onCaptionTranslated(msg.entryId, msg.textEs, msg.status, msg.error);
        break;

      case 'transcription:status':
        this.callbacks.onTranscriptionStatus(msg.status, msg.error, msg.initialConnectDurationMs);
        break;

      case 'room:meta':
        this.callbacks.onRoomMeta(msg);
        break;

      case 'broadcaster:left':
        this.callbacks.onBroadcasterLeft();
        break;

      case 'qa:updated':
        if (Array.isArray(msg.questions)) {
          this.callbacks.onQAUpdated?.(msg.questions);
        }
        break;

      case 'error':
        this.callbacks.onError(msg.message, msg.code);
        break;

      case 'pong':
        // Heartbeat ACK
        break;
    }
  }

  public submitQuestion(text: string, authorName?: string): void {
    this.send({
      type: 'qa:submit',
      roomId: this.currentRoomId,
      text,
      authorName: authorName || 'Asistente',
    });
  }

  public voteQuestion(questionId: string, delta: number = 1): void {
    this.send({
      type: 'qa:vote',
      roomId: this.currentRoomId,
      questionId,
      delta,
    });
  }

  public toggleQuestionAnswered(questionId: string): void {
    this.send({
      type: 'qa:toggle_answered',
      roomId: this.currentRoomId,
      questionId,
    });
  }

  public deleteQuestion(questionId: string): void {
    this.send({
      type: 'qa:delete',
      roomId: this.currentRoomId,
      questionId,
    });
  }

  public sendAudioChunk(base64Data: string, timestamp: number): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    // Check backpressure on client socket (limit max 256KB buffered)
    if (this.ws.bufferedAmount > 256 * 1024) {
      return false; // Shed chunk to protect memory and avoid lag
    }

    this.send({
      type: 'audio',
      roomId: this.currentRoomId,
      data: base64Data,
      timestamp,
    });
    return true;
  }

  public updateRoomMeta(title: string, glossary: string[]): void {
    this.talkTitle = title;
    this.glossary = glossary;
    this.send({
      type: 'update:room_meta',
      roomId: this.currentRoomId,
      title,
      glossary,
    });
  }

  public clearHistory(): void {
    this.send({
      type: 'clear:history',
      roomId: this.currentRoomId,
    });
  }

  public retryTranslation(entryId: string): void {
    this.send({
      type: 'retry:translation',
      roomId: this.currentRoomId,
      entryId,
    });
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.send({ type: 'leave:room', roomId: this.currentRoomId });
        this.ws.close();
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }
    this.callbacks.onConnectionChange('disconnected');
  }

  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect(): void {
    if (this.isExplicitlyClosed || this.reconnectTimer) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts - 1), 10000);

    this.callbacks.onConnectionChange('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isExplicitlyClosed) {
        this.connect(this.currentRoomId, this.role, this.talkTitle, this.glossary);
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
