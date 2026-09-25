import React, { useState } from 'react';
import {
  X,
  Plus,
  BookOpen,
  Sparkles,
  Trash2,
  Download,
  Upload,
  Check,
  Search,
  Layers,
  Cpu,
  Database,
  Cloud,
} from 'lucide-react';

interface GlossaryModalProps {
  glossary: string[];
  talkTitle: string;
  isBroadcaster: boolean;
  isOpen: boolean;
  onClose: () => void;
  onUpdateGlossary: (newGlossary: string[]) => void;
}

export const GlossaryModal: React.FC<GlossaryModalProps> = ({
  glossary,
  talkTitle,
  isBroadcaster,
  isOpen,
  onClose,
  onUpdateGlossary,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newTermInput, setNewTermInput] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  if (!isOpen) return null;

  // Pre-configured packs for fast 1-click addition
  const presetPacks = [
    {
      name: 'Cloud Native & Infra',
      icon: <Cloud className="w-3.5 h-3.5 text-sky-400" />,
      terms: ['Kubernetes', 'Docker', 'Terraform', 'Helm', 'ArgoCD', 'eBPF', 'OpenTelemetry', 'Istio', 'Prometheus'],
    },
    {
      name: 'Backend & Bases de Datos',
      icon: <Database className="w-3.5 h-3.5 text-amber-400" />,
      terms: ['PostgreSQL', 'TypeScript', 'Node.js', 'Redis', 'Kafka', 'GraphQL', 'gRPC', 'Microservicios'],
    },
    {
      name: 'Inteligencia Artificial',
      icon: <Cpu className="w-3.5 h-3.5 text-purple-400" />,
      terms: ['Gemini', 'LLMs', 'RAG', 'PyTorch', 'Transformers', 'Embeddings', 'Fine-Tuning', 'VectorDB'],
    },
    {
      name: 'Nerdearla & Tech',
      icon: <Sparkles className="w-3.5 h-3.5 text-lime-400" />,
      terms: ['Nerdearla', 'Sysarmy', 'Keynote', 'Lightning Talk', 'DevOps Days', 'Open Source'],
    },
  ];

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTermInput.trim();
    if (!clean) return;
    if (!glossary.includes(clean)) {
      onUpdateGlossary([...glossary, clean]);
    }
    setNewTermInput('');
  };

  const handleRemove = (termToRemove: string) => {
    onUpdateGlossary(glossary.filter((t) => t !== termToRemove));
  };

  const handleAddPreset = (term: string) => {
    if (!glossary.includes(term)) {
      onUpdateGlossary([...glossary, term]);
    }
  };

  const handleAddPack = (terms: string[]) => {
    const set = new Set([...glossary, ...terms]);
    onUpdateGlossary(Array.from(set));
  };

  const handleBulkImport = () => {
    const raw = bulkInput
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (raw.length > 0) {
      const set = new Set([...glossary, ...raw]);
      onUpdateGlossary(Array.from(set));
      setBulkInput('');
      setShowBulkImport(false);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('¿Desea vaciar todos los términos del glosario?')) {
      onUpdateGlossary([]);
    }
  };

  const handleExport = () => {
    const text = glossary.join(', ');
    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  const filteredGlossary = glossary.filter((term) =>
    term.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-lime-400/10 text-lime-400 border border-lime-400/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Glosario Técnico Dinámico</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-lime-300 font-mono">
                  {glossary.length} términos
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Guía la transcripción y preserva nombres y términos verbatim en la traducción.
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
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Add term input */}
          <form onSubmit={handleAddSingle} className="flex gap-2">
            <input
              type="text"
              value={newTermInput}
              onChange={(e) => setNewTermInput(e.target.value)}
              placeholder="Escribí un nuevo término técnico (ej: Istio, WebAssembly, Kafka)..."
              className="flex-1 bg-neutral-950 border border-neutral-700 focus:border-lime-400 focus:ring-1 focus:ring-lime-400 rounded-xl px-4 py-2.5 text-sm text-white font-medium outline-none transition-all placeholder:text-neutral-500"
            />
            <button
              type="submit"
              disabled={!newTermInput.trim()}
              className="px-4 py-2.5 bg-lime-400 hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold rounded-xl text-sm flex items-center gap-1.5 transition-all shadow-md shadow-lime-400/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir</span>
            </button>
          </form>

          {/* Quick presets packs */}
          <div>
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-lime-400" />
              <span>Packs rápidos sugeridos para Nerdearla</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {presetPacks.map((pack) => (
                <div
                  key={pack.name}
                  className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-3 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
                      {pack.icon}
                      <span>{pack.name}</span>
                    </div>
                    <button
                      onClick={() => handleAddPack(pack.terms)}
                      className="text-[10px] text-lime-400 hover:text-lime-300 font-mono font-medium underline cursor-pointer"
                    >
                      + Sumar pack completo
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {pack.terms.slice(0, 5).map((t) => (
                      <button
                        key={t}
                        onClick={() => handleAddPreset(t)}
                        disabled={glossary.includes(t)}
                        className={`text-[10px] px-2 py-0.5 rounded transition-all cursor-pointer font-mono ${
                          glossary.includes(t)
                            ? 'bg-neutral-800 text-neutral-500 cursor-default'
                            : 'bg-neutral-900 hover:bg-lime-400/20 hover:text-lime-300 text-neutral-300 border border-neutral-800'
                        }`}
                      >
                        {glossary.includes(t) ? `✓ ${t}` : `+ ${t}`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Search & Active Terms List */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-lime-400" />
                <span>Términos actuales ({glossary.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBulkImport(!showBulkImport)}
                  className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3 h-3" />
                  <span>{showBulkImport ? 'Ocultar importador' : 'Importar en lote'}</span>
                </button>
                <button
                  onClick={handleExport}
                  className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedSuccess ? (
                    <Check className="w-3 h-3 text-lime-400" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  <span>{copiedSuccess ? 'Copiado' : 'Exportar lista'}</span>
                </button>
              </div>
            </div>

            {/* Bulk Import Drawer */}
            {showBulkImport && (
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 mb-3 space-y-2">
                <label className="text-xs text-neutral-400">
                  Pegá múltiples términos separados por comas o saltos de línea:
                </label>
                <textarea
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="Ejemplo: Ansible, Grafana, Jaeger, ClickHouse, RabbitMQ"
                  rows={3}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-xs text-white outline-none focus:border-lime-400 font-mono"
                />
                <button
                  onClick={handleBulkImport}
                  disabled={!bulkInput.trim()}
                  className="px-3 py-1.5 bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-neutral-950 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Procesar e importar
                </button>
              </div>
            )}

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-neutral-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar término en el glosario..."
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-neutral-700 rounded-xl pl-9 pr-4 py-2 text-xs text-neutral-200 outline-none"
              />
            </div>

            {/* Terms Badges List */}
            {filteredGlossary.length === 0 ? (
              <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-6 text-center text-xs text-neutral-500">
                {searchTerm ? 'No se encontraron términos que coincidan con la búsqueda.' : 'No hay términos en el glosario actualmente.'}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pr-1">
                {filteredGlossary.map((term) => (
                  <span
                    key={term}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-xs font-mono text-lime-300 group hover:border-neutral-700 transition-colors"
                  >
                    <span>{term}</span>
                    <button
                      onClick={() => handleRemove(term)}
                      className="text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                      title={`Eliminar "${term}"`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="text-[11px] text-neutral-500">
            Sincronizado en tiempo real con el servidor y todos los espectadores.
          </div>
          <div className="flex items-center gap-2">
            {glossary.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Vaciar glosario
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
