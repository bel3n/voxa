export type TranslationStatus = 'none' | 'pending' | 'translated' | 'failed';

export interface TranslationData {
  status: TranslationStatus;
  textEs?: string;
  error?: string;
}

export type ViewLanguageMode = 'original' | 'spanish' | 'bilingual';

export interface TranscriptEntry {
  id: string;
  order: number;
  text: string;
  languageCode: string;
  timestamp: number;
  speaker?: string;
  translation?: TranslationData;
}

export type MicPermissionState = 'prompt' | 'granted' | 'denied';
export type CaptureState = 'inactive' | 'capturing' | 'muted';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export type TranscriptionState = 'idle' | 'connecting' | 'listening' | 'error';

export interface QAQuestion {
  id: string;
  authorName: string;
  text: string;
  timestamp: number;
  votes: number;
  isAnswered: boolean;
  aiHighlightReason?: string;
}

export interface RoomMetadata {
  id: string;
  title: string;
  glossary: string[];
  broadcasterActive: boolean;
  viewersCount: number;
  geminiStatus: TranscriptionState;
  geminiError?: string | null;
  initialConnectDurationMs: number;
  history: TranscriptEntry[];
  currentInterim?: string | null;
  droppedChunks?: number;
  totalChunks?: number;
  questions?: QAQuestion[];
}

export interface LatencyMetrics {
  initialConnectDurationMs: number;
  lastVoiceStartToFirstPartialMs: number | null;
  lastVoiceEndToFinalMs: number | null;
  interimUpdatesCount: number;
  finalCaptionsCount: number;
  totalChunksSent: number;
  droppedChunks: number;
}
