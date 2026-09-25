import React, { useState } from 'react';
import { Copy, Check, Hash, BookOpen, Presentation, Plus, X } from 'lucide-react';

interface RoomControlsProps {
  roomId: string;
  talkTitle: string;
  glossary: string[];
  role: 'broadcaster' | 'viewer';
  onRoomChange: (newRoomId: string) => void;
  onUpdateMeta: (newTitle: string, newGlossary: string[]) => void;
  onOpenGlossary?: () => void;
}

export const RoomControls: React.FC<RoomControlsProps> = ({
  roomId,
  talkTitle,
  glossary,
  role,
  onRoomChange,
  onUpdateMeta,
  onOpenGlossary,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [editableTitle, setEditableTitle] = useState(talkTitle);
  const [newGlossaryTerm, setNewGlossaryTerm] = useState('');
  const [roomInput, setRoomInput] = useState(roomId);

  const handleCopyShareLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    url.searchParams.set('role', 'viewer');
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddTerm = (e: React.FormEvent) => {
    e.preventDefault();
    const term = newGlossaryTerm.trim();
    if (term && !glossary.includes(term)) {
      const updated = [...glossary, term];
      onUpdateMeta(editableTitle, updated);
      setNewGlossaryTerm('');
    }
  };

  const handleRemoveTerm = (termToRemove: string) => {
    const updated = glossary.filter((t) => t !== termToRemove);
    onUpdateMeta(editableTitle, updated);
  };

  const handleSaveTitle = () => {
    if (editableTitle.trim()) {
      onUpdateMeta(editableTitle.trim(), glossary);
      setIsEditingMeta(false);
    }
  };

  const handleSwitchRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (clean && clean !== roomId) {
      onRoomChange(clean);
    }
  };

  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 sm:p-5 mb-6 backdrop-blur-sm">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Room selector & share */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Hash className="w-3.5 h-3.5 text-lime-400" />
            <span>Identificador de sala</span>
          </label>
          <div className="flex items-center gap-2">
            <form onSubmit={handleSwitchRoom} className="flex-1 flex gap-2">
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="Ej: sala-principal"
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-lime-400 focus:ring-1 focus:ring-lime-400 rounded-lg px-3 py-2 text-sm text-neutral-100 font-mono transition-colors outline-none"
              />
              {roomInput !== roomId && (
                <button
                  type="submit"
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer"
                >
                  Cambiar
                </button>
              )}
            </form>

            <button
              onClick={handleCopyShareLink}
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium rounded-lg text-neutral-200 transition-colors border border-neutral-700 whitespace-nowrap cursor-pointer"
              title="Copiar enlace directo de espectador"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-lime-400" />
                  <span className="text-lime-300">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Copiar link</span>
                </>
              )}
            </button>
          </div>
          <span className="text-[11px] text-neutral-500">
            Cada sala tiene su historial aislado y conexión independiente.
          </span>
        </div>

        {/* Talk Title */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Presentation className="w-3.5 h-3.5 text-lime-400" />
              <span>Nombre de la charla</span>
            </label>
            {role === 'broadcaster' && (
              <button
                onClick={() => {
                  if (isEditingMeta) handleSaveTitle();
                  else setIsEditingMeta(true);
                }}
                className="text-[11px] text-lime-400 hover:underline cursor-pointer"
              >
                {isEditingMeta ? 'Guardar' : 'Editar'}
              </button>
            )}
          </div>

          {isEditingMeta && role === 'broadcaster' ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={editableTitle}
                onChange={(e) => setEditableTitle(e.target.value)}
                className="w-full bg-neutral-950 border border-lime-500/50 rounded-lg px-3 py-2 text-sm text-white font-medium outline-none"
                placeholder="Nombre de la charla..."
              />
              <button
                onClick={handleSaveTitle}
                className="px-3 py-2 bg-lime-400 text-neutral-950 text-xs font-bold rounded-lg cursor-pointer hover:bg-lime-300"
              >
                OK
              </button>
            </div>
          ) : (
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 font-semibold truncate">
              {talkTitle || 'Charla sin título definido'}
            </div>
          )}
          <span className="text-[11px] text-neutral-500 truncate">
            {role === 'broadcaster' ? 'Sincronizado con todos los espectadores.' : 'Charla actual de la sala.'}
          </span>
        </div>

        {/* Technical Glossary */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5 uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5 text-lime-400" />
              <span>Glosario técnico ({glossary.length})</span>
            </label>
            {onOpenGlossary && (
              <button
                onClick={onOpenGlossary}
                className="text-[11px] text-lime-400 hover:underline cursor-pointer font-medium"
              >
                Packs y edición ➔
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-[72px] overflow-y-auto pr-1">
            {glossary.map((term) => (
              <span
                key={term}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-[11px] font-mono text-lime-300"
              >
                {term}
                {role === 'broadcaster' && (
                  <button
                    onClick={() => handleRemoveTerm(term)}
                    className="text-neutral-500 hover:text-red-400 cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </span>
            ))}
          </div>

          {role === 'broadcaster' && (
            <form onSubmit={handleAddTerm} className="flex gap-1.5 mt-1">
              <input
                type="text"
                value={newGlossaryTerm}
                onChange={(e) => setNewGlossaryTerm(e.target.value)}
                placeholder="Agregar término (ej. Rust)..."
                className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-lime-400 rounded px-2.5 py-1 text-xs text-white outline-none"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs text-lime-400 rounded font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Sumar</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
