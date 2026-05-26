import { auth } from "@/lib/auth";
import { ROLE_HIERARCHY, type PaddockRole } from "@paddock/types";
import type { NextRequest } from "next/server";

function hasMinRole(role: string | undefined, minRole: PaddockRole): boolean {
  return (ROLE_HIERARCHY[role as PaddockRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
}

export default auth((req) => {
  const request = req as unknown as NextRequest;
  const { pathname } = request.nextUrl;
  const isLoggedIn = !!req.auth;
  const isAuthPage = pathname.startsWith("/login");

  if (!isLoggedIn && !isAuthPage) {
    return Response.redirect(new URL("/login", request.url));
  }

  if (!isLoggedIn) return; // não autenticado em /login — ok

  // Usuário já autenticado tentando acessar /login → redireciona para OS
  if (isLoggedIn && isAuthPage) {
    return Response.redirect(new URL("/os", request.url));
  }

  const role = req.auth?.role as string | undefined;

  // Admin e configurações: MANAGER ou superior
  const isAdminRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/configuracoes");
  if (isAdminRoute && !hasMinRole(role, "MANAGER")) {
    return Response.redirect(new URL("/", request.url));
  }

  // Criar nova OS: CONSULTANT ou superior
  const isNewOSRoute = pathname === "/os/nova";
  if (isNewOSRoute && !hasMinRole(role, "CONSULTANT")) {
    return Response.redirect(new URL("/os", request.url));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
