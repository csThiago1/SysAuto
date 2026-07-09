/**
 * next-auth v5 — Configuracao de autenticacao do DS Car ERP
 *
 * Auth nativo: Credentials provider chama Django /api/v1/auth/login/ diretamente.
 * Keycloak removido da stack.
 *
 * Claims propagados a sessao:
 *   accessToken, refreshToken, role, permissions, companies, activeCompany, tenantSchema, clientSlug
 *
 * Auto-refresh: o callback jwt verifica se o access token expirou e usa o refresh
 * token para obter um novo par access+refresh automaticamente.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { PaddockRole } from "@paddock/types";

// ─── Augmentacoes de tipo do next-auth ───────────────────────────────────────

declare module "next-auth" {
  interface Session {
    accessToken: string;
    role: PaddockRole;
    permissions: string[];
    extraPermissions: string[];
    companies: string[];
    activeCompany: string;
    tenantSchema: string;
    clientSlug: string;
  }

  interface User {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    role?: string;
    permissions?: string[];
    extraPermissions?: string[];
    companies?: string[];
    activeCompany?: string;
    tenantSchema?: string;
    clientSlug?: string;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    role?: string;
    permissions?: string[];
    extraPermissions?: string[];
    companies?: string[];
    activeCompany?: string;
    tenantSchema?: string;
    clientSlug?: string;
    error?: string;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const payloadB64 = jwt.split(".")[1];
  return JSON.parse(Buffer.from(payloadB64, "base64").toString("utf-8"));
}

/**
 * Chama /api/v1/auth/refresh/ para obter novo par access+refresh.
 * Retorna null se falhar (refresh expirado → força re-login).
 */
async function refreshAccessToken(
  refreshToken: string
): Promise<{ access: string; refresh: string } | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Exportacao principal ────────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // Sessão rolante de 30 dias: usuário ativo nunca desloga; o cookie
  // renova a cada 24h de uso e expira só após 30d de inatividade.
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  providers: [
    Credentials({
      id: "credentials",
      name: "Email & Senha",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${BACKEND_URL}/api/v1/auth/login/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const data = await res.json();
          // data: { access: "<jwt>", refresh: "<jwt>" }

          const payload = decodeJwtPayload(data.access);

          return {
            id: payload.sub as string,
            email: payload.email as string,
            name: (payload.name as string) || (payload.email as string),
            accessToken: data.access,
            refreshToken: data.refresh,
            accessTokenExpires: (payload.exp as number) * 1000, // ms
            role: payload.role as string,
            permissions: (payload.permissions as string[]) || [],
            extraPermissions: (payload.extra_permissions as string[]) || [],
            companies: (payload.companies as string[]) || ["dscar"],
            activeCompany: (payload.active_company as string) || "dscar",
            tenantSchema: (payload.tenant_schema as string) || "tenant_dscar",
            clientSlug: (payload.client_slug as string) || "grupo-dscar",
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // 1. Login inicial — propaga tudo do authorize()
      if (user) {
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessTokenExpires = user.accessTokenExpires;
        token.role = user.role;
        token.permissions = user.permissions;
        token.extraPermissions = user.extraPermissions;
        token.companies = user.companies;
        token.activeCompany = user.activeCompany;
        token.tenantSchema = user.tenantSchema;
        token.clientSlug = user.clientSlug;
        return token;
      }

      // 2. Token ainda válido — retorna sem refresh
      const expires = token.accessTokenExpires as number | undefined;
      if (expires && Date.now() < expires - 300_000) {
        // 5min de margem: refresh proativo elimina 401 em requests longos
        return token;
      }

      // 3. Token expirou — tenta refresh
      const refreshToken = token.refreshToken as string | undefined;
      if (!refreshToken) {
        token.error = "RefreshTokenMissing";
        return token;
      }

      const refreshed = await refreshAccessToken(refreshToken);
      if (!refreshed) {
        token.error = "RefreshTokenExpired";
        return token;
      }

      // Atualiza token com novo access + refresh
      const payload = decodeJwtPayload(refreshed.access);
      token.accessToken = refreshed.access;
      token.refreshToken = refreshed.refresh;
      token.accessTokenExpires = (payload.exp as number) * 1000;
      token.role = payload.role as string;
      token.permissions = payload.permissions as string[];
      token.error = undefined;

      return token;
    },

    async session({ session, token }) {
      // Se houve erro de refresh, força logout no client
      if (token.error) {
        session.accessToken = "";
        return session;
      }

      session.accessToken = (token.accessToken as string) ?? "";
      session.role = (token.role as PaddockRole) ?? "STOREKEEPER";
      session.permissions = (token.permissions as string[]) ?? [];
      session.extraPermissions = (token.extraPermissions as string[]) ?? [];
      session.companies = (token.companies as string[]) ?? ["dscar"];
      session.activeCompany = (token.activeCompany as string) ?? "dscar";
      session.tenantSchema = (token.tenantSchema as string) ?? "tenant_dscar";
      session.clientSlug = (token.clientSlug as string) ?? "grupo-dscar";
      return session;
    },
  },

  pages: { signIn: "/login" },
});
