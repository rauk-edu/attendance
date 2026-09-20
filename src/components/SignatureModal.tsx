import React, { useEffect, useRef, useState, useCallback, PointerEvent } from 'react';
import { GPSState } from '../types';
import { Eraser, Check, X, MapPin } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  staffName: string;
  periodLabel: string;
  colIndex: number;
  gpsState: GPSState;
  onSave: (sigBase64: string) => void;
  onClose: () => void;
}

export default function SignatureModal({
  isOpen,
  staffName,
  periodLabel,
  gpsState,
  onSave,
  onClose,
}: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef<boolean>(false);
  const [hasDrawn, setHasDrawn] = useState<boolean>(false);

  // Initialize and clear canvas when opened
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw subtle guide line in bottom third
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, canvas.height - 25);
    ctx.lineTo(canvas.width - 20, canvas.height - 25);
    ctx.stroke();
    setHasDrawn(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        clearCanvas();
      }, 50);
    }
  }, [isOpen, clearCanvas]);

  if (!isOpen) return null;

  const isGpsOk = gpsState.status === 'ok' || gpsState.status === 'simulated';

  const getCanvasPos = (
    e: PointerEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawing.current = true;
    canvas.setPointerCapture(e.pointerId);

    const pos = getCanvasPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1d4ed8'; // Official Cambodia blue ink
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getCanvasPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const handlePointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // pointer may have been released
      }
    }
  };

  const handleSave = () => {
    if (!hasDrawn) {
      alert('សូមគូសហត្ថលេខាជាមុនសិន!');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div
      id="att-sig-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl text-slate-100 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
          <div>
            <h3 className="font-bold text-base text-amber-400">
              ✍️ គូសហត្ថលេខាវត្តមាន
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              បុគ្គលិក៖ <span className="text-white font-semibold">{staffName}</span> • ({periodLabel})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* GPS status pill */}
        <div className="mb-3">
          {isGpsOk ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/70 border border-emerald-500/40 text-emerald-300">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                {gpsState.status === 'simulated'
                  ? '✅ ទីតាំងសាលា (សាកល្បង Demo OK)'
                  : `✅ នៅក្នុងសាលា — ចម្ងាយ ${gpsState.distance}m (GPS OK)`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/70 border border-rose-500/40 text-rose-300">
              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>
                {gpsState.status === 'bad'
                  ? `❌ នៅក្រៅបរិវេណសាលា (${gpsState.distance}m)`
                  : '⚠️ មិនទាន់ទទួលបានទីតាំង GPS'}
              </span>
            </div>
          )}
        </div>

        {/* Drawing canvas box */}
        <div className="relative bg-white rounded-xl p-2 border-2 border-blue-500 shadow-inner overflow-hidden mb-4">
          <canvas
            ref={canvasRef}
            width={340}
            height={150}
            className="w-full h-[150px] touch-none cursor-crosshair block"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          {!hasDrawn && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 text-xs gap-1">
              <span>✍️ គូសហត្ថលេខានៅទីនេះ</span>
              <span className="text-[10px] text-slate-400/80">(ប្រើម្រាមដៃ ឬ Mouse)</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={clearCanvas}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition cursor-pointer"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>សម្អាត</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer"
            >
              បោះបង់
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasDrawn}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-950 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>រក្សាទុក</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
