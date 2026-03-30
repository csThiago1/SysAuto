"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { usePermission } from "@/hooks/usePermission";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export default function NovaOSLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  const router = useRouter();
  const { status } = useSession();
  const allowed = usePermission("CONSULTANT");

  React.useEffect(() => {
    if (status === "authenticated" && !allowed) {
      toast.info("Sem permissão para criar OS");
      router.replace("/os");
    }
  }, [status, allowed, router]);

  if (status !== "authenticated" || !allowed) return <></>;
  return <>{children}</>;
}
