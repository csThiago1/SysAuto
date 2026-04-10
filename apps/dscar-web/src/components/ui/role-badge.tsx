/**
 * RoleBadge — Badge de role de pessoa (CLIENT, INSURER, etc.)
 * Usa PERSON_ROLE_LABEL e PERSON_ROLE_BADGE de @paddock/utils.
 */

import type { PersonRole } from "@paddock/types";
import { PERSON_ROLE_LABEL, PERSON_ROLE_BADGE } from "@paddock/utils";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  role: PersonRole;
  size?: "sm" | "md";
  className?: string;
}

export function RoleBadge({ role, size = "md", className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        PERSON_ROLE_BADGE[role],
        className
      )}
    >
      {PERSON_ROLE_LABEL[role]}
    </span>
  );
}
