import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  Settings2,
  Copy,
  Check,
  Eye,
  Sparkles,
  Volume2,
  Monitor,
  Clock,
  Palette,
} from 'lucide-react';
import { TranscriptEntry, ViewLanguageMode } from '../types';

interface OverlayViewProps {
  roomId: string;
  talkTitle: string;
  currentInterim: string | null;
  history: TranscriptEntry[];
  broadcasterActive: boolean;
  onClose: () => void;
}

export type OverlayBgStyle = 'transparent' | 'chroma-green' | 'chroma-blue' | 'dark' | 'glass';
export type OverlayPosition = 'bottom' | 'top' | 'center';
export type OverlayFontSize = 'medium' | 'large' | 'xlarge' | 'giant';
export type OverlayFadeout = 3 | 6 | 10 | 0; // 0 = never

export const OverlayView: React.FC<OverlayViewProps> = ({
  roomId,
  talkTitle,
  currentInterim,
  history,
  broadcasterActive,
  onClose,
}) => {
  // Configurable options
  const [bgStyle, setBgStyle] = useState<OverlayBgStyle>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('bg') as OverlayBgStyle) || 'glass';
  });
  const [position, setPosition] = useState<OverlayPosition>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('pos') as OverlayPosition) || 'bottom';
  });
  const [fontSize, setFontSize] = useState<OverlayFontSize>('large');
  const [fadeoutSeconds, setFadeoutSeconds] = useState<OverlayFadeout>(6);
  const [langMode, setLangMode] = useState<ViewLanguageMode>('spanish');
  const [showControls, setShowControls] = useState<boolean>(true);
  const [copiedObsUrl, setCopiedObsUrl] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Auto-fadeout tracking
  const [isFadedOut, setIsFadedOut] = useState<boolean>(false);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const hideControlsTimerRef = useRef<any>(null);

  // Keep track of user activity in overlay to wake up
  useEffect(() => {
    lastActivityTimeRef.current = Date.now();
    setIsFadedOut(false);
  }, [currentInterim, history.length]);

  // Silence timer for fadeout
  useEffect(() => {
    if (fadeoutSeconds === 0) {
      setIsFadedOut(false);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - lastActivityTimeRef.current) / 1000;
      if (elapsed >= fadeoutSeconds && !isFadedOut) {
        setIsFadedOut(true);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [fadeoutSeconds, isFadedOut]);

  // Auto-hide controls bar after 4s of mouse inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    };
  }, []);

  // Keyboard shortcut: Esc to close, F to fullscreen, H to toggle controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
          setIsFullscreen(true);
        } else {
          document.exitFullscreen().catch(() => {});
          setIsFullscreen(false);
        }
      } else if (e.key === 'h' || e.key === 'H') {
        setShowControls((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const copyObsUrl = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('room', roomId);
    url.searchParams.set('overlay', '1');
    url.searchParams.set('bg', bgStyle);
    url.searchParams.set('pos', position);
    navigator.clipboard.writeText(url.toString());
    setCopiedObsUrl(true);
    setTimeout(() => setCopiedObsUrl(false), 2500);
  };

  // Background styling classes
  const getBgClass = () => {
    switch (bgStyle) {
      case 'transparent':
        return 'bg-transparent';
      case 'chroma-green':
        return 'bg-[#00FF00]';
      case 'chroma-blue':
        return 'bg-[#0000FF]';
      case 'dark':
        return 'bg-[#0a0a0a]';
      case 'glass':
      default:
        return 'bg-gradient-to-t from-neutral-950/90 via-neutral-950/60 to-transparent';
    }
  };

  // Position classes
  const getPositionClass = () => {
    switch (position) {
      case 'top':
        return 'justify-start pt-10';
      case 'center':
        return 'justify-center py-10';
      case 'bottom':
      default:
        return 'justify-end pb-12';
    }
  };

  // Font size classes
  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'medium':
        return 'text-2xl sm:text-3xl leading-relaxed';
      case 'xlarge':
        return 'text-4xl sm:text-5xl leading-tight font-extrabold';
      case 'giant':
        return 'text-5xl sm:text-6xl leading-tight font-black';
      case 'large':
      default:
        return 'text-3xl sm:text-4xl leading-snug font-bold';
    }
  };

  // Last 2 completed entries + current interim
  const recentEntries = history.slice(-2);
  const hasContent = recentEntries.length > 0 || !!currentInterim;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col select-none overflow-hidden transition-colors duration-300 ${getBgClass()}`}
    >
      {/* Top Floating Controls Bar */}
      <div
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <div className="bg-neutral-900/90 text-white backdrop-blur-xl border border-neutral-700/80 rounded-2xl px-4 py-2.5 shadow-2xl flex flex-wrap items-center gap-3 text-xs">
          {/* Nerdearla Badge */}
          <div className="flex items-center gap-1.5 font-black text-lime-400 font-mono tracking-wider pr-2 border-r border-neutral-700">
            <Monitor className="w-4 h-4 text-lime-400" />
            <span>OVERLAY OBS</span>
          </div>

          {/* Language Selector */}
          <div className="flex items-center bg-neutral-950 rounded-lg p-0.5 border border-neutral-800">
            <button
              onClick={() => setLangMode('spanish')}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                langMode === 'spanish' ? 'bg-lime-400 text-neutral-950' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Español
            </button>
            <button
              onClick={() => setLangMode('bilingual')}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                langMode === 'bilingual' ? 'bg-lime-400 text-neutral-950' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Bilingüe
            </button>
            <button
              onClick={() => setLangMode('original')}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                langMode === 'original' ? 'bg-lime-400 text-neutral-950' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Original
            </button>
          </div>

          {/* Background Selector */}
          <div className="flex items-center gap-1 pl-2 border-l border-neutral-800">
            <Palette className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={bgStyle}
              onChange={(e) => setBgStyle(e.target.value as OverlayBgStyle)}
              className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 outline-none cursor-pointer"
              title="Fondo de la vista overlay"
            >
              <option value="glass">Fondo Glass / Difuminado</option>
              <option value="transparent">Transparente (OBS Browser Source)</option>
              <option value="chroma-green">Chroma Verde (#00FF00)</option>
              <option value="chroma-blue">Chroma Azul (#0000FF)</option>
              <option value="dark">Negro Puro (Proyector)</option>
            </select>
          </div>

          {/* Position Selector */}
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as OverlayPosition)}
            className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 outline-none cursor-pointer"
            title="Posición de los subtítulos"
          >
            <option value="bottom">Inferior (Lower Third)</option>
            <option value="center">Centro de Pantalla</option>
            <option value="top">Superior (Banner)</option>
          </select>

          {/* Font Size Selector */}
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value as OverlayFontSize)}
            className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 outline-none cursor-pointer"
            title="Tamaño de tipografía"
          >
            <option value="medium">Fuente Media</option>
            <option value="large">Fuente Grande</option>
            <option value="xlarge">Fuente Extra Grande</option>
            <option value="giant">Fuente Gigante</option>
          </select>

          {/* Auto-Fadeout Selector */}
          <div className="flex items-center gap-1 pl-2 border-l border-neutral-800">
            <Clock className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={fadeoutSeconds}
              onChange={(e) => setFadeoutSeconds(Number(e.target.value) as OverlayFadeout)}
              className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 outline-none cursor-pointer"
              title="Auto-ocultar tras silencio"
            >
              <option value={3}>Fade out 3s</option>
              <option value={6}>Fade out 6s</option>
              <option value={10}>Fade out 10s</option>
              <option value={0}>Siempre visible</option>
            </select>
          </div>

          {/* Copy OBS Browser URL */}
          <button
            onClick={copyObsUrl}
            className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded font-medium cursor-pointer transition-colors border border-neutral-700"
            title="Copiar URL directa para pegar como Browser Source en OBS"
          >
            {copiedObsUrl ? (
              <>
                <Check className="w-3.5 h-3.5 text-lime-400" />
                <span className="text-lime-300 font-mono">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-neutral-400" />
                <span>Copiar Link OBS</span>
              </>
            )}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-neutral-800 text-neutral-300 rounded cursor-pointer transition-colors"
            title="Pantalla completa (Tecla F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Overlay */}
          <button
            onClick={onClose}
            className="p-1.5 bg-neutral-800 hover:bg-red-900/60 text-neutral-300 hover:text-white rounded cursor-pointer transition-colors"
            title="Cerrar modo Overlay (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Broadcast Subtitle Area */}
      <div className={`flex-1 flex flex-col px-8 sm:px-16 md:px-24 max-w-6xl mx-auto w-full ${getPositionClass()}`}>
        <div
          className={`transition-all duration-700 ${
            isFadedOut ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'
          }`}
        >
          {/* Card container if glass style is selected */}
          <div
            className={`p-6 sm:p-8 rounded-3xl transition-all ${
              bgStyle === 'glass'
                ? 'bg-neutral-950/80 backdrop-blur-xl border border-neutral-800/80 shadow-[0_10px_40px_rgba(0,0,0,0.8)]'
                : ''
            }`}
          >
            {/* Header info badge (talk title + live status) */}
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-lime-400 animate-pulse" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-lime-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {talkTitle}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">#{roomId}</span>
            </div>

            {/* Captions Display */}
            {!hasContent ? (
              <div className="text-neutral-400 italic text-xl font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                Esperando orador... Los subtítulos aparecerán aquí en vivo.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Last final entry */}
                {recentEntries.map((entry) => {
                  const isSpanishNative =
                    entry.translation?.status === 'none' || entry.languageCode.startsWith('es');
                  const spanishText = entry.translation?.textEs || (isSpanishNative ? entry.text : '');

                  return (
                    <div key={entry.id} className="transition-opacity">
                      {langMode === 'spanish' && (
                        <p
                          className={`text-white tracking-wide ${getFontSizeClass()} drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)] [text-shadow:_0_2px_12px_rgba(0,0,0,1),_0_0_3px_rgba(0,0,0,1)]`}
                        >
                          {spanishText || entry.text}
                        </p>
                      )}

                      {langMode === 'original' && (
                        <p
                          className={`text-white tracking-wide ${getFontSizeClass()} drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)] [text-shadow:_0_2px_12px_rgba(0,0,0,1),_0_0_3px_rgba(0,0,0,1)]`}
                        >
                          {entry.text}
                        </p>
                      )}

                      {langMode === 'bilingual' && (
                        <div className="flex flex-col gap-1.5">
                          <p
                            className={`text-lime-300 tracking-wide ${getFontSizeClass()} drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)] [text-shadow:_0_2px_12px_rgba(0,0,0,1),_0_0_3px_rgba(0,0,0,1)]`}
                          >
                            {spanishText || entry.text}
                          </p>
                          <p className="text-neutral-300 text-lg sm:text-xl font-medium tracking-wide [text-shadow:_0_1px_6px_rgba(0,0,0,1)]">
                            {entry.text}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Interim Live Stream typing */}
                {currentInterim && (
                  <div className="flex items-center gap-2 pt-1 border-t border-neutral-700/50">
                    <span className="w-2 h-2 rounded-full bg-lime-400 animate-ping inline-block" />
                    <p
                      className={`text-lime-400/90 italic tracking-wide ${getFontSizeClass()} [text-shadow:_0_2px_10px_rgba(0,0,0,1)]`}
                    >
                      {currentInterim}
                      <span className="animate-pulse">_</span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Re-open controls pill when auto-hidden */}
      {!showControls && (
        <button
          onClick={() => setShowControls(true)}
          className="fixed bottom-4 right-4 z-50 p-2.5 rounded-full bg-neutral-900/80 text-neutral-400 hover:text-white backdrop-blur border border-neutral-700 shadow-lg cursor-pointer transition-all hover:scale-110"
          title="Mostrar controles del overlay (Tecla H)"
        >
          <Settings2 className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
