import { useEffect, useRef, useState } from 'react';
import { Eraser, PenLine } from 'lucide-react';

type Props = {
  width?: number;
  height?: number;
  onReady?: (pngBase64: string | null) => void;
};

/**
 * Canvas de assinatura — captura pen/touch, exporta PNG em base64.
 *
 * Suporta mouse e touch events para tablet + desktop. Chama onReady com
 * o base64 cada vez que o desenho muda (ou null se canvas limpo).
 */
export function SignatureCanvas({ width = 600, height = 200, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  // Inicializa canvas com fundo branco e estilo da caneta
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasStrokes) setHasStrokes(true);
  };

  const endDraw = () => {
    if (!drawing) return;
    setDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && onReady) {
      // Exporta dataURL e extrai apenas a parte base64
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1] ?? '';
      onReady(hasStrokes || canvas ? base64 : null);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    onReady?.(null);
  };

  return (
    <div className="space-y-2">
      <div className="border border-slate-300 rounded bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerCancel={endDraw}
          onPointerLeave={endDraw}
          style={{ touchAction: 'none', cursor: 'crosshair', width: '100%', height: 'auto' }}
        />
      </div>
      <div className="flex items-center justify-between text-sm text-slate-600">
        <div className="flex items-center gap-1.5">
          <PenLine size={14} />
          <span>{hasStrokes ? 'Assinatura capturada' : 'Assine acima'}</span>
        </div>
        <button
          onClick={clear}
          type="button"
          className="inline-flex items-center gap-1 text-slate-500 hover:text-red-600"
        >
          <Eraser size={14} /> Limpar
        </button>
      </div>
    </div>
  );
}
