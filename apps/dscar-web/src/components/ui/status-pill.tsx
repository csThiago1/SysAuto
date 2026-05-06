import { cn } from "@/lib/utils"

const COLOR_MAP = {
  success: {
    bg: "bg-success-500/10",
    border: "border-success-500/20",
    text: "text-success-400",
    dot: "bg-success-400",
  },
  error: {
    bg: "bg-error-500/10",
    border: "border-error-500/20",
    text: "text-error-400",
    dot: "bg-error-400",
  },
  warning: {
    bg: "bg-warning-500/10",
    border: "border-warning-500/20",
    text: "text-warning-400",
    dot: "bg-warning-400",
  },
  info: {
    bg: "bg-info-500/10",
    border: "border-info-500/20",
    text: "text-info-400",
    dot: "bg-info-400",
  },
  neutral: {
    bg: "bg-muted/50",
    border: "border-border",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
  },
} as const

type StatusPillColor = keyof typeof COLOR_MAP

interface StatusPillProps {
  label: string
  color: StatusPillColor
  size?: "sm" | "md"
  dot?: boolean
  className?: string
}

export function StatusPill({
  label,
  color,
  size = "sm",
  dot = false,
  className,
}: StatusPillProps) {
  const c = COLOR_MAP[color]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        c.bg,
        c.border,
        c.text,
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0 animate-pulse-slow",
            c.dot
          )}
        />
      )}
      {label}
    </span>
  )
}
