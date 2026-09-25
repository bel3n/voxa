import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In AI Studio, the backend server must always listen on port 3000
const PORT = 3000;
const app = express();
const server = http.createServer(app);

// Use noServer mode so we explicitly handle upgrade and don't collide with Vite HMR
const wss = new WebSocketServer({ noServer: true });

wss.on('error', (err) => {
  console.warn('WebSocketServer warning:', err?.message || err);
});

server.on('error', (err) => {
  console.error('HTTP server error:', err);
});

server.on('upgrade', (request, socket, head) => {
  socket.on('error', () => {
    // Prevent unhandled errors on socket during upgrade
  });

  const url = request.url || '';
  const pathname = url.split('?')[0];

  // Avoid intercepting Vite HMR WebSockets
  const isViteHmr =
    request.headers['sec-websocket-protocol'] === 'vite-hmr' ||
    url.includes('token=') ||
    pathname.includes('@vite') ||
    pathname.startsWith('/@');

  if (!isViteHmr && (pathname === '/ws' || pathname === '/' || pathname === '/live')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

app.use(express.json());

// Transcript entry structure
export type TranslationStatus = 'none' | 'pending' | 'translated' | 'failed';

export interface TranslationData {
  status: TranslationStatus;
  textEs?: string;
  error?: string;
}

export interface TranscriptEntry {
  id: string;
  order: number;
  text: string;
  languageCode: string;
  timestamp: number;
  speaker?: string;
  translation?: TranslationData;
}

export interface QAQuestion {
  id: string;
  authorName: string;
  text: string;
  timestamp: number;
  votes: number;
  isAnswered: boolean;
  aiHighlightReason?: string;
}

// Room state definition
interface RoomState {
  id: string;
  title: string;
  glossary: string[];
  broadcasterWs: WebSocket | null;
  broadcasterId: string | null;
  viewers: Set<WebSocket>;
  geminiSession: any | null;
  geminiConnecting: boolean;
  geminiStatus: 'idle' | 'connecting' | 'ready' | 'listening' | 'error';
  geminiError: string | null;
  history: TranscriptEntry[];
  currentInterim: string | null;
  lastInterimTime: number;
  orderCounter: number;
  audioQueue: string[]; // FIFO buffer of base64 chunks for backpressure management
  isSendingAudio: boolean;
  droppedChunks: number;
  totalChunksProcessed: number;
  initialConnectDurationMs: number;
  questions: QAQuestion[];
}

const rooms = new Map<string, RoomState>();

function getOrCreateRoom(roomId: string): RoomState {
  const cleanId = (roomId || 'sala-principal').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  let room = rooms.get(cleanId);
  if (!room) {
    room = {
      id: cleanId,
      title: 'Nerdearla Keynote 2026',
      glossary: ['Kubernetes', 'Docker', 'Microservicios', 'TypeScript', 'Gemini', 'Python', 'DevOps', 'PostgreSQL', 'Golang'],
      broadcasterWs: null,
      broadcasterId: null,
      viewers: new Set(),
      geminiSession: null,
      geminiConnecting: false,
      geminiStatus: 'idle',
      geminiError: null,
      history: [],
      currentInterim: null,
      lastInterimTime: 0,
      orderCounter: 0,
      audioQueue: [],
      isSendingAudio: false,
      droppedChunks: 0,
      totalChunksProcessed: 0,
      initialConnectDurationMs: 0,
      questions: [],
    };
    rooms.set(cleanId, room);
  }
  return room;
}

// Safe WebSocket sender that guarantees no unhandled error events
function safeSend(ws: WebSocket | null, message: any): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const payload = typeof message === 'string' ? message : JSON.stringify(message);
  try {
    ws.send(payload, (err) => {
      // Callback absorbs any senderOnError if socket dropped abruptly
      if (err) {
        // Ignored safely
      }
    });
  } catch (e) {
    // ignore
  }
}

function broadcastToRoom(room: RoomState, message: any, excludeWs?: WebSocket) {
  const payload = JSON.stringify(message);
  // Send to broadcaster
  if (room.broadcasterWs && room.broadcasterWs !== excludeWs) {
    safeSend(room.broadcasterWs, payload);
  }
  // Send to viewers
  for (const viewer of room.viewers) {
    if (viewer !== excludeWs) {
      safeSend(viewer, payload);
    }
  }
}

// Initialize Gemini Live Transcription Session for a Room
async function startGeminiLiveSession(room: RoomState): Promise<void> {
  if (room.geminiSession || room.geminiConnecting) {
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    room.geminiStatus = 'error';
    room.geminiError = 'GEMINI_API_KEY no está configurada en el servidor. Configurala en Settings > Secrets.';
    broadcastToRoom(room, {
      type: 'transcription:status',
      status: 'error',
      error: room.geminiError,
    });
    return;
  }

  room.geminiConnecting = true;
  room.geminiStatus = 'connecting';
  broadcastToRoom(room, {
    type: 'transcription:status',
    status: 'connecting',
    message: 'Conectando con Gemini Live (gemini-3.5-transcribe-live)...',
  });

  const connectStartTime = Date.now();

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const session = await ai.live.connect({
      model: 'gemini-3.5-transcribe-live',
      config: {
        responseModalities: [Modality.TEXT],
        inputAudioTranscription: {
          // Automatic language detection when languageCodes is omitted
          ...(room.glossary && room.glossary.length > 0 ? { customVocabulary: room.glossary } : {}),
        },
        systemInstruction: {
          parts: [
            {
              text: `You are a real-time verbatim speech-to-text engine for the tech conference Nerdearla.
Transcribe speech exactly as uttered in Spanish or English without altering words or translating.
During silence, pauses, background noise, or coughs, NEVER output text or hallucinate phrases.
Output only what is genuinely spoken. Technical terms glossary: ${room.glossary.join(', ')}.`,
            },
          ],
        },
      },
      callbacks: {
        onmessage: (serverMessage: LiveServerMessage) => {
          handleGeminiMessage(room, serverMessage);
        },
        onerror: (err: any) => {
          const errMsg = err?.message || (typeof err === 'string' ? err : 'Error en la conexión con Gemini Live');
          console.warn(`[Room ${room.id}] Gemini Live error:`, errMsg);
          room.geminiStatus = 'error';
          room.geminiError = errMsg;
          broadcastToRoom(room, {
            type: 'transcription:status',
            status: 'error',
            error: `Error del proveedor Gemini Live: ${room.geminiError}`,
          });
        },
        onclose: (e: any) => {
          room.geminiSession = null;
          room.geminiConnecting = false;
          if (room.geminiStatus !== 'error') {
            room.geminiStatus = 'idle';
          }
          broadcastToRoom(room, {
            type: 'transcription:status',
            status: room.geminiStatus,
            message: 'Sesión de transcripción cerrada.',
          });
        },
      },
    });

    room.initialConnectDurationMs = Date.now() - connectStartTime;
    room.geminiSession = session;
    room.geminiConnecting = false;
    room.geminiStatus = 'listening';
    room.geminiError = null;

    console.log(`[Room ${room.id}] Connected to Gemini Live in ${room.initialConnectDurationMs}ms`);

    broadcastToRoom(room, {
      type: 'transcription:status',
      status: 'listening',
      initialConnectDurationMs: room.initialConnectDurationMs,
      message: 'Gemini Live activo y escuchando audio PCM 16kHz',
    });

    // Start draining any pending audio
    drainAudioQueue(room);
  } catch (err: any) {
    room.geminiConnecting = false;
    room.geminiSession = null;
    room.geminiStatus = 'error';
    room.geminiError = err?.message || 'Fallo al iniciar sesión Gemini Live';
    console.warn(`[Room ${room.id}] startGeminiLiveSession error:`, room.geminiError);

    broadcastToRoom(room, {
      type: 'transcription:status',
      status: 'error',
      error: `Error al iniciar Gemini Live (gemini-3.5-transcribe-live): ${room.geminiError}`,
    });
  }
}

function detectIsSpanish(text: string): boolean {
  if (!text) return false;
  // If text contains Spanish specific characters (accent marks or inverted punctuation)
  if (/[áéíóúñÁÉÍÓÚÑ¿¡]/.test(text)) return true;

  const words = text.toLowerCase().match(/\b[a-záéíóúñ]+\b/g) || [];
  if (words.length === 0) return false;

  const spanishMarkers = new Set([
    'de', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no',
    'una', 'su', 'al', 'lo', 'como', 'mas', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este', 'sí',
    'porque', 'esta', 'son', 'entre', 'está', 'cuando', 'muy', 'sin', 'sobre', 'ser', 'tiene',
    'también', 'hola', 'bienvenidos', 'todos', 'buenos', 'días', 'tardes', 'vamos', 'hablar',
    'charla', 'gracias', 'amigos', 'gente', 'que', 'qué'
  ]);

  const englishMarkers = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with',
    'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her',
    'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up',
    'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'welcome', 'today', 'talk', 'conference'
  ]);

  let esScore = 0;
  let enScore = 0;

  for (const w of words) {
    if (spanishMarkers.has(w)) esScore++;
    if (englishMarkers.has(w)) enScore++;
  }

  return esScore > enScore;
}

