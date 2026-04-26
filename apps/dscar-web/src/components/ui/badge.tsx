import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-primary-100 text-primary-800 border border-primary-200",
        secondary:
          "bg-white/[0.03] text-white/70 border border-white/10",
        success:
          "bg-success-100 text-success-800 border border-success-200",
        warning:
          "bg-warning-100 text-warning-800 border border-warning-200",
        destructive:
          "bg-error-100 text-error-800 border border-error-200",
        outline:
          "border border-white/10 text-white/70",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps): React.ReactElement {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
