/**
 * next-auth v5 — Configuracao de autenticacao do DS Car ERP
 *
 * Provider unico: credentials (e-mail + senha) -> JWT via Django backend.
 * O backend retorna access_token + refresh_token (RS256).
 * Claims propagados a sessao:
 *   accessToken, role, permissions, companies, activeCompany, tenantSchema, clientSlug
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { PaddockRole } from "@paddock/types";

// ── Augmentacoes de tipo do next-auth ─────────────────────────────────────

declare module "next-auth" {
  interface Session {
    /** JWT de acesso — RS256 emitido pelo Django. Enviado ao backend via Authorization. */
    accessToken: string;
    /** Role RBAC do usuario — extraido do JWT. */
    role: PaddockRole;
    /** Permissoes granulares do colaborador. */
    permissions: string[];
    /** @deprecated Alias para permissions — manter compatibilidade temporaria. */
    extraPermissions: string[];
    /** Empresas as quais o usuario tem acesso. */
    companies: string[];
    /** Empresa ativa no momento do login. */
    activeCompany: string;
    /** Schema PostgreSQL do tenant ativo (ex: "tenant_dscar"). */
    tenantSchema: string;
    /** Slug do cliente/grupo (ex: "grupo-dscar"). */
    clientSlug: string;
  }

  interface User {
    accessToken?: string;
    role?: string;
    permissions?: string[];
    companies?: string[];
    activeCompany?: string;
    tenantSchema?: string;
    clientSlug?: string;
  }

  interface JWT {
    accessToken?: string;
    role?: string;
    permissions?: string[];
    companies?: string[];
    activeCompany?: string;
    tenantSchema?: string;
    clientSlug?: string;
  }
}

// ── Exportacao principal ──────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      id: "credentials",
      name: "Email & Senha",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/v1/auth/login/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        if (!res.ok) return null;

        const data = await res.json();
        // data has: access_token, refresh_token, token_type, expires_in

        // Decode the JWT payload to extract claims (without verification — backend already verified)
        const payload = JSON.parse(
          Buffer.from(data.access_token.split(".")[1], "base64").toString()
        );

        return {
          id: payload.sub,
          email: payload.email,
          name: payload.name || payload.email,
          accessToken: data.access_token,
          role: payload.role,
          permissions: payload.permissions || [],
          companies: ["dscar"],
          activeCompany: "dscar",
          tenantSchema: "tenant_dscar",
          clientSlug: "grupo-dscar",
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // Propaga claims do User retornado pelo authorize() para o JWT do next-auth
      if (user) {
        if (user.accessToken) token.accessToken = user.accessToken;
        if (user.role) token.role = user.role;
        if (user.permissions) token.permissions = user.permissions;
        if (user.companies) token.companies = user.companies;
        if (user.activeCompany) token.activeCompany = user.activeCompany;
        if (user.tenantSchema) token.tenantSchema = user.tenantSchema;
        if (user.clientSlug) token.clientSlug = user.clientSlug;
      }

      return token;
    },

    async session({ session, token }) {
      // Propaga claims do JWT para a sessao acessivel no cliente
      session.accessToken = (token.accessToken as string) ?? "";
      session.role = (token.role as PaddockRole) ?? "STOREKEEPER";
      const perms = (token.permissions as string[]) ?? [];
      session.permissions = perms;
      session.extraPermissions = perms; // alias backward-compat
      session.companies = (token.companies as string[]) ?? ["dscar"];
      session.activeCompany = (token.activeCompany as string) ?? "dscar";
      session.tenantSchema = (token.tenantSchema as string) ?? "tenant_dscar";
      session.clientSlug = (token.clientSlug as string) ?? "grupo-dscar";
      return session;
    },
  },

  pages: { signIn: "/login" },
});
