import { usePermission } from "@/hooks/usePermission";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import React from "react";
import type { PaddockRole } from "@paddock/types";

/**
 * HOC que protege um componente de página por papel.
 * Se o usuário não tiver permissão, redireciona para `redirectTo` com toast informativo.
 */
export function withRoleGuard<P extends object>(
  Component: React.ComponentType<P>,
  minRole: PaddockRole,
  redirectTo: string = "/"
): React.FC<P> {
  function GuardedComponent(props: P): React.ReactElement | null {
    const router = useRouter();
    const { status } = useSession();
    const allowed = usePermission(minRole);

    React.useEffect(() => {
      if (status === "authenticated" && !allowed) {
        toast.info("Você não tem permissão para acessar esta página.");
        router.replace(redirectTo as Parameters<typeof router.replace>[0]);
      }
    }, [status, allowed, router]);

    if (status !== "authenticated" || !allowed) return null;
    return React.createElement(Component, props);
  }
  GuardedComponent.displayName = `WithRoleGuard(${Component.displayName ?? Component.name})`;
  return GuardedComponent;
}
