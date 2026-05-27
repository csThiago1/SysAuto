/**
 * next-auth v5 — Configuracao de autenticacao do DS Car ERP
 *
 * Auth nativo: Credentials provider chama Django /api/v1/auth/login/ diretamente.
 * Keycloak removido da stack.
 *
 * Claims propagados a sessao:
 *   accessToken, role, permissions, companies, activeCompany, tenantSchema, clientSlug
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
    role?: string;
    permissions?: string[];
    extraPermissions?: string[];
    companies?: string[];
    activeCompany?: string;
    tenantSchema?: string;
    clientSlug?: string;
  }
}

// ─── Exportacao principal ────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
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
          const res = await fetch(`${API_URL}/api/v1/auth/login/`, {
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

          // Decode JWT payload to extract claims (backend already validated)
          const payloadB64 = data.access.split(".")[1];
          const payload = JSON.parse(
            Buffer.from(payloadB64, "base64").toString("utf-8")
          );

          return {
            id: payload.sub,
            email: payload.email,
            name: payload.name || payload.email,
            accessToken: data.access,
            role: payload.role,
            permissions: payload.permissions || [],
            extraPermissions: payload.extra_permissions || [],
            companies: payload.companies || ["dscar"],
            activeCompany: payload.active_company || "dscar",
            tenantSchema: payload.tenant_schema || "tenant_dscar",
            clientSlug: payload.client_slug || "grupo-dscar",
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
      // Propaga claims do User retornado pelo authorize()
      if (user) {
        if (user.accessToken) token.accessToken = user.accessToken;
        if (user.role) token.role = user.role;
        if (user.permissions) token.permissions = user.permissions;
        if (user.extraPermissions) token.extraPermissions = user.extraPermissions;
        if (user.companies) token.companies = user.companies;
        if (user.activeCompany) token.activeCompany = user.activeCompany;
        if (user.tenantSchema) token.tenantSchema = user.tenantSchema;
        if (user.clientSlug) token.clientSlug = user.clientSlug;
      }
      return token;
    },

    async session({ session, token }) {
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