// Decoupled asynchronous translation pipeline (English -> Spanish)
async function translateEntryAsync(room: RoomState, entry: TranscriptEntry) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    entry.translation = { status: 'failed', error: 'Sin GEMINI_API_KEY en servidor' };
    broadcastToRoom(room, {
      type: 'caption:translated',
      roomId: room.id,
      entryId: entry.id,
      status: 'failed',
      error: entry.translation.error,
    });
    return;
  }

  const glossaryStr = room.glossary.length > 0 ? room.glossary.join(', ') : 'Kubernetes, Docker, TypeScript';
  const systemPrompt = `You are an expert technical translator for the Nerdearla tech conference in Argentina.
Translate English speech accurately into natural, technical Argentine Spanish.
Preserve technical terms and proper names verbatim: ${glossaryStr}.
If the text is already Spanish, return it unchanged.
Output strictly and solely the translated Spanish sentence. Do not add quotes, markdown, prefixes or commentary.`;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  let translated = '';
  let lastError: any = null;

  // Primary attempt with gemini-flash-lite-latest (highest availability, fast response)
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: entry.text,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
      },
    });
    translated = response.text?.trim() || '';
  } catch (err: any) {
    lastError = err;
    console.warn(`[Room ${room.id}] gemini-flash-lite-latest failed (${err?.status || err?.message}), trying secondary fallback:`, err?.message || err);

    // Secondary attempt with retry
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: entry.text,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.1,
          },
        });
        translated = response.text?.trim() || '';
        if (translated) break;
      } catch (retryErr: any) {
        lastError = retryErr;
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  if (translated) {
    // Strip markdown formatting or accidental wrapping quotes
    const cleanTranslated = translated.replace(/^["'«»“`*]+|["'«»”`*]+$/g, '').trim();

    entry.translation = {
      status: 'translated',
      textEs: cleanTranslated,
    };

    const histItem = room.history.find((h) => h.id === entry.id);
    if (histItem) {
      histItem.translation = entry.translation;
    }

    broadcastToRoom(room, {
      type: 'caption:translated',
      roomId: room.id,
      entryId: entry.id,
      textEs: translated,
      status: 'translated',
    });
  } else {
    const errMsg = lastError?.message || 'Error en servicio de traducción';
    console.warn(`[Room ${room.id}] Translation permanently failed for entry ${entry.id}:`, errMsg);
    entry.translation = {
      status: 'failed',
      error: errMsg,
    };
    const histItem = room.history.find((h) => h.id === entry.id);
    if (histItem) {
      histItem.translation = entry.translation;
    }
    broadcastToRoom(room, {
      type: 'caption:translated',
      roomId: room.id,
      entryId: entry.id,
      status: 'failed',
      error: errMsg,
    });
  }
}

// Process messages from Gemini Live
function handleGeminiMessage(room: RoomState, message: LiveServerMessage) {
  const now = Date.now();

  // 1. Check for interimInputTranscription (provisional subtitle updated with each partial)
  const interim = message.serverContent?.interimInputTranscription;
  if (interim && typeof interim.text === 'string') {
    const cleanText = interim.text.trim();
    if (cleanText) {
      room.currentInterim = cleanText;
      room.lastInterimTime = now;
      broadcastToRoom(room, {
        type: 'caption:interim',
        roomId: room.id,
        text: cleanText,
        languageCode: interim.languageCode || 'auto',
        timestamp: now,
      });
    }
  }

  // 2. Check for final inputTranscription
  const finalTranscription = message.serverContent?.inputTranscription;
  if (finalTranscription && typeof finalTranscription.text === 'string') {
    const text = finalTranscription.text.trim();
    if (text) {
      room.orderCounter++;
      const lang = (finalTranscription.languageCode || '').toLowerCase();
      // Automatically detect if utterance is already in Spanish
      const isSpanish = lang.startsWith('es') || detectIsSpanish(text);

      const entry: TranscriptEntry = {
        id: `${room.id}-${now}-${room.orderCounter}`,
        order: room.orderCounter,
        text,
        languageCode: isSpanish ? 'es' : finalTranscription.languageCode || 'en',
        timestamp: now,
        speaker: finalTranscription.speakerLabel,
        translation: isSpanish
          ? { status: 'none', textEs: text }
          : { status: 'pending' },
      };

      // Append strictly final transcription to room history
      room.history.push(entry);
      // Clear interim since final is confirmed
      room.currentInterim = null;

      // Broadcast original final caption immediately to not block audio or display
      broadcastToRoom(room, {
        type: 'caption:final',
        roomId: room.id,
        entry,
        timestamp: now,
      });

      // Launch async translation only if not already native Spanish
      if (!isSpanish) {
        translateEntryAsync(room, entry);
      }
    }
  }

  // 3. Model turn (in case text response modalities emit transcription)
  const parts = message.serverContent?.modelTurn?.parts;
  if (parts && parts.length > 0) {
    for (const part of parts) {
      if (part.text && part.text.trim()) {
        const text = part.text.trim();
        const lastEntry = room.history[room.history.length - 1];
        if (!lastEntry || lastEntry.text !== text) {
          room.orderCounter++;
          const isSpanish = detectIsSpanish(text);
          const entry: TranscriptEntry = {
            id: `${room.id}-${now}-${room.orderCounter}`,
            order: room.orderCounter,
            text,
            languageCode: isSpanish ? 'es' : 'en',
            timestamp: now,
            translation: isSpanish
              ? { status: 'none', textEs: text }
              : { status: 'pending' },
          };
          room.history.push(entry);
          room.currentInterim = null;
          broadcastToRoom(room, {
            type: 'caption:final',
            roomId: room.id,
            entry,
            timestamp: now,
          });
          if (!isSpanish) {
            translateEntryAsync(room, entry);
          }
        }
      }
    }
  }
}

// Backpressure management: bounded queue for audio chunks
const MAX_QUEUE_CHUNKS = 20; // 20 * 100ms = 2.0s maximum audio buffer

function enqueueAudioChunk(room: RoomState, base64Data: string) {
  if (room.audioQueue.length >= MAX_QUEUE_CHUNKS) {
    // Drop oldest to avoid runaway latency or memory leak
    room.audioQueue.shift();
    room.droppedChunks++;
  }
  room.audioQueue.push(base64Data);
  drainAudioQueue(room);
}

async function drainAudioQueue(room: RoomState) {
  if (room.isSendingAudio || !room.geminiSession) {
    return;
  }

  room.isSendingAudio = true;

  try {
    while (room.audioQueue.length > 0 && room.geminiSession) {
      const chunk = room.audioQueue.shift();
      if (!chunk) break;

      room.totalChunksProcessed++;
      try {
        room.geminiSession.sendRealtimeInput({
          audio: {
            data: chunk,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      } catch (err: any) {
        console.warn(`[Room ${room.id}] Error in sendRealtimeInput:`, err?.message || err);
        break;
      }
    }
  } catch (err: any) {
    console.warn(`[Room ${room.id}] Error in drainAudioQueue:`, err?.message || err);
  } finally {
    room.isSendingAudio = false;
  }
}

// Gracefully close Gemini Live session
async function stopGeminiLiveSession(room: RoomState) {
  const session = room.geminiSession;
  // Detach immediately to prevent any concurrent sendRealtimeInput on closing socket
  room.geminiSession = null;
  room.geminiConnecting = false;
  room.geminiStatus = 'idle';
  room.currentInterim = null;
  room.audioQueue = [];

  if (session) {
    try {
      await session.close();
    } catch (e) {
      // ignore
    }
  }
}

// WebSocket Connection Handling
wss.on('connection', (ws: WebSocket) => {
  let currentRoomId: string | null = null;
  let userRole: 'broadcaster' | 'viewer' = 'viewer';
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Attach error handler to prevent unhandled error event
  ws.on('error', (e) => {
    console.warn('Client WebSocket error caught:', e?.message || e);
    leaveCurrentRoom();
  });

  ws.on('message', async (data: any) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'join:room': {
          const targetRoomId = (msg.roomId || 'sala-principal').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
          const role = msg.role === 'broadcaster' ? 'broadcaster' : 'viewer';

          // Leave previous room if switching
          if (currentRoomId && currentRoomId !== targetRoomId) {
            leaveCurrentRoom();
          }

          currentRoomId = targetRoomId;
          userRole = role;
          const room = getOrCreateRoom(targetRoomId);

          if (role === 'broadcaster') {
            // Check if there is already an active broadcaster
            if (room.broadcasterWs && room.broadcasterWs !== ws && room.broadcasterWs.readyState === WebSocket.OPEN) {
              safeSend(ws, {
                type: 'error',
                code: 'BROADCASTER_EXISTS',
                message: 'Ya hay un micrófono transmitiendo en esta sala. Podés unirte como espectador o elegir otra sala.',
              });
              return;
            }

            room.broadcasterWs = ws;
            room.broadcasterId = clientId;
            if (msg.title) room.title = msg.title;
            if (Array.isArray(msg.glossary)) room.glossary = msg.glossary;

            // Start Gemini Live connection for the broadcaster
            startGeminiLiveSession(room);
          } else {
            room.viewers.add(ws);
          }

          // Initial synchronization payload
          safeSend(ws, {
            type: 'room:sync',
            room: {
              id: room.id,
              title: room.title,
              glossary: room.glossary,
              broadcasterActive: !!(room.broadcasterWs && room.broadcasterWs.readyState === WebSocket.OPEN),
              viewersCount: room.viewers.size,
              geminiStatus: room.geminiStatus,
              geminiError: room.geminiError,
              initialConnectDurationMs: room.initialConnectDurationMs,
              history: room.history,
              currentInterim: room.currentInterim,
              droppedChunks: room.droppedChunks,
              totalChunks: room.totalChunksProcessed,
              questions: room.questions,
            },
            role: userRole,
            clientId,
          });

          // Notify room about viewer / broadcaster update
          broadcastToRoom(room, {
            type: 'room:meta',
            title: room.title,
            glossary: room.glossary,
            broadcasterActive: !!(room.broadcasterWs && room.broadcasterWs.readyState === WebSocket.OPEN),
            viewersCount: room.viewers.size,
          });

          break;
        }

        case 'audio': {
          if (!currentRoomId || userRole !== 'broadcaster') {
            return;
          }
          const room = rooms.get(currentRoomId);
          if (!room || room.broadcasterWs !== ws) {
            return;
          }

          if (msg.data && typeof msg.data === 'string') {
            enqueueAudioChunk(room, msg.data);
          }
          break;
        }

        case 'update:room_meta': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          if (msg.title && (userRole === 'broadcaster' || !room.broadcasterWs)) {
            room.title = String(msg.title).trim();
          }
          if (Array.isArray(msg.glossary)) {
            const uniqueTerms = Array.from(
              new Set(msg.glossary.map((t: string) => String(t).trim()).filter(Boolean))
            ) as string[];
            room.glossary = uniqueTerms;
          }

          broadcastToRoom(room, {
            type: 'room:meta',
            title: room.title,
            glossary: room.glossary,
            broadcasterActive: !!room.broadcasterWs,
            viewersCount: room.viewers.size,
          });
          break;
        }

        case 'clear:history': {
          if (!currentRoomId || userRole !== 'broadcaster') return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          room.history = [];
          room.currentInterim = null;
          broadcastToRoom(room, {
            type: 'history:cleared',
            roomId: room.id,
          });
          break;
        }

        case 'retry:translation': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const entry = room.history.find((h) => h.id === msg.entryId);
          if (entry) {
            entry.translation = { status: 'pending' };
            broadcastToRoom(room, {
              type: 'caption:translated',
              roomId: room.id,
              entryId: entry.id,
              status: 'pending',
            });
            translateEntryAsync(room, entry);
          }
          break;
        }

        case 'qa:submit': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const text = String(msg.text || '').trim();
          if (!text) return;
          const newQ: QAQuestion = {
            id: 'q_' + Math.random().toString(36).substring(2, 9),
            authorName: String(msg.authorName || 'Asistente').trim() || 'Asistente',
            text,
            timestamp: Date.now(),
            votes: 1,
            isAnswered: false,
          };
          room.questions.unshift(newQ);
          broadcastToRoom(room, {
            type: 'qa:updated',
            roomId: room.id,
            questions: room.questions,
          });
          break;
        }

        case 'qa:vote': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const q = room.questions.find((item) => item.id === msg.questionId);
          if (q) {
            const delta = Number(msg.delta) || 1;
            q.votes = Math.max(0, (q.votes || 0) + delta);
            broadcastToRoom(room, {
              type: 'qa:updated',
              roomId: room.id,
              questions: room.questions,
            });
          }
          break;
        }

        case 'qa:toggle_answered': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const q = room.questions.find((item) => item.id === msg.questionId);
          if (q) {
            q.isAnswered = !q.isAnswered;
            broadcastToRoom(room, {
              type: 'qa:updated',
              roomId: room.id,
              questions: room.questions,
            });
          }
          break;
        }

        case 'qa:delete': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          room.questions = room.questions.filter((item) => item.id !== msg.questionId);
          broadcastToRoom(room, {
            type: 'qa:updated',
            roomId: room.id,
            questions: room.questions,
          });
          break;
        }

        case 'leave:room': {
          leaveCurrentRoom();
          break;
        }

        case 'ping': {
          safeSend(ws, { type: 'pong', timestamp: Date.now() });
          break;
        }
      }
    } catch (err) {
      console.warn('WebSocket message processing warning:', err);
    }
  });

  function leaveCurrentRoom() {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    if (userRole === 'broadcaster' && room.broadcasterWs === ws) {
      room.broadcasterWs = null;
      room.broadcasterId = null;
      stopGeminiLiveSession(room);

      broadcastToRoom(room, {
        type: 'broadcaster:left',
        roomId: room.id,
        broadcasterActive: false,
      });
    } else {
      room.viewers.delete(ws);
      broadcastToRoom(room, {
        type: 'viewers:count',
        viewersCount: room.viewers.size,
      });
    }

    currentRoomId = null;
  }

  ws.on('close', () => {
    leaveCurrentRoom();
  });
});

