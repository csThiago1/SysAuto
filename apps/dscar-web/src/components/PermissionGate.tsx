"use client";
import React from "react";
import { useSession } from "next-auth/react";
import type { PaddockRole } from "@paddock/types";
import { usePermission } from "@/hooks/usePermission";

interface PermissionGateProps {
  role: PaddockRole;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({ role, fallback = null, children }: PermissionGateProps): React.ReactElement {
  const { status } = useSession();
  const allowed = usePermission(role);
  if (status === "loading") return <div className="animate-pulse bg-muted/30 rounded-lg h-8 w-full" />;
  return <>{allowed ? children : fallback}</>;
}
