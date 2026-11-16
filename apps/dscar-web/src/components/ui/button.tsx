"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-medium transition-[color,background-color,border-color,transform] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Box de corrida: faixa vermelha inclinada (a do menu e do site).
        // O fundo e um pseudo-elemento inclinado, nao clip-path: o anel de
        // foco do teclado fica no retangulo do botao e continua visivel.
        default:
          "relative isolate text-primary-foreground before:absolute before:inset-0 before:-z-10 before:-skew-x-12 before:rounded-[2px] before:bg-primary before:transition-colors hover:before:bg-primary/90 active:before:bg-primary/80",
        destructive:
          "bg-error-600 text-primary-foreground border border-error-700 shadow-sm hover:bg-error-700",
        outline:
          "border border-foreground/30 bg-transparent text-foreground hover:bg-muted hover:border-foreground/50",
        secondary:
          // secondary-950 e quase preto: um degrau de rampa calibrado so pro escuro.
        // No tema claro o botao saia preto no meio do papel.
        "bg-secondary text-secondary-foreground border border-border shadow-sm hover:bg-accent",
        ghost:
          "text-foreground/70 hover:bg-muted/50 hover:text-foreground/90",
        link:
          "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded px-3 text-xs",
        lg: "h-10 rounded px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-label={props["aria-label"] ?? (size === "icon" ? props.title : undefined)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
