import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface VUMeterProps {
  rms: number; // 0 to 1
  peak: number; // 0 to 1
  isMuted: boolean;
  isActive: boolean;
}

export const VUMeter: React.FC<VUMeterProps> = ({ rms, peak, isMuted, isActive }) => {
  // Convert linear RMS to dB (approximate scale)
  const db = rms > 0.0001 ? 20 * Math.log10(rms) : -60;
  // Normalized percentage for 12 segments from -48dB to 0dB
  const clampedDb = Math.max(-48, Math.min(0, db));
  const percent = isActive && !isMuted ? Math.round(((clampedDb + 48) / 48) * 100) : 0;
  const peakPercent = isActive && !isMuted ? Math.min(100, Math.round(peak * 100 * 1.5)) : 0;

  // Segment count
  const segments = 16;
  const activeSegments = Math.round((percent / 100) * segments);

  return (
    <div className="flex items-center gap-3 bg-neutral-900/90 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono">
      <div className="flex items-center gap-1.5 text-neutral-400">
        {isMuted || !isActive ? (
          <VolumeX className="w-4 h-4 text-neutral-500" />
        ) : (
          <Volume2 className="w-4 h-4 text-lime-400 animate-pulse" />
        )}
        <span className="hidden sm:inline text-neutral-300 font-semibold">MIC VU:</span>
      </div>

      <div className="flex items-center gap-1 flex-1 h-3 max-w-[200px] bg-neutral-950 p-1 rounded border border-neutral-800">
        {Array.from({ length: segments }).map((_, i) => {
          const isFilled = i < activeSegments;
          // Colors: green for normal, yellow for high, red for peak/clip
          let colorClass = 'bg-neutral-800';
          if (isFilled) {
            if (i < 10) {
              colorClass = 'bg-lime-400 shadow-sm shadow-lime-400/50';
            } else if (i < 14) {
              colorClass = 'bg-amber-400 shadow-sm shadow-amber-400/50';
            } else {
              colorClass = 'bg-red-500 shadow-sm shadow-red-500/50';
            }
          }
          return (
            <div
              key={i}
              className={`flex-1 h-full rounded-xs transition-colors duration-75 ${colorClass}`}
            />
          );
        })}
      </div>

      <div className="text-right min-w-[54px]">
        {isActive && !isMuted ? (
          <span className="text-lime-300 font-bold">{Math.round(db)} dB</span>
        ) : isMuted ? (
          <span className="text-amber-400">MUTED</span>
        ) : (
          <span className="text-neutral-500">OFF</span>
        )}
      </div>
    </div>
  );
};
