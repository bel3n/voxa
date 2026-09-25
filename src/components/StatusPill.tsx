import React from 'react';
import { MicPermissionState, CaptureState, ConnectionState, TranscriptionState } from '../types';
import { ShieldCheck, ShieldAlert, Mic, MicOff, Wifi, WifiOff, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react';

interface StatusPillProps {
  micPermission: MicPermissionState;
  captureState: CaptureState;
  connectionState: ConnectionState;
  transcriptionState: TranscriptionState;
  geminiError?: string | null;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  micPermission,
  captureState,
  connectionState,
  transcriptionState,
  geminiError,
}) => {
  // Permission badge
  const permissionBadge = (() => {
    switch (micPermission) {
      case 'granted':
        return {
          icon: <ShieldCheck className="w-3.5 h-3.5 text-lime-400" />,
          label: 'Permiso: Concedido',
          style: 'bg-lime-950/60 border-lime-500/30 text-lime-300',
        };
      case 'denied':
        return {
          icon: <ShieldAlert className="w-3.5 h-3.5 text-red-400" />,
          label: 'Permiso: Denegado',
          style: 'bg-red-950/60 border-red-500/30 text-red-300',
        };
      default:
        return {
          icon: <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />,
          label: 'Permiso: Pendiente',
          style: 'bg-neutral-900 border-neutral-700 text-neutral-400',
        };
    }
  })();

  // Capture badge
  const captureBadge = (() => {
    switch (captureState) {
      case 'capturing':
        return {
          icon: <Mic className="w-3.5 h-3.5 text-lime-400 animate-pulse" />,
          label: 'Captura: Activa',
          style: 'bg-lime-950/70 border-lime-400/40 text-lime-300 shadow-sm shadow-lime-500/20',
        };
      case 'muted':
        return {
          icon: <MicOff className="w-3.5 h-3.5 text-amber-400" />,
          label: 'Captura: Silenciada',
          style: 'bg-amber-950/60 border-amber-500/30 text-amber-300',
        };
      default:
        return {
          icon: <MicOff className="w-3.5 h-3.5 text-neutral-500" />,
          label: 'Captura: Inactiva',
          style: 'bg-neutral-900 border-neutral-800 text-neutral-400',
        };
    }
  })();

  // Connection badge
  const connectionBadge = (() => {
    switch (connectionState) {
      case 'connected':
        return {
          icon: <Wifi className="w-3.5 h-3.5 text-lime-400" />,
          label: 'Servidor: Conectado',
          style: 'bg-lime-950/60 border-lime-500/30 text-lime-300',
        };
      case 'connecting':
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
          label: 'Servidor: Conectando',
          style: 'bg-blue-950/60 border-blue-500/30 text-blue-300',
        };
      case 'reconnecting':
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />,
          label: 'Servidor: Reconectando',
          style: 'bg-amber-950/60 border-amber-500/30 text-amber-300',
        };
      case 'error':
        return {
          icon: <WifiOff className="w-3.5 h-3.5 text-red-400" />,
          label: 'Servidor: Error',
          style: 'bg-red-950/60 border-red-500/30 text-red-300',
        };
      default:
        return {
          icon: <WifiOff className="w-3.5 h-3.5 text-neutral-500" />,
          label: 'Servidor: Desconectado',
          style: 'bg-neutral-900 border-neutral-800 text-neutral-400',
        };
    }
  })();

  // Transcription badge
  const transcriptionBadge = (() => {
    switch (transcriptionState) {
      case 'listening':
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-lime-400" />,
          label: 'Gemini Live: Escuchando',
          style: 'bg-lime-950/80 border-lime-400/50 text-lime-300 ring-1 ring-lime-400/20',
        };
      case 'connecting':
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />,
          label: 'Gemini Live: Inicializando...',
          style: 'bg-amber-950/60 border-amber-500/40 text-amber-300',
        };
      case 'error':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />,
          label: 'Gemini Live: Error de proveedor',
          style: 'bg-red-950/70 border-red-500/40 text-red-300',
        };
      default:
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-neutral-500" />,
          label: 'Gemini Live: En espera',
          style: 'bg-neutral-900 border-neutral-800 text-neutral-400',
        };
    }
  })();

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${permissionBadge.style}`}>
        {permissionBadge.icon}
        <span>{permissionBadge.label}</span>
      </div>

      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${captureBadge.style}`}>
        {captureBadge.icon}
        <span>{captureBadge.label}</span>
      </div>

      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${connectionBadge.style}`}>
        {connectionBadge.icon}
        <span>{connectionBadge.label}</span>
      </div>

      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${transcriptionBadge.style}`}
        title={geminiError || undefined}
      >
        {transcriptionBadge.icon}
        <span>{transcriptionBadge.label}</span>
      </div>
    </div>
  );
};
