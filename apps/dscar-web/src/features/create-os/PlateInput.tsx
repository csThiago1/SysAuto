import React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PlateInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  onValueChange: (val: string) => void;
}

export const PlateInput = React.forwardRef<HTMLInputElement, PlateInputProps>(
  ({ error, value, onValueChange, className, ...props }, ref) => {
    return (
      <div className="relative">
        <Input
          ref={ref}
          value={value}
          onChange={(e) => {
            // Remove espaços e hífens e converte para maiúsculo preventivamente
            const raw = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
            // Limita visualmente a 7 chars
            if (raw.length <= 7) {
              onValueChange(raw);
            }
          }}
          placeholder="ABC1D23"
          className={cn(
            "uppercase font-mono tracking-widest text-lg font-semibold",
            error && "border-error-400 focus-visible:ring-error-400",
            className
          )}
          maxLength={7} // Fallback se colado com caracteres especiais
          {...props}
        />
        {error && <p className="text-xs text-error-600 mt-1">{error}</p>}
      </div>
    );
  }
);

PlateInput.displayName = "PlateInput";