// Periodic silence cleanup: if interim caption hasn't updated in 4s, clear it
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.currentInterim && now - room.lastInterimTime > 4000) {
      room.currentInterim = null;
      broadcastToRoom(room, {
        type: 'caption:interim',
        roomId: room.id,
        text: '',
        timestamp: now,
      });
    }
  }
}, 1000);

// API Status Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    roomsCount: rooms.size,
    hasApiKey: !!process.env.GEMINI_API_KEY,
    rooms: Array.from(rooms.values()).map(r => ({
      id: r.id,
      title: r.title,
      viewers: r.viewers.size,
      hasBroadcaster: !!r.broadcasterWs,
      geminiStatus: r.geminiStatus,
      geminiError: r.geminiError,
      historyCount: r.history.length,
      history: r.history,
    })),
  });
});

// AI Executive Summary & Conference Minutes Route
app.post('/api/rooms/:roomId/summary', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor' });
  }

  const { roomId } = req.params;
  const room = rooms.get(roomId);

  // Use provided transcript or room history
  const entries: TranscriptEntry[] = req.body?.transcript || room?.history || [];
  const title = req.body?.title || room?.title || 'Charla Nerdearla 2026';
  const glossary = req.body?.glossary || room?.glossary || [];

  if (!entries || entries.length === 0) {
    return res.status(400).json({
      error: 'No hay subtítulos en el historial para generar la minuta. Transmita o reproduzca audio primero.',
    });
  }

  // Format transcript chronologically
  const formattedLines = entries.map((entry, idx) => {
    const mins = Math.floor((idx * 4) / 60);
    const secs = (idx * 4) % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const esText = entry.translation?.textEs || (entry.languageCode.startsWith('es') ? entry.text : '');
    const enText = entry.text;

    if (esText && esText !== enText) {
      return `[${timeStr}] Original (EN): "${enText}" | Español: "${esText}"`;
    }
    return `[${timeStr}]: "${enText}"`;
  });

  const transcriptBlock = formattedLines.join('\n');
  const glossaryBlock = glossary.length > 0 ? `\nGlosario de referencia provisto: ${glossary.join(', ')}` : '';

  const systemInstruction = `Sos un relator técnico y editor senior para la conferencia tecnológica Nerdearla en Argentina.
A partir de la transcripción en vivo proporcionada de la charla "${title}", redactá un resumen ejecutivo y minuta técnica completa en formato Markdown.
El tono debe ser profesional, técnico, conciso y fluido en español rioplatense neutro/técnico.
Preservá los nombres propios, marcas y tecnologías verbatim.
Organizá el contenido exactamente en estas secciones:

# 📋 Minuta y Resumen Ejecutivo: ${title}

## 🎯 Síntesis de la Charla
(2 o 3 párrafos resumiendo el objetivo de la presentación, los desafíos técnicos planteados y la solución o propuesta del orador)

## 💡 Puntos Clave & Aprendizajes (Key Takeaways)
- (Punto clave 1 con explicación concisa del impacto)
- (Punto clave 2)
- (Punto clave 3)
- (Punto clave 4)
- (Punto clave 5)

## 🛠️ Stack Tecnológico & Herramientas Abordadas
(Lista organizada de herramientas, protocolos, librerías o servicios mencionados y para qué se utilizan según la charla)

## 📌 Recomendaciones & Conclusiones para la Comunidad
(Ideas prácticas para los ingenieros y equipos que asistieron a la sesión)`;

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `Transcripción de la charla:\n${transcriptBlock}${glossaryBlock}\n\nPor favor, generá la minuta ejecutiva en Markdown:`,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    const summaryMarkdown = response.text?.trim() || '';
    if (!summaryMarkdown) {
      throw new Error('Respuesta vacía del modelo');
    }

    res.json({
      success: true,
      summary: summaryMarkdown,
      title,
      entriesCount: entries.length,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error(`[Room ${roomId}] Summary generation failed:`, err);
    res.status(500).json({
      error: 'Error al generar la minuta con Gemini: ' + (err?.message || 'Error del servicio'),
    });
  }
});

