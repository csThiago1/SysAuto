import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import Credentials from "next-auth/providers/credentials";
import type { PaddockRole } from "@paddock/types";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    role?: PaddockRole;
  }
  interface User {
    accessToken?: string;
  }
  // JWT augmentation (next-auth v5 re-exports JWT through the main module)
  interface JWT {
    accessToken?: string;
    role?: string;
  }
}

// next-auth/jwt augmentation handled via next-auth module above

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
          return {
            id: "dev-user-id",
            email: credentials.email as string,
            name: "Dev User",
            accessToken: "dev-mock-token",
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      if (account?.access_token) token.accessToken = account.access_token;
      if (user && "accessToken" in user) token.accessToken = user.accessToken;
      // Extrai role do JWT Keycloak (claim "role" ou "realm_access.roles")
      if (token.realm_access && typeof token.realm_access === "object") {
        const roles = (token.realm_access as { roles?: string[] }).roles ?? [];
        const knownRoles: string[] = ["ADMIN", "MANAGER", "CONSULTANT", "STOREKEEPER"];
        const found = roles.find((r) => knownRoles.includes(r));
        if (found) token.role = found;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.accessToken === "string") session.accessToken = token.accessToken;
      if (typeof token.role === "string") session.role = token.role as PaddockRole;
      return session;
    },
  },
  pages: { signIn: "/login" },
});
