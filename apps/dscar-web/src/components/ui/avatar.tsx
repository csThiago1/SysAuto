/**
 * Avatar — Avatar circular com iniciais ou logo
 * Componente genérico usado na tabela de pessoas, cards de OS, etc.
 */

"use client";

import React from "react";
import { initials } from "@paddock/utils";
import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  logoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export function Avatar({ name, logoUrl, size = "sm", className }: AvatarProps) {
  const [imgFailed, setImgFailed] = React.useState(false);

  // Reset quando URL muda
  React.useEffect(() => {
    setImgFailed(false);
  }, [logoUrl]);

  const sizeClass = SIZE_CLASS[size];

  if (logoUrl && !imgFailed) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className={cn(
          sizeClass,
          "rounded-full object-contain bg-white border border-neutral-200 shrink-0",
          className
        )}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        "rounded-full bg-surface border border-neutral-200 flex items-center justify-center font-semibold text-neutral-600 shrink-0",
        className
      )}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}
