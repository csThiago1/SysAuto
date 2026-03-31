import { auth } from "@/lib/auth";
import type { PaddockRole } from "@paddock/types";

const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 5, ADMIN: 4, MANAGER: 3, CONSULTANT: 2, STOREKEEPER: 1,
};

function hasMinRole(role: string | undefined, minRole: PaddockRole): boolean {
  return (ROLE_HIERARCHY[role ?? ""] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isAuthPage = pathname.startsWith("/login");

  if (!isLoggedIn && !isAuthPage) {
    return Response.redirect(new URL("/login", req.url));
  }

  if (!isLoggedIn) return; // não autenticado em /login — ok

  const role = req.auth?.role as string | undefined;

  // Admin e configurações: MANAGER ou superior
  const isAdminRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/configuracoes");
  if (isAdminRoute && !hasMinRole(role, "MANAGER")) {
    return Response.redirect(new URL("/", req.url));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
