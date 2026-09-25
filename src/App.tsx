/**
 * Nerdearla Live Captions - Main Application
 * Stage 1: Continuous 16kHz PCM mono live transcription with Gemini Live (gemini-3.5-transcribe-live).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { StatusPill } from './components/StatusPill';
import { VUMeter } from './components/VUMeter';
import { RoomControls } from './components/RoomControls';
import { CaptionsViewer } from './components/CaptionsViewer';
import { ValidationBench } from './components/ValidationBench';
import { OverlayView } from './components/OverlayView';
import { GlossaryModal } from './components/GlossaryModal';
import { MeetingSummaryModal } from './components/MeetingSummaryModal';
import { AudioCaptureService } from './services/audioCapture';
import { SocketClient } from './services/socketClient';
import {
  MicPermissionState,
  CaptureState,
  ConnectionState,
  TranscriptionState,
  TranscriptEntry,
  LatencyMetrics,
} from './types';
import { Mic, MicOff, AlertOctagon, Play, Square, Activity, Info } from 'lucide-react';

export default function App() {
  // Parse URL query params for room and role
  const getInitialParams = () => {
    const params = new URLSearchParams(window.location.search);
    const r = (params.get('room') || 'sala-principal').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const roleParam = params.get('role') === 'broadcaster' ? 'broadcaster' : 'viewer';
    return { room: r || 'sala-principal', role: roleParam as 'broadcaster' | 'viewer' };
  };

  const initial = getInitialParams();
  const [roomId, setRoomId] = useState<string>(initial.room);
  const [role, setRole] = useState<'broadcaster' | 'viewer'>(initial.role);
  const [talkTitle, setTalkTitle] = useState<string>('Nerdearla Keynote 2026: Cloud Native & AI');
  const [glossary, setGlossary] = useState<string[]>([
    'Kubernetes',
    'Docker',
    'Microservicios',
    'TypeScript',
    'Gemini',
    'DevOps',
    'PostgreSQL',
  ]);

  // States for the 4 separate pillars
  const [micPermission, setMicPermission] = useState<MicPermissionState>('prompt');
  const [captureState, setCaptureState] = useState<CaptureState>('inactive');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [transcriptionState, setTranscriptionState] = useState<TranscriptionState>('idle');
  const [geminiError, setGeminiError] = useState<string | null>(null);

  // Subtitles state
  const [currentInterim, setCurrentInterim] = useState<string | null>(null);
  const [history, setHistory] = useState<TranscriptEntry[]>([]);

  // Room state
  const [broadcasterActive, setBroadcasterActive] = useState<boolean>(false);
  const [viewersCount, setViewersCount] = useState<number>(1);

  // Audio VU Meter state
  const [vuRms, setVuRms] = useState<number>(0);
  const [vuPeak, setVuPeak] = useState<number>(0);

  // General error banner
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Validation modal state
  const [isValidationOpen, setIsValidationOpen] = useState<boolean>(false);

  // Overlay OBS / Projector mode state
  const [isOverlayOpen, setIsOverlayOpen] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('overlay') === '1' || params.get('mode') === 'overlay';
  });

  // Dynamic Glossary modal state
  const [isGlossaryOpen, setIsGlossaryOpen] = useState<boolean>(false);

  // AI Meeting Minutes modal state
  const [isSummaryOpen, setIsSummaryOpen] = useState<boolean>(false);

  // Latency telemetry tracking
  const [metrics, setMetrics] = useState<LatencyMetrics>({
    initialConnectDurationMs: 0,
    lastVoiceStartToFirstPartialMs: null,
    lastVoiceEndToFinalMs: null,
    interimUpdatesCount: 0,
    finalCaptionsCount: 0,
    totalChunksSent: 0,
    droppedChunks: 0,
  });

  // Tracking timestamps for latency calculations
  const voiceStartTimeRef = useRef<number | null>(null);
  const voiceEndTimeRef = useRef<number | null>(null);
  const isSpeakingRef = useRef<boolean>(false);

  // Services references
  const audioCaptureRef = useRef<AudioCaptureService | null>(null);
  const socketClientRef = useRef<SocketClient | null>(null);

  // Synchronize URL query params
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    url.searchParams.set('role', role);
    window.history.replaceState({}, '', url.toString());
  }, [roomId, role]);

  // Initialize and connect SocketClient
  useEffect(() => {
    const client = new SocketClient({
      onConnectionChange: (state) => {
        setConnectionState(state);
      },
      onRoomSync: (data) => {
        setTalkTitle(data.room.title || 'Nerdearla Keynote 2026');
        if (data.room.glossary) setGlossary(data.room.glossary);
        setBroadcasterActive(data.room.broadcasterActive);
        setViewersCount(data.room.viewersCount || 1);
        setHistory(data.room.history || []);
        setCurrentInterim(data.room.currentInterim || null);
        setTranscriptionState(data.room.geminiStatus || 'idle');
        setGeminiError(data.room.geminiError || null);
        if (data.room.initialConnectDurationMs) {
          setMetrics((prev) => ({ ...prev, initialConnectDurationMs: data.room.initialConnectDurationMs }));
        }
      },
      onInterimCaption: (text, timestamp) => {
        setCurrentInterim(text);
        setMetrics((prev) => {
          let voiceToPartial = prev.lastVoiceStartToFirstPartialMs;
          if (voiceStartTimeRef.current) {
            voiceToPartial = Math.max(1, timestamp - voiceStartTimeRef.current);
            voiceStartTimeRef.current = null; // measure only on first partial
          }
          return {
            ...prev,
            lastVoiceStartToFirstPartialMs: voiceToPartial,
            interimUpdatesCount: prev.interimUpdatesCount + 1,
          };
        });
      },
      onFinalCaption: (entry, timestamp) => {
        setHistory((prev) => {
          // Idempotent: avoid duplicate entries if already present
          if (prev.some((e) => e.id === entry.id)) return prev;
          return [...prev, entry];
        });
        setCurrentInterim(null);

        setMetrics((prev) => {
          let voiceEndToFinal = prev.lastVoiceEndToFinalMs;
          if (voiceEndTimeRef.current) {
            voiceEndToFinal = Math.max(1, timestamp - voiceEndTimeRef.current);
            voiceEndTimeRef.current = null;
          }
          return {
            ...prev,
            lastVoiceEndToFinalMs: voiceEndToFinal,
            finalCaptionsCount: prev.finalCaptionsCount + 1,
          };
        });
      },
      onCaptionTranslated: (entryId, textEs, status, error) => {
        setHistory((prev) =>
          prev.map((entry) => {
            if (entry.id === entryId) {
              return {
                ...entry,
                translation: {
                  status: (status as any) || 'translated',
                  textEs,
                  error,
                },
              };
            }
            return entry;
          })
        );
      },
      onTranscriptionStatus: (status, err, initialMs) => {
        setTranscriptionState(status);
        if (err) setGeminiError(err);
        if (initialMs) {
          setMetrics((prev) => ({ ...prev, initialConnectDurationMs: initialMs }));
        }
      },
      onRoomMeta: (meta) => {
        if (meta.title) setTalkTitle(meta.title);
        if (meta.glossary) setGlossary(meta.glossary);
        setBroadcasterActive(meta.broadcasterActive);
        if (typeof meta.viewersCount === 'number') setViewersCount(meta.viewersCount);
      },
      onError: (msg, code) => {
        setErrorMessage(msg);
      },
      onBroadcasterLeft: () => {
        setBroadcasterActive(false);
        setTranscriptionState('idle');
        setCurrentInterim(null);
      },
    });

    socketClientRef.current = client;
    client.connect(roomId, role, talkTitle, glossary);

    return () => {
      client.disconnect();
    };
  }, [roomId, role]);

  // Handle Voice Activity Detection locally for latency measurement
  const handleMeterUpdate = useCallback((rms: number, peak: number) => {
    setVuRms(rms);
    setVuPeak(peak);

    const VOICE_THRESHOLD = 0.015;
    if (rms > VOICE_THRESHOLD) {
      if (!isSpeakingRef.current) {
        isSpeakingRef.current = true;
        voiceStartTimeRef.current = Date.now();
      }
    } else {
      if (isSpeakingRef.current) {
        isSpeakingRef.current = false;
        voiceEndTimeRef.current = Date.now();
      }
    }
  }, []);

  // Start Mic & Broadcasting (Must be called in response to user click)
  const handleStartBroadcasting = async () => {
    setErrorMessage(null);

    // If role was viewer, switch to broadcaster
    if (role !== 'broadcaster') {
      setRole('broadcaster');
    }

    try {
      if (!audioCaptureRef.current) {
        audioCaptureRef.current = new AudioCaptureService({
          onChunk: (base64Chunk, timestamp) => {
            if (socketClientRef.current) {
              const ok = socketClientRef.current.sendAudioChunk(base64Chunk, timestamp);
              setMetrics((prev) => ({
                ...prev,
                totalChunksSent: prev.totalChunksSent + 1,
                droppedChunks: ok ? prev.droppedChunks : prev.droppedChunks + 1,
              }));
            }
          },
          onMeter: (rms, peak) => {
            handleMeterUpdate(rms, peak);
          },
          onError: (err: any) => {
            console.error('Audio capture error:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              setMicPermission('denied');
              setErrorMessage('Permiso de micrófono denegado. Habilitá el micrófono en la barra del navegador para transmitir.');
            } else {
              setErrorMessage(`Error de captura de audio: ${err.message || err.name}`);
            }
            setCaptureState('inactive');
          },
        });
      }

      await audioCaptureRef.current.startCapture();
      setMicPermission('granted');
      setCaptureState('capturing');
    } catch (err: any) {
      console.error('Failed to start capture:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicPermission('denied');
      }
      setCaptureState('inactive');
    }
  };

  // Stop Mic & Broadcasting
  const handleStopBroadcasting = () => {
    if (audioCaptureRef.current) {
      audioCaptureRef.current.stopCapture();
      audioCaptureRef.current = null;
    }
    setCaptureState('inactive');
    setVuRms(0);
    setVuPeak(0);
    isSpeakingRef.current = false;
  };

  // Toggle Mute
  const handleToggleMute = () => {
    if (!audioCaptureRef.current) return;
    const currentlyMuted = audioCaptureRef.current.getIsMuted();
    const nextMuted = !currentlyMuted;
    audioCaptureRef.current.setMuted(nextMuted);
    setCaptureState(nextMuted ? 'muted' : 'capturing');
  };

  // Handle switching rooms
  const handleRoomChange = (newRoomId: string) => {
    // If currently capturing, stop audio capture before switching rooms
    handleStopBroadcasting();
    setHistory([]);
    setCurrentInterim(null);
    setRoomId(newRoomId);
  };

  // Handle updating room title and glossary
  const handleUpdateMeta = (newTitle: string, newGlossary: string[]) => {
    setTalkTitle(newTitle);
    setGlossary(newGlossary);
    if (socketClientRef.current) {
      socketClientRef.current.updateRoomMeta(newTitle, newGlossary);
    }
  };

  // Dynamic Glossary update handler
  const handleUpdateGlossary = (newGlossary: string[]) => {
    setGlossary(newGlossary);
    if (socketClientRef.current) {
      socketClientRef.current.updateRoomMeta(talkTitle, newGlossary);
    }
  };

  // Clear room history
  const handleClearHistory = () => {
    if (socketClientRef.current) {
      socketClientRef.current.clearHistory();
    }
    setHistory([]);
  };

  // Synthetic speech test runner (for deterministic validation)
  const handleSimulateSpeechAudio = (phrase: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.lang = phrase.includes('Kubernetes') ? 'en-US' : 'es-ES';
      utterance.rate = 0.95;
      utterance.onstart = () => {
        voiceStartTimeRef.current = Date.now();
        isSpeakingRef.current = true;
      };
      utterance.onend = () => {
        voiceEndTimeRef.current = Date.now();
        isSpeakingRef.current = false;
      };
      window.speechSynthesis.speak(utterance);
    } else {
      alert(`Tu navegador no soporta síntesis local. Por favor pronunciá al micrófono: "${phrase}"`);
    }
  };

  // Dedicated Overlay Mode for OBS / vMix / Auditorium Projector
  if (isOverlayOpen) {
    return (
      <OverlayView
        roomId={roomId}
        talkTitle={talkTitle}
        currentInterim={currentInterim}
        history={history}
        broadcasterActive={broadcasterActive}
        onClose={() => {
          setIsOverlayOpen(false);
          const url = new URL(window.location.href);
          url.searchParams.delete('overlay');
          url.searchParams.delete('mode');
          window.history.replaceState({}, '', url.toString());
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-lime-400 selection:text-black">
      {/* App Header */}
      <Header
        currentRoomId={roomId}
        role={role}
        viewersCount={viewersCount}
        broadcasterActive={broadcasterActive}
        glossaryCount={glossary.length}
        onRoleChange={(newRole) => {
          if (newRole === 'viewer' && captureState !== 'inactive') {
            handleStopBroadcasting();
          }
          setRole(newRole);
        }}
        showValidationModal={() => setIsValidationOpen(true)}
        onOpenOverlay={() => setIsOverlayOpen(true)}
        onOpenGlossary={() => setIsGlossaryOpen(true)}
        onOpenSummary={() => setIsSummaryOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {/* Error notification banner */}
        {errorMessage && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-sm shadow-lg">
            <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="font-semibold block">Aviso del sistema:</strong>
              <p>{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs px-2 py-1 rounded bg-red-900/60 hover:bg-red-800 text-white cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Gemini Provider Error Banner */}
        {transcriptionState === 'error' && geminiError && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-sm shadow-lg">
            <AlertOctagon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="font-semibold block">Error de proveedor Gemini Live:</strong>
              <p>{geminiError}</p>
              <span className="text-xs text-amber-300/80 block mt-1">
                Verificá que la clave en el panel de secretos tenga acceso al modelo <code>gemini-3.5-transcribe-live</code>.
              </span>
            </div>
          </div>
        )}

        {/* Controls Bar: Status Pills & Broadcaster Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 sm:p-5 backdrop-blur-sm">
          {/* Status Indicators */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-mono font-semibold text-neutral-400 uppercase tracking-wider">
              Estados del sistema en tiempo real:
            </span>
            <StatusPill
              micPermission={micPermission}
              captureState={captureState}
              connectionState={connectionState}
              transcriptionState={transcriptionState}
              geminiError={geminiError}
            />
          </div>

          {/* Broadcaster Actions & VU Meter */}
          <div className="flex flex-wrap items-center gap-3">
            {role === 'broadcaster' ? (
              <>
                {/* VU Meter */}
                <VUMeter
                  rms={vuRms}
                  peak={vuPeak}
                  isMuted={captureState === 'muted'}
                  isActive={captureState === 'capturing'}
                />

                {captureState === 'inactive' ? (
                  <button
                    onClick={handleStartBroadcasting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-lime-400 hover:bg-lime-300 text-neutral-950 font-extrabold text-sm rounded-xl cursor-pointer transition-all shadow-lg shadow-lime-400/25 active:scale-95"
                  >
                    <Mic className="w-4 h-4" />
                    <span>Compartir micrófono</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleToggleMute}
                      className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl cursor-pointer transition-all border ${
                        captureState === 'muted'
                          ? 'bg-amber-400 text-neutral-950 border-amber-300'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700'
                      }`}
                    >
                      {captureState === 'muted' ? (
                        <>
                          <Mic className="w-4 h-4" />
                          <span>Activar mic</span>
                        </>
                      ) : (
                        <>
                          <MicOff className="w-4 h-4" />
                          <span>Silenciar mic</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleStopBroadcasting}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 text-xs font-bold rounded-xl cursor-pointer transition-all"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Detener transmisión</span>
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 bg-neutral-950 px-3 py-2 rounded-lg border border-neutral-800">
                <Info className="w-4 h-4 text-lime-400" />
                <span>Modo espectador: Visualizando subtítulos en vivo en tiempo real.</span>
              </div>
            )}
          </div>
        </div>

        {/* Room Controls (Room ID, Talk Title, Technical Glossary) */}
        <RoomControls
          roomId={roomId}
          talkTitle={talkTitle}
          glossary={glossary}
          role={role}
          onRoomChange={handleRoomChange}
          onUpdateMeta={handleUpdateMeta}
          onOpenGlossary={() => setIsGlossaryOpen(true)}
        />

        {/* Captions Viewer Component */}
        <div className="flex-1">
          <CaptionsViewer
            currentInterim={currentInterim}
            history={history}
            talkTitle={talkTitle}
            roomId={roomId}
            isBroadcaster={role === 'broadcaster'}
            onClearHistory={handleClearHistory}
            onRetryTranslation={(entryId) => socketClientRef.current?.retryTranslation(entryId)}
            onOpenOverlay={() => setIsOverlayOpen(true)}
            onOpenSummary={() => setIsSummaryOpen(true)}
          />
        </div>
      </main>

      {/* Bench Validation Modal */}
      <ValidationBench
        isOpen={isValidationOpen}
        onClose={() => setIsValidationOpen(false)}
        metrics={metrics}
        history={history}
        currentInterim={currentInterim}
        roomId={roomId}
        isCapturing={captureState === 'capturing'}
        onSimulateSpeechAudio={handleSimulateSpeechAudio}
      />

      {/* Dynamic Glossary Modal */}
      <GlossaryModal
        isOpen={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
        glossary={glossary}
        talkTitle={talkTitle}
        isBroadcaster={role === 'broadcaster'}
        onUpdateGlossary={handleUpdateGlossary}
      />

      {/* AI Meeting Summary Modal */}
      <MeetingSummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        roomId={roomId}
        talkTitle={talkTitle}
        history={history}
        glossary={glossary}
      />
    </div>
  );
}
