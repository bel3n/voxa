import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, QrCode, Copy, Check, ExternalLink, Smartphone, Monitor } from 'lucide-react';

interface QRModalProps {
  roomId: string;
  talkTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const QRModal: React.FC<QRModalProps> = ({ roomId, talkTitle, isOpen, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const viewerUrl = `${window.location.origin}?room=${roomId}&role=viewer`;

  useEffect(() => {
    if (!isOpen) return;

    QRCode.toDataURL(viewerUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [isOpen, viewerUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(viewerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden text-center">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2.5 text-left">
            <div className="p-2 rounded-xl bg-lime-400/10 text-lime-400 border border-lime-400/20">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Escaneá para seguir la charla</h2>
              <p className="text-xs text-neutral-400">Subtítulos y Q&A en tu celular</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Body */}
        <div className="p-6 flex flex-col items-center space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-xl border-4 border-lime-400/40">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code para unirse a la sala" className="w-64 h-64 mx-auto rounded-lg" />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center text-neutral-400">
                Generando código QR...
              </div>
            )}
          </div>

          <div className="space-y-1 max-w-xs">
            <p className="text-sm font-bold text-white">{talkTitle}</p>
            <p className="text-xs text-neutral-400">
              Sala: <span className="font-mono text-lime-300 font-semibold">{roomId}</span>
            </p>
          </div>

          {/* Quick instructions */}
          <div className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-neutral-300 flex items-center gap-3 text-left">
            <Smartphone className="w-5 h-5 text-lime-400 shrink-0" />
            <div>
              <p className="font-semibold text-white">Sin descargas ni registro</p>
              <p className="text-[11px] text-neutral-400">
                Apuntá la cámara para ver subtítulos bilingües y enviar preguntas.
              </p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between gap-2">
          <button
            onClick={handleCopyLink}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 rounded-xl border border-neutral-700 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-lime-400" />
                <span className="text-lime-300">¡Enlace copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-neutral-400" />
                <span>Copiar Enlace</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-lime-400 hover:bg-lime-300 text-neutral-950 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-md shadow-lime-400/20"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