// AI Q&A Question Clustering and Highlighting Route
app.post('/api/rooms/:roomId/qa/analyze', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' });
  }

  const { roomId } = req.params;
  const room = rooms.get(roomId);
  const questions: QAQuestion[] = room?.questions || req.body?.questions || [];
  const entries: TranscriptEntry[] = room?.history || req.body?.transcript || [];

  if (questions.length === 0) {
    return res.status(400).json({ error: 'No hay preguntas de la audiencia para analizar.' });
  }

  const questionsList = questions
    .map((q) => `ID: ${q.id} | De: ${q.authorName} | Votos: ${q.votes} | Pregunta: "${q.text}"`)
    .join('\n');

  const recentTranscript = entries.slice(-20).map((e) => e.text).join(' ');

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Sos un moderador técnico del panel Q&A de Nerdearla.
Contexto breve de lo que el orador expuso:
"${recentTranscript.slice(0, 1500)}"

Lista de preguntas enviadas por los asistentes:
${questionsList}

Analizá las preguntas y seleccioná las mejores (hasta 3-5 preguntas) que tengan mayor profundidad técnica o aporten más valor al debate en vivo.
Respondé ÚNICAMENTE un array JSON válido con los IDs seleccionados y una justificación técnica corta (1 oración) para el moderador.
Formato estricto:
[
  {
    "id": "q_xyz",
    "reason": "Profundiza sobre la tolerancia a fallos en Kubernetes explicada en el minuto 10."
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim() || '[]';
    const highlightedList: Array<{ id: string; reason: string }> = JSON.parse(text);

    // Apply highlights to room state
    if (room) {
      for (const item of highlightedList) {
        const q = room.questions.find((x) => x.id === item.id);
        if (q) {
          q.aiHighlightReason = item.reason;
        }
      }

      broadcastToRoom(room, {
        type: 'qa:updated',
        roomId: room.id,
        questions: room.questions,
      });
    }

    res.json({
      success: true,
      highlighted: highlightedList,
      questions: room?.questions || [],
    });
  } catch (err: any) {
    console.error(`[Room ${roomId}] Q&A analysis failed:`, err);
    res.status(500).json({ error: 'Error analizando preguntas: ' + (err?.message || 'Error del servicio') });
  }
});

// Setup Vite middleware or Static files
async function initServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Nerdearla Live Captions server running on http://0.0.0.0:${PORT}`);
  });
}

initServer().catch((err) => {
  console.error('Server initialization failed:', err);
  process.exit(1);
});
