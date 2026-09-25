import React, { useState, useEffect, useRef } from 'react';
import { Download, Trash2, ArrowDown, Type, Maximize2, Minimize2, Sparkles, Languages, Loader2, AlertCircle, Check, RefreshCw, Monitor, FileText } from 'lucide-react';
import { TranscriptEntry, ViewLanguageMode } from '../types';

interface CaptionsViewerProps {
  currentInterim: string | null;
  history: TranscriptEntry[];
  talkTitle: string;
  roomId: string;
  isBroadcaster: boolean;
  onClearHistory?: () => void;
  onRetryTranslation?: (entryId: string) => void;
  onOpenOverlay?: () => void;
  onOpenSummary?: () => void;
}

export const CaptionsViewer: React.FC<CaptionsViewerProps> = ({
  currentInterim,
  history,
  talkTitle,
  roomId,
  isBroadcaster,
  onClearHistory,
  onRetryTranslation,
  onOpenOverlay,
  onOpenSummary,
}) => {
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'huge'>('large');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewLanguageMode>('spanish');
  const historyContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new captions arrive
  useEffect(() => {
    if (autoScroll && historyContainerRef.current) {
      historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
    }
  }, [history, currentInterim, autoScroll]);

  // Handle download TXT (Original vs Español)
  const handleDownloadTxt = (exportLanguage: 'original' | 'spanish') => {
    if (history.length === 0) {
      alert('No hay subtítulos finales en el historial para descargar todavía.');
      return;
    }

    const dateStr = new Date().toLocaleString('es-AR');
    let content = `=======================================================\n`;
    content += `NERDEARLA LIVE CAPTIONS - TRANSCRIPCIÓN OFICIAL\n`;
    content += `=======================================================\n`;
    content += `Sala: ${roomId}\n`;
    content += `Charla: ${talkTitle}\n`;
    content += `Fecha de exportación: ${dateStr}\n`;
    content += `Modalidad: ${exportLanguage === 'spanish' ? 'Traducción al Español (ES)' : 'Transcripción Original (Literal)'}\n`;
    content += `Cantidad de intervenciones: ${history.length}\n`;

    if (exportLanguage === 'spanish') {
      const translatedCount = history.filter(
        (h) => h.translation?.status === 'translated' || h.translation?.status === 'none'
      ).length;
      const pendingCount = history.filter((h) => h.translation?.status === 'pending').length;
      const failedCount = history.filter((h) => h.translation?.status === 'failed').length;

      content += `Completadas en español: ${translatedCount}\n`;
      content += `Pendientes de traducción: ${pendingCount}\n`;
      content += `Fallidas: ${failedCount}\n`;
      content += `Nota: Las traducciones no completadas se indican explícitamente y no se simulan como completas.\n`;
    }

    content += `Proveedor: Gemini Live (gemini-3.5-transcribe-live) + Gemini (gemini-3.8-flash)\n`;
    content += `=======================================================\n\n`;

    history.forEach((entry) => {
      const time = new Date(entry.timestamp).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const speaker = entry.speaker ? ` [${entry.speaker}]` : '';

      if (exportLanguage === 'original') {
        const lang = entry.languageCode && entry.languageCode !== 'auto' ? ` [${entry.languageCode.toUpperCase()}]` : '';
        content += `[${time}]${lang}${speaker}: ${entry.text}\n`;
      } else {
        // Export in Spanish
        if (entry.translation?.status === 'translated') {
          content += `[${time}] [ES]${speaker}: ${entry.translation.textEs}\n`;
        } else if (entry.translation?.status === 'none' || entry.languageCode?.toLowerCase().startsWith('es')) {
          content += `[${time}] [ES]${speaker}: ${entry.text}\n`;
        } else if (entry.translation?.status === 'pending') {
          content += `[${time}] [PENDIENTE]${speaker}: [Original: ${entry.text}] (Traducción al español pendiente al momento de exportar)\n`;
        } else {
          content += `[${time}] [FALLIDA]${speaker}: [Original: ${entry.text}] (Error en traducción al español: ${entry.translation?.error || 'fallida'})\n`;
        }
      }
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcripcion-${roomId}-${exportLanguage}-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Font size classes for interim and history
  const interimFontClass = (() => {
    switch (fontSize) {
      case 'huge':
        return 'text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight';
      case 'large':
        return 'text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight';
      default:
        return 'text-xl sm:text-2xl font-bold';
    }
  })();

  const historyFontClass = (() => {
    switch (fontSize) {
      case 'huge':
        return 'text-2xl sm:text-3xl';
      case 'large':
        return 'text-lg sm:text-xl';
      default:
        return 'text-base';
    }
  })();

  return (
    <div
      className={`flex flex-col bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none bg-neutral-950 p-6' : 'min-h-[560px]'
      }`}
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-neutral-800/80 bg-neutral-950/60">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-lime-400 shadow-sm shadow-lime-400" />
          <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wider">
            Pantalla de Subtítulos en Vivo
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Language Mode Selector (Original / Español / Bilingüe) */}
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-1 text-xs">
            <Languages className="w-3.5 h-3.5 text-lime-400 ml-1 mr-1.5" />
            <button
              onClick={() => setViewMode('original')}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                viewMode === 'original' ? 'bg-lime-400 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
              }`}
              title="Mostrar transcripción literal original"
            >
              Original
            </button>
            <button
              onClick={() => setViewMode('spanish')}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                viewMode === 'spanish' ? 'bg-lime-400 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
              }`}
              title="Mostrar traducción al español (inglés traducido al español)"
            >
              Español
            </button>
            <button
              onClick={() => setViewMode('bilingual')}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                viewMode === 'bilingual' ? 'bg-lime-400 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
              }`}
              title="Mostrar ambos idiomas simultáneamente (Original y Español)"
            >
              Bilingüe
            </button>
          </div>

          {/* Font Size Selector */}
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-1 text-xs">
            <Type className="w-3.5 h-3.5 text-neutral-400 ml-1 mr-1.5" />
            <button
              onClick={() => setFontSize('normal')}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                fontSize === 'normal' ? 'bg-neutral-800 text-lime-400 font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Normal
            </button>
            <button
              onClick={() => setFontSize('large')}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                fontSize === 'large' ? 'bg-neutral-800 text-lime-400 font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Grande
            </button>
            <button
              onClick={() => setFontSize('huge')}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                fontSize === 'huge' ? 'bg-neutral-800 text-lime-400 font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Proyector
            </button>
          </div>

          {/* Auto Scroll Toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
              autoScroll
                ? 'bg-lime-950/60 border-lime-500/40 text-lime-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
            title="Desplazamiento automático hacia la última frase"
          >
            <ArrowDown className={`w-3.5 h-3.5 ${autoScroll ? 'text-lime-400' : 'text-neutral-400'}`} />
            <span className="hidden sm:inline">Auto-scroll</span>
          </button>

          {/* Download TXT Buttons (Original and Spanish) */}
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => handleDownloadTxt('spanish')}
              disabled={history.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 bg-lime-400 hover:bg-lime-300 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-950 font-bold rounded cursor-pointer transition-colors shadow-sm shadow-lime-400/20"
              title="Descargar subtítulos traducidos al español en formato .TXT"
            >
              <Download className="w-3.5 h-3.5 text-neutral-950" />
              <span>TXT Español</span>
            </button>
            <button
              onClick={() => handleDownloadTxt('original')}
              disabled={history.length === 0}
              className="flex items-center gap-1 px-2 py-1 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-300 hover:text-white font-medium rounded cursor-pointer transition-colors"
              title="Descargar transcripción original literal en formato .TXT"
            >
              <span>TXT Original</span>
            </button>
          </div>

          {/* AI Minutes button */}
          {onOpenSummary && (
            <button
              onClick={onOpenSummary}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-lime-500/40 bg-lime-400/10 hover:bg-lime-400/20 text-xs font-semibold text-lime-300 transition-colors cursor-pointer"
              title="Generar minuta ejecutiva estructurada con IA"
            >
              <Sparkles className="w-3.5 h-3.5 text-lime-400" />
              <span className="hidden sm:inline">Minuta IA</span>
            </button>
          )}

          {/* Overlay OBS shortcut button */}
          {onOpenOverlay && (
            <button
              onClick={onOpenOverlay}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-xs font-medium text-neutral-200 transition-colors cursor-pointer"
              title="Abrir vista de subtítulos para streaming OBS / vMix"
            >
              <Monitor className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Overlay OBS</span>
            </button>
          )}

          {/* Clear History (broadcaster only) */}
          {isBroadcaster && onClearHistory && (
            <button
              onClick={onClearHistory}
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-red-950/60 hover:text-red-400 border border-neutral-800 text-neutral-400 transition-colors cursor-pointer"
              title="Limpiar historial de subtítulos"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition-colors cursor-pointer"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Modo pantalla completa (Proyector)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Prominent Live Subtitle Box (interimInputTranscription) */}
      <div className="p-6 sm:p-8 bg-gradient-to-b from-neutral-950 to-neutral-900/90 border-b border-neutral-800/80 min-h-[160px] flex flex-col justify-center">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-400"></span>
            </span>
            <span className="text-lime-400 font-bold uppercase tracking-wider">Subtítulo provisional en vivo</span>
            <span className="text-neutral-500 text-[11px]">(reemplazo continuo)</span>
          </div>
          <span className="text-xs font-mono text-neutral-400 px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800">
            Vista: <strong className="text-lime-300 uppercase">{viewMode}</strong>
          </span>
        </div>

        {currentInterim ? (
          <div className={`${interimFontClass} text-white font-sans leading-tight transition-all duration-75`}>
            <span className="text-white drop-shadow-md">{currentInterim}</span>
            <span className="inline-block w-2.5 h-6 bg-lime-400 ml-2 animate-pulse align-middle rounded-xs" />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-neutral-500 italic text-base">
            <Sparkles className="w-4 h-4 text-neutral-600 animate-pulse" />
            <span>Esperando audio del orador... Hablá al micrófono para transcribir y traducir en vivo.</span>
          </div>
        )}
      </div>

      {/* Final Captions History */}
      <div className="flex-1 flex flex-col p-5 overflow-hidden">
        <div className="flex items-center justify-between mb-3 text-xs font-mono text-neutral-400 border-b border-neutral-800/60 pb-2">
          <span>HISTORIAL DE SUBTÍTULOS ({history.length} fragmentos confirmados)</span>
          <span className="text-lime-400/90">
            {viewMode === 'spanish'
              ? 'TRADUCCIÓN EN TIEMPO REAL AL ESPAÑOL'
              : viewMode === 'bilingual'
              ? 'VISTA BILINGÜE (ORIGINAL + ESPAÑOL)'
              : 'TRANSCRIPCIÓN ORIGINAL LITERAL'}
          </span>
        </div>

        <div
          ref={historyContainerRef}
          className="flex-1 overflow-y-auto space-y-3.5 pr-2 scroll-smooth max-h-[380px]"
        >
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-neutral-500 text-sm">
              <p>El historial de subtítulos confirmados y traducidos se acumulará acá a medida que el orador hable.</p>
              <p className="text-xs text-neutral-600 mt-1 font-mono">
                La traducción se procesa de forma desacoplada para garantizar que el audio nunca se interrumpa.
              </p>
            </div>
          ) : (
            history.map((entry, index) => {
              const time = new Date(entry.timestamp).toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              const isTranslated = entry.translation?.status === 'translated' && !!entry.translation.textEs;
              const isPending = entry.translation?.status === 'pending';
              const isFailed = entry.translation?.status === 'failed';
              const isNativeSpanish = entry.translation?.status === 'none' || entry.languageCode?.toLowerCase().startsWith('es');

              return (
                <div
                  key={entry.id || index}
                  className="group flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4 p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800/60 hover:border-lime-500/30 transition-all"
                >
                  {/* Meta column */}
                  <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-500 shrink-0">
                    <span className="text-lime-400/80 font-bold">#{entry.order}</span>
                    <span>{time}</span>

                    {/* Translation status indicator badges */}
                    {isTranslated && (
                      <span className="px-1.5 py-0.5 rounded bg-lime-950/80 border border-lime-500/40 text-[10px] text-lime-300 font-semibold flex items-center gap-1">
                        <Check className="w-2.5 h-2.5 text-lime-400" />
                        <span>ES</span>
                      </span>
                    )}

                    {isNativeSpanish && !isTranslated && (
                      <span className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-300 font-semibold">
                        ES
                      </span>
                    )}

                    {isPending && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-[10px] text-amber-300 flex items-center gap-1 animate-pulse">
                        <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400" />
                        <span>Traduciendo...</span>
                      </span>
                    )}

                    {isFailed && (
                      <span className="px-1.5 py-0.5 rounded bg-red-950/80 border border-red-500/40 text-[10px] text-red-300 flex items-center gap-1">
                        <AlertCircle className="w-2.5 h-2.5 text-red-400" />
                        <span>Falló</span>
                      </span>
                    )}
                  </div>

                  {/* Caption Content Area */}
                  <div className="flex-1 font-sans leading-relaxed">
                    {/* View mode: ORIGINAL */}
                    {viewMode === 'original' && (
                      <div className={`text-neutral-100 ${historyFontClass}`}>
                        {entry.text}
                      </div>
                    )}

                    {/* View mode: SPANISH */}
                    {viewMode === 'spanish' && (
                      <div>
                        {isTranslated ? (
                          <div className={`text-white font-medium ${historyFontClass}`}>
                            {entry.translation?.textEs}
                          </div>
                        ) : isNativeSpanish ? (
                          <div className={`text-white font-medium ${historyFontClass}`}>
                            {entry.text}
                          </div>
                        ) : isPending ? (
                          <div>
                            <div className="text-xs text-amber-400/90 font-mono mb-1 flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Traducción al español pendiente (conservando original visible):</span>
                            </div>
                            <div className={`text-neutral-300 italic ${historyFontClass}`}>
                              {entry.text}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <div className="text-xs text-red-400 font-mono flex items-center gap-1.5">
                                <AlertCircle className="w-3 h-3" />
                                <span>Traducción no disponible temporalmente (mostrando original):</span>
                              </div>
                              {onRetryTranslation && (
                                <button
                                  onClick={() => onRetryTranslation(entry.id)}
                                  className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] text-lime-400 font-mono flex items-center gap-1 cursor-pointer transition-colors border border-neutral-700"
                                  title="Reintentar traducir este fragmento con Gemini"
                                >
                                  <RefreshCw className="w-2.5 h-2.5" />
                                  <span>Reintentar</span>
                                </button>
                              )}
                            </div>
                            <div className={`text-neutral-300 ${historyFontClass}`}>
                              {entry.text}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* View mode: BILINGUAL */}
                    {viewMode === 'bilingual' && (
                      <div className="space-y-1.5">
                        {/* Original in muted tone */}
                        <div className="text-xs text-neutral-400 font-mono flex items-center gap-1">
                          <span className="text-neutral-500">ORIGINAL:</span>
                          <span>{entry.text}</span>
                        </div>

                        {/* Spanish in prominent lime color */}
                        <div className={`text-lime-300 font-semibold ${historyFontClass}`}>
                          {isTranslated ? (
                            entry.translation?.textEs
                          ) : isNativeSpanish ? (
                            entry.text
                          ) : isPending ? (
                            <span className="text-amber-400/90 italic flex items-center gap-1 text-sm font-normal">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Traduciendo al español en segundo plano...
                            </span>
                          ) : (
                            <span className="text-red-400 text-sm font-normal">
                              Traducción no disponible ({entry.translation?.error || 'error'})
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
