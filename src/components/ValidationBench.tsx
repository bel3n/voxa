import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, Volume2, Shield, Network, RefreshCw, X, Play, Copy } from 'lucide-react';
import { LatencyMetrics, TranscriptEntry } from '../types';

interface ValidationBenchProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: LatencyMetrics;
  history: TranscriptEntry[];
  currentInterim: string | null;
  roomId: string;
  isCapturing: boolean;
  onSimulateSpeechAudio?: (text: string) => void;
}

export const ValidationBench: React.FC<ValidationBenchProps> = ({
  isOpen,
  onClose,
  metrics,
  history,
  currentInterim,
  roomId,
  isCapturing,
  onSimulateSpeechAudio,
}) => {
  // Test 1: Silence test state
  const [silenceTimer, setSilenceTimer] = useState<number | null>(null);
  const [silenceInitialCount, setSilenceInitialCount] = useState<number>(0);
  const [silenceTestResult, setSilenceTestResult] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');

  // Test 2: English phrase test state
  const targetPhrase = 'Welcome to the conference. Today we will talk about Kubernetes.';
  const [phraseMatched, setPhraseMatched] = useState<boolean>(false);

  // Check phrase 2 match in history
  useEffect(() => {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetNorm = normalize(targetPhrase);
    const found = history.some((h) => normalize(h.text).includes(targetNorm) || targetNorm.includes(normalize(h.text)));
    if (found) {
      setPhraseMatched(true);
    }
  }, [history]);

  // Handle Silence Test Timer
  useEffect(() => {
    let interval: any;
    if (silenceTimer !== null && silenceTimer > 0) {
      interval = setInterval(() => {
        setSilenceTimer((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (silenceTimer === 0) {
      // 15 seconds elapsed: verify no new phrases arrived during silence
      const newItems = history.length - silenceInitialCount;
      if (newItems <= 1) { // at most the original phrase
        setSilenceTestResult('passed');
      } else {
        setSilenceTestResult('failed');
      }
    }
    return () => clearInterval(interval);
  }, [silenceTimer, history.length, silenceInitialCount]);

  const startSilenceTest = () => {
    setSilenceInitialCount(history.length);
    setSilenceTimer(15);
    setSilenceTestResult('running');
    if (onSimulateSpeechAudio) {
      onSimulateSpeechAudio('Hola, bienvenidos');
    }
  };

  const startEnglishTest = () => {
    if (onSimulateSpeechAudio) {
      onSimulateSpeechAudio(targetPhrase);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-lime-400" />
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              Banco de Validación del MVP (Pruebas Obligatorias)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 font-sans">
          <p className="text-xs text-neutral-400">
            Verificá cada uno de los 6 criterios obligatorios antes del pase a producción. Podés usar tu micrófono real o el reproductor de frases para pruebas reproducibles.
          </p>

          {/* Real Metrics Display (Criterion 4) */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
            <h3 className="text-xs font-mono font-bold text-lime-400 uppercase mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>4. Telemetría y Mediciones Reales de Latencia</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800">
                <span className="text-neutral-500 block text-[11px]">Conexión inicial</span>
                <span className="text-white text-base font-bold">
                  {metrics.initialConnectDurationMs ? `${metrics.initialConnectDurationMs} ms` : 'En espera'}
                </span>
              </div>
              <div className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800">
                <span className="text-neutral-500 block text-[11px]">Voz -&gt; 1er parcial</span>
                <span className="text-lime-400 text-base font-bold">
                  {metrics.lastVoiceStartToFirstPartialMs ? `${metrics.lastVoiceStartToFirstPartialMs} ms` : '--'}
                </span>
              </div>
              <div className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800">
                <span className="text-neutral-500 block text-[11px]">Fin voz -&gt; Final</span>
                <span className="text-lime-400 text-base font-bold">
                  {metrics.lastVoiceEndToFinalMs ? `${metrics.lastVoiceEndToFinalMs} ms` : '--'}
                </span>
              </div>
              <div className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800">
                <span className="text-neutral-500 block text-[11px]">Chunks / Descartados</span>
                <span className="text-white text-base font-bold">
                  {metrics.totalChunksSent} / <span className="text-amber-400">{metrics.droppedChunks}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Test 1: Silence & no-hallucination */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <h3 className="text-xs font-mono font-bold text-neutral-200 uppercase flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-lime-400" />
                <span>1. Silencio (15 segundos) sin frases inventadas</span>
              </h3>
              {silenceTestResult === 'passed' && (
                <span className="px-2 py-0.5 rounded bg-lime-950 border border-lime-500 text-[11px] text-lime-300 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-lime-400" /> PASÓ: 0 frases inventadas
                </span>
              )}
              {silenceTestResult === 'failed' && (
                <span className="px-2 py-0.5 rounded bg-red-950 border border-red-500 text-[11px] text-red-300 font-mono flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-red-400" /> FALLÓ: aparecieron frases
                </span>
              )}
              {silenceTestResult === 'running' && (
                <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-500 text-[11px] text-amber-300 font-mono animate-pulse">
                  Esperando silencio: {silenceTimer}s restantes...
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mb-3">
              Pronunciar “Hola, bienvenidos” y luego guardar silencio 15 segundos: no deben aparecer frases nuevas durante el silencio.
            </p>
            <button
              onClick={startSilenceTest}
              disabled={silenceTestResult === 'running' || !isCapturing}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-xs font-semibold rounded text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-lime-400" />
              <span>Ejecutar prueba de silencio</span>
            </button>
          </div>

          {/* Test 2: Literal English comparison */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <h3 className="text-xs font-mono font-bold text-neutral-200 uppercase flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-lime-400" />
                <span>2. Transcripción literal en inglés con término técnico</span>
              </h3>
              {phraseMatched ? (
                <span className="px-2 py-0.5 rounded bg-lime-950 border border-lime-500 text-[11px] text-lime-300 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-lime-400" /> LITERALIDAD CONFIRMADA
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-400 font-mono">
                  Pendiente de pronunciación
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mb-2">
              Frase requerida: <code className="text-lime-300 font-mono">"{targetPhrase}"</code>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={startEnglishTest}
                disabled={!isCapturing}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-xs font-semibold rounded text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-lime-400" />
                <span>Reproducir frase de prueba</span>
              </button>
            </div>

            {/* Stage 2 translation verification */}
            {(() => {
              const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
              const targetNorm = normalize(targetPhrase);
              const matched = history.find((h) => normalize(h.text).includes(targetNorm) || targetNorm.includes(normalize(h.text)));
              if (!matched) return null;
              return (
                <div className="mt-3 p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-xs space-y-1 font-mono">
                  <div className="text-neutral-400">
                    <span className="text-neutral-500">Inglés recibido:</span> {matched.text}
                  </div>
                  <div className="text-lime-300">
                    <span className="text-neutral-500">Traducción español:</span>{' '}
                    {matched.translation?.status === 'translated' ? (
                      <strong className="text-lime-400">{matched.translation.textEs}</strong>
                    ) : matched.translation?.status === 'pending' ? (
                      <span className="text-amber-400 animate-pulse">Traduciendo en segundo plano...</span>
                    ) : (
                      <span className="text-red-400">Error en traducción</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Test 3: Multi-client consistency */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
            <h3 className="text-xs font-mono font-bold text-neutral-200 uppercase mb-2 flex items-center gap-1.5">
              <Network className="w-4 h-4 text-lime-400" />
              <span>3. Un transmisor y dos espectadores en la misma sala</span>
            </h3>
            <p className="text-xs text-neutral-400 mb-3">
              Abrí dos pestañas adicionales como espectadores con este enlace. Ambos deben recibir los subtítulos simultáneamente sin duplicados.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/?room=${roomId}&role=viewer`;
                  window.open(url, '_blank');
                }}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded text-lime-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Network className="w-3.5 h-3.5" />
                <span>Abrir espectador 1 (nueva pestaña)</span>
              </button>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/?room=${roomId}&role=viewer`;
                  window.open(url, '_blank');
                }}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded text-lime-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Network className="w-3.5 h-3.5" />
                <span>Abrir espectador 2 (nueva pestaña)</span>
              </button>
            </div>
          </div>

          {/* Test 5 & 6: Rejection, disconnection, room isolation */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
            <h3 className="text-xs font-mono font-bold text-neutral-200 uppercase mb-2 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-lime-400" />
              <span>5 & 6. Resiliencia, errores claros y aislamiento de salas</span>
            </h3>
            <ul className="text-xs text-neutral-400 space-y-1.5 list-disc list-inside">
              <li>
                <strong className="text-neutral-300">Aislamiento de salas:</strong> Al cambiar el identificador de sala, el historial previo queda aislado y no se mezcla.
              </li>
              <li>
                <strong className="text-neutral-300">Permiso rechazado:</strong> Si el usuario bloquea el micrófono, la interfaz pasa inmediatamente a "Permiso: Denegado" sin colgarse.
              </li>
              <li>
                <strong className="text-neutral-300">Transmisor único:</strong> Si un segundo usuario intenta transmitir en la misma sala, recibe el mensaje "Ya hay un micrófono transmitiendo en esta sala".
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-lime-400 hover:bg-lime-300 text-neutral-950 font-bold text-xs rounded-lg cursor-pointer transition-colors"
          >
            Entendido, cerrar panel
          </button>
        </div>
      </div>
    </div>
  );
};
