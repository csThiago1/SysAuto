"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

interface PhotoCaptureGridProps {
  photos: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

/**
 * Grid 3 colunas de fotos locais com tile de captura.
 * Compartilhado entre o wizard de recepção e a tela de vistoria.
 * No mobile, o input abre o action sheet nativo (câmera ou galeria).
 */
export function PhotoCaptureGrid({
  photos,
  onAdd,
  onRemove,
  disabled,
}: PhotoCaptureGridProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const next = photos.map((f) => URL.createObjectURL(f));
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onAdd(files);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {urls.map((url, i) => (
        <div key={url} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
          {!disabled && (
            <button
              type="button"
              aria-label={`Remover foto ${i + 1}`}
              onClick={() => onRemove(i)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        aria-label="Adicionar foto"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground disabled:opacity-50"
      >
        <Camera className="h-6 w-6" />
        <span className="text-[10px]">Adicionar</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
    </div>
  );
}
