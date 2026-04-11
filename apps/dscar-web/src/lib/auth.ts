/**
 * next-auth v5 — Configuração de autenticação do DS Car ERP
 *
 * Suporta dois providers:
 * 1. dev-credentials: e-mail + senha "paddock123" → JWT HS256 (apenas dev)
 * 2. keycloak: OIDC com Keycloak 24 → JWT RS256 (prod)
 *
 * Claims propagados à sessão:
 *   accessToken, role, companies, activeCompany, tenantSchema, clientSlug
 */
import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import Credentials from "next-auth/providers/credentials";
import { SignJWT } from "jose";
import type { PaddockRole } from "@paddock/types";

function getDevJWTSecret(): Uint8Array {
  const secret = process.env.DEV_JWT_SECRET;
  if (!secret) throw new Error("DEV_JWT_SECRET não está definido — configure no .env.local");
  return new TextEncoder().encode(secret);
}

/** Gera JWT HS256 para o provider dev-credentials. */
async function makeDevToken(email: string): Promise<string> {
  return new SignJWT({
    email,
    role: "ADMIN",
    // Claims de tenant padrão em dev — tenant DS Car
    active_company: "dscar",
    tenant_schema: "tenant_dscar",
    client_slug: "grupo-dscar",
    companies: ["dscar"],
    token_type: "access",
    jti: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getDevJWTSecret());
}

const KNOWN_ROLES: PaddockRole[] = ["OWNER", "ADMIN", "MANAGER", "CONSULTANT", "STOREKEEPER"];

// ─── Augmentações de tipo do next-auth ───────────────────────────────────────

declare module "next-auth" {
  interface Session {
    /** JWT de acesso — HS256 (dev) ou RS256 (Keycloak). Enviado ao backend via Authorization. */
    accessToken: string;
    /** Role RBAC do usuário — extraído do JWT. */
    role: PaddockRole;
    /** Empresas às quais o usuário tem acesso. */
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
    companies?: string[];
    activeCompany?: string;
    tenantSchema?: string;
    clientSlug?: string;
  }

  interface JWT {
    accessToken?: string;
    role?: string;
    companies?: string[];
    activeCompany?: string;
    tenantSchema?: string;
    clientSlug?: string;
  }
}

// ─── Exportação principal ────────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID ?? "paddock-frontend",
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET ?? "",
      issuer: process.env.KEYCLOAK_ISSUER ?? "http://localhost:8080/realms/paddock",
    }),
    Credentials({
      id: "dev-credentials",
      name: "Dev (mock)",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (credentials?.email && credentials?.password === "paddock123") {
          const token = await makeDevToken(credentials.email as string);
          return {
            id: "dev-user-id",
            email: credentials.email as string,
            name: "Dev User",
            accessToken: token,
            role: "ADMIN",
            companies: ["dscar"],
            activeCompany: "dscar",
            tenantSchema: "tenant_dscar",
            clientSlug: "grupo-dscar",
          };
        }
        return null;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account, user, profile }) {
      // ── Dev-credentials: propaga claims do User retornado pelo authorize() ──
      if (user) {
        if ("accessToken" in user && user.accessToken) token.accessToken = user.accessToken;
        if ("role" in user && user.role) token.role = user.role;
        if ("companies" in user) token.companies = user.companies;
        if ("activeCompany" in user) token.activeCompany = user.activeCompany;
        if ("tenantSchema" in user) token.tenantSchema = user.tenantSchema;
        if ("clientSlug" in user) token.clientSlug = user.clientSlug;
      }

      // ── Keycloak: extrai access_token RS256 e claims do profile OIDC ──
      if (account?.provider === "keycloak" && account.access_token) {
        token.accessToken = account.access_token;

        // Profile contém os claims customizados (Protocol Mappers configurados no Keycloak)
        const p = (profile ?? {}) as Record<string, unknown>;

        // Role: claim direto (Protocol Mapper "role") tem precedência sobre realm_access.roles
        if (typeof p.role === "string" && KNOWN_ROLES.includes(p.role as PaddockRole)) {
          token.role = p.role;
        } else {
          // Fallback: realm_access.roles (claim padrão do Keycloak)
          const realmRoles = (p.realm_access as { roles?: string[] } | undefined)?.roles ?? [];
          const found = realmRoles.find((r) => KNOWN_ROLES.includes(r as PaddockRole));
          if (found) token.role = found;
        }

        // Claims de tenant — enviados via Protocol Mappers
        if (Array.isArray(p.companies)) token.companies = p.companies as string[];
        if (typeof p.active_company === "string") token.activeCompany = p.active_company;
        if (typeof p.tenant_schema === "string") token.tenantSchema = p.tenant_schema;
        if (typeof p.client_slug === "string") token.clientSlug = p.client_slug;
      }

      return token;
    },

    async session({ session, token }) {
      // Propaga claims do JWT para a sessão acessível no cliente
      session.accessToken = (token.accessToken as string) ?? "";
      session.role = (token.role as PaddockRole) ?? "STOREKEEPER";
      session.companies = (token.companies as string[]) ?? ["dscar"];
      session.activeCompany = (token.activeCompany as string) ?? "dscar";
      session.tenantSchema = (token.tenantSchema as string) ?? "tenant_dscar";
      session.clientSlug = (token.clientSlug as string) ?? "grupo-dscar";
      return session;
    },
  },

  pages: { signIn: "/login" },
});
