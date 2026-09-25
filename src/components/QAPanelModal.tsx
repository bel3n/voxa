import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  ThumbsUp,
  Sparkles,
  Send,
  CheckCircle2,
  Trash2,
  Filter,
  User,
  HelpCircle,
  TrendingUp,
  Award,
  Loader2,
  Check,
} from 'lucide-react';
import { QAQuestion, TranscriptEntry } from '../types';

interface QAPanelModalProps {
  roomId: string;
  talkTitle: string;
  isBroadcaster: boolean;
  isOpen: boolean;
  onClose: () => void;
  questions: QAQuestion[];
  history: TranscriptEntry[];
  onSubmitQuestion: (text: string, authorName: string) => void;
  onVoteQuestion: (questionId: string) => void;
  onToggleAnswered: (questionId: string) => void;
  onDeleteQuestion: (questionId: string) => void;
}

export const QAPanelModal: React.FC<QAPanelModalProps> = ({
  roomId,
  talkTitle,
  isBroadcaster,
  isOpen,
  onClose,
  questions,
  history,
  onSubmitQuestion,
  onVoteQuestion,
  onToggleAnswered,
  onDeleteQuestion,
}) => {
  const [newQuestionText, setNewQuestionText] = useState('');
  const [authorName, setAuthorName] = useState(() => {
    return localStorage.getItem('nerdearla_qa_author') || '';
  });
  const [filterMode, setFilterMode] = useState<'top' | 'ai' | 'pending' | 'answered' | 'all'>('top');
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [votedSet, setVotedSet] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = newQuestionText.trim();
    if (!cleanText) return;
    const finalAuthor = authorName.trim() || 'Asistente';
    localStorage.setItem('nerdearla_qa_author', finalAuthor);
    onSubmitQuestion(cleanText, finalAuthor);
    setNewQuestionText('');
  };

  const handleVote = (id: string) => {
    if (votedSet.has(id)) return;
    setVotedSet(new Set(votedSet).add(id));
    onVoteQuestion(id);
  };

  const handleAnalyzeWithAi = async () => {
    if (questions.length === 0) return;
    setIsAnalyzingAi(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/qa/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions,
          transcript: history,
        }),
      });
      if (res.ok) {
        setFilterMode('ai');
      }
    } catch (err) {
      console.error('Error analyzing questions with AI:', err);
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  // Filter & sort questions
  const filteredQuestions = [...questions].sort((a, b) => {
    if (filterMode === 'top') {
      return (b.votes || 0) - (a.votes || 0);
    }
    if (filterMode === 'ai') {
      const aIsAi = a.aiHighlightReason ? 1 : 0;
      const bIsAi = b.aiHighlightReason ? 1 : 0;
      if (aIsAi !== bIsAi) return bIsAi - aIsAi;
      return (b.votes || 0) - (a.votes || 0);
    }
    return b.timestamp - a.timestamp;
  }).filter((q) => {
    if (filterMode === 'pending') return !q.isAnswered;
    if (filterMode === 'answered') return q.isAnswered;
    if (filterMode === 'ai') return !!q.aiHighlightReason;
    return true;
  });

  const aiHighlightedCount = questions.filter((q) => !!q.aiHighlightReason).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-lime-400/10 text-lime-400 border border-lime-400/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Preguntas de la Audiencia (Q&A)</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-lime-400 border border-neutral-700">
                  {questions.length} preguntas
                </span>
              </div>
              <p className="text-xs text-neutral-400 truncate max-w-md">
                {talkTitle} — En directo con el orador y moderadores
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

        {/* Toolbar Filters & AI Highlighting */}
        <div className="px-6 py-3 border-b border-neutral-800/80 bg-neutral-950/40 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
            <button
              onClick={() => setFilterMode('top')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                filterMode === 'top' ? 'bg-lime-400 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>Más votadas</span>
            </button>
            <button
              onClick={() => setFilterMode('ai')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                filterMode === 'ai' ? 'bg-lime-400 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3 text-lime-400" />
              <span>Destacadas ({aiHighlightedCount})</span>
            </button>
            <button
              onClick={() => setFilterMode('pending')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filterMode === 'pending' ? 'bg-lime-400 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setFilterMode('answered')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filterMode === 'answered' ? 'bg-lime-400 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Respondidas
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filterMode === 'all' ? 'bg-lime-400 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Recientes
            </button>
          </div>

          {/* AI Curation Button */}
          <button
            onClick={handleAnalyzeWithAi}
            disabled={isAnalyzingAi || questions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-lime-400/40 bg-lime-400/10 hover:bg-lime-400/20 text-lime-300 font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            title="Usa Gemini para analizar la charla y seleccionar las mejores preguntas técnicas para el orador"
          >
            {isAnalyzingAi ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-lime-400" />
                <span>Analizando con IA...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-lime-400" />
                <span>Curar con IA</span>
              </>
            )}
          </button>
        </div>

        {/* Questions List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {filteredQuestions.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 text-xs space-y-2">
              <HelpCircle className="w-8 h-8 mx-auto text-neutral-600" />
              <p className="font-semibold text-neutral-400">
                {questions.length === 0
                  ? 'Aún no hay preguntas. ¡Sé el primero en preguntar al orador!'
                  : 'No hay preguntas con el filtro seleccionado.'}
              </p>
              <p className="text-[11px] text-neutral-600">
                Escribí tu consulta en el formulario inferior para que aparezca en vivo.
              </p>
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const isVoted = votedSet.has(q.id);
              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-xl border transition-all ${
                    q.isAnswered
                      ? 'bg-neutral-950/40 border-neutral-800/50 opacity-70'
                      : q.aiHighlightReason
                      ? 'bg-gradient-to-r from-lime-950/30 via-neutral-950 to-neutral-950 border-lime-500/40 shadow-sm'
                      : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1.5">
                      {/* Author & Tags */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-white flex items-center gap-1">
                          <User className="w-3 h-3 text-neutral-400" />
                          <span>{q.authorName}</span>
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          {new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {q.aiHighlightReason && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-lime-400/20 text-lime-300 border border-lime-400/40 text-[10px] font-bold">
                            <Sparkles className="w-2.5 h-2.5 text-lime-400" />
                            <span>Recomendada por IA</span>
                          </span>
                        )}
                        {q.isAnswered && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-semibold">
                            <Check className="w-2.5 h-2.5" />
                            <span>Respondida</span>
                          </span>
                        )}
                      </div>

                      {/* Question Text */}
                      <p className="text-sm text-neutral-100 font-medium leading-relaxed">
                        {q.text}
                      </p>

                      {/* AI Reason explanation */}
                      {q.aiHighlightReason && (
                        <div className="text-[11px] text-lime-400/90 bg-lime-950/40 border border-lime-900/60 rounded-lg p-2 font-mono mt-1">
                          💡 <strong>Por qué es clave:</strong> {q.aiHighlightReason}
                        </div>
                      )}
                    </div>

                    {/* Upvote & Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        onClick={() => handleVote(q.id)}
                        disabled={isVoted}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                          isVoted
                            ? 'bg-lime-400/20 border-lime-400/60 text-lime-300 cursor-default'
                            : 'bg-neutral-900 border-neutral-700 hover:border-lime-400/60 text-neutral-300 hover:text-white'
                        }`}
                        title="Votar esta pregunta"
                      >
                        <ThumbsUp className={`w-3.5 h-3.5 ${isVoted ? 'text-lime-400 fill-lime-400/40' : ''}`} />
                        <span>{q.votes || 0}</span>
                      </button>

                      {/* Speaker / Moderator actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onToggleAnswered(q.id)}
                          className={`p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer ${
                            q.isAnswered ? 'text-emerald-400' : ''
                          }`}
                          title={q.isAnswered ? 'Marcar como pendiente' : 'Marcar como respondida'}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        {isBroadcaster && (
                          <button
                            onClick={() => onDeleteQuestion(q.id)}
                            className="p-1.5 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                            title="Eliminar pregunta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input Form Footer */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-neutral-800 bg-neutral-950/80 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Tu nombre (opcional)"
              className="w-40 sm:w-48 bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-lime-400"
            />
            <input
              type="text"
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              placeholder="Escribí tu pregunta para el orador..."
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-lime-400"
            />
            <button
              type="submit"
              disabled={!newQuestionText.trim()}
              className="px-4 py-2 bg-lime-400 hover:bg-lime-300 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-950 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-lime-400/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-500 px-1">
            <span>Las preguntas se actualizan en vivo para todos los asistentes y moderadores.</span>
          </div>
        </form>
      </div>
    </div>
  );
};
