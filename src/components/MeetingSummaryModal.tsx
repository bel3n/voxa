import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Download,
  Copy,
  Check,
  RefreshCw,
  FileText,
  AlertCircle,
  Clock,
  ListOrdered,
  BookOpen,
  Award,
} from 'lucide-react';
import { TranscriptEntry } from '../types';

interface MeetingSummaryModalProps {
  roomId: string;
  talkTitle: string;
  history: TranscriptEntry[];
  glossary: string[];
  isOpen: boolean;
  onClose: () => void;
}

export const MeetingSummaryModal: React.FC<MeetingSummaryModalProps> = ({
  roomId,
  talkTitle,
  history,
  glossary,
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [summaryMarkdown, setSummaryMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-generate if opened and no summary exists yet
  useEffect(() => {
    if (isOpen && !summaryMarkdown && !loading && history.length > 0) {
      handleGenerate();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (history.length === 0) {
      setError('Aún no hay subtítulos acumulados. Hable al micrófono o reproduzca una prueba antes de generar la minuta.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${roomId}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: talkTitle,
          transcript: history,
          glossary,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al comunicarse con el servicio de resumen');
      }

      setSummaryMarkdown(data.summary);
    } catch (err: any) {
      setError(err?.message || 'Error inesperado al generar la minuta con IA');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!summaryMarkdown) return;
    navigator.clipboard.writeText(summaryMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (format: 'md' | 'txt') => {
    if (!summaryMarkdown) return;
    const blob = new Blob([summaryMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanTitle = (talkTitle || 'charla').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    a.download = `minuta-${cleanTitle}-${roomId}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-lime-400/10 text-lime-400 border border-lime-400/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Minuta Ejecutiva de la Charla (IA)</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-lime-400 border border-neutral-700">
                  {history.length} fragmentos
                </span>
              </div>
              <p className="text-xs text-neutral-400 truncate max-w-md">
                {talkTitle} — Resumen, Key Takeaways y Stack Tecnológico
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {history.length === 0 && (
            <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-5 text-center text-sm text-amber-300">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-amber-400" />
              <p className="font-semibold">No hay subtítulos en el historial</p>
              <p className="text-xs text-amber-400/80 mt-1">
                Para generar la minuta, iniciá la transmisión con el micrófono o ejecutá una simulación en el Banco de Validación.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-950/40 border border-red-800/80 rounded-xl p-4 text-xs text-red-300 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">No se pudo generar la minuta</p>
                <p className="text-red-400/90 mt-0.5">{error}</p>
                <button
                  onClick={handleGenerate}
                  className="mt-2 text-xs font-semibold text-lime-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reintentar generación</span>
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-lime-400/30 border-t-lime-400 animate-spin" />
                <Sparkles className="w-5 h-5 text-lime-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  Generando Minuta Ejecutiva con Gemini...
                </p>
                <p className="text-xs text-neutral-400 max-w-sm">
                  Sintetizando {history.length} fragmentos transcritos, extrayendo puntos clave y estructurando conclusiones.
                </p>
              </div>
            </div>
          )}

          {!loading && summaryMarkdown && (
            <div className="space-y-4">
              {/* Formatted Markdown Box */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 text-sm text-neutral-200 leading-relaxed font-sans whitespace-pre-line selection:bg-lime-400 selection:text-black">
                {summaryMarkdown}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3 bg-neutral-950/60">
          <div className="flex items-center gap-2">
            {summaryMarkdown && (
              <>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
                  title="Copiar contenido en formato Markdown"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-lime-400" />
                      <span className="text-lime-300 font-mono">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Copiar Markdown</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleDownload('md')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
                  title="Descargar archivo .md"
                >
                  <Download className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Descargar .MD</span>
                </button>
              </>
            )}

            {history.length > 0 && (
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                title="Regenerar resumen a partir de la transcripción actual"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{summaryMarkdown ? 'Regenerar' : 'Generar Minuta'}</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-lime-400 hover:bg-lime-300 text-neutral-950 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-md shadow-lime-400/20"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
