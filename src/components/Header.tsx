import React from 'react';
import { Mic, Eye, Radio, Users, CheckCircle2, Monitor, BookOpen, Sparkles } from 'lucide-react';

interface HeaderProps {
  currentRoomId: string;
  role: 'broadcaster' | 'viewer';
  viewersCount: number;
  broadcasterActive: boolean;
  glossaryCount: number;
  onRoleChange: (newRole: 'broadcaster' | 'viewer') => void;
  showValidationModal: () => void;
  onOpenOverlay: () => void;
  onOpenGlossary: () => void;
  onOpenSummary: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRoomId,
  role,
  viewersCount,
  broadcasterActive,
  glossaryCount,
  onRoleChange,
  showValidationModal,
  onOpenOverlay,
  onOpenGlossary,
  onOpenSummary,
}) => {
  return (
    <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand & Room Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-lime-400 text-black px-2.5 py-1 rounded font-black tracking-wider text-sm shadow-md shadow-lime-400/20">
            <Radio className="w-4 h-4 animate-pulse text-black" />
            <span>NERDEARLA</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-base tracking-tight">Live Captions</span>
              <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-lime-400 font-mono border border-neutral-700">
                #{currentRoomId}
              </span>
            </div>
            <span className="text-xs text-neutral-400 hidden sm:inline">
              Transcripción en vivo con Gemini Live y traducción desacoplada al español
            </span>
          </div>
        </div>

        {/* Status Indicators & Action Tools */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Overlay OBS / Projector button */}
          <button
            onClick={onOpenOverlay}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold text-neutral-200 hover:text-white transition-all cursor-pointer shadow-sm"
            title="Abrir modo Overlay para OBS / vMix / Proyector de auditorio"
          >
            <Monitor className="w-3.5 h-3.5 text-sky-400" />
            <span>Modo Overlay / OBS</span>
          </button>

          {/* Dynamic Glossary modal button */}
          <button
            onClick={onOpenGlossary}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold text-neutral-200 hover:text-white transition-all cursor-pointer shadow-sm"
            title="Abrir editor dinámico de glosario técnico"
          >
            <BookOpen className="w-3.5 h-3.5 text-lime-400" />
            <span>Glosario ({glossaryCount})</span>
          </button>

          {/* AI Meeting Summary button */}
          <button
            onClick={onOpenSummary}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-lime-500/40 bg-lime-400/10 hover:bg-lime-400/20 text-xs font-semibold text-lime-300 transition-all cursor-pointer shadow-sm"
            title="Generar minuta ejecutiva y resumen estructurado con IA"
          >
            <Sparkles className="w-3.5 h-3.5 text-lime-400" />
            <span>Minuta IA</span>
          </button>

          {/* Broadcaster on air status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                broadcasterActive ? 'bg-lime-400 animate-ping' : 'bg-neutral-600'
              }`}
            />
            <span className={broadcasterActive ? 'text-lime-300' : 'text-neutral-500'}>
              {broadcasterActive ? 'En vivo' : 'Espera'}
            </span>
          </div>

          {/* Viewers counter */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-300">
            <Users className="w-3.5 h-3.5 text-neutral-400" />
            <span>{viewersCount}</span>
          </div>

          {/* Validation bench button */}
          <button
            onClick={showValidationModal}
            className="flex items-center gap-1.5 px-2 py-1 rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-xs font-medium text-neutral-300 transition-colors cursor-pointer"
            title="Abrir panel de validación técnica de latencias y test"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-lime-400" />
            <span className="hidden lg:inline">Validar</span>
          </button>

          {/* Role selector tab buttons */}
          <div className="flex items-center bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
            <button
              onClick={() => onRoleChange('broadcaster')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                role === 'broadcaster'
                  ? 'bg-lime-400 text-neutral-950 shadow-sm shadow-lime-400/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Mic className="w-3 h-3" />
              <span>Mic</span>
            </button>
            <button
              onClick={() => onRoleChange('viewer')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                role === 'viewer'
                  ? 'bg-lime-400 text-neutral-950 shadow-sm shadow-lime-400/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Viewer</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
