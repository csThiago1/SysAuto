import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Keycloak({
            clientId: process.env.AUTH_KEYCLOAK_ID ?? "",
            clientSecret: process.env.AUTH_KEYCLOAK_SECRET ?? "",
            issuer: `${process.env.AUTH_KEYCLOAK_ISSUER}/realms/${process.env.AUTH_KEYCLOAK_REALM}`,
        }),
    ],
    callbacks: {
        async jwt({ token, account, profile }) {
            // Propagar claims do Keycloak para o JWT interno
            if (account && profile) {
                token.sub = profile.sub;
                token.email = profile.email;
                token.name = profile.name;
                // Claims customizados do Paddock (configurados no Keycloak)
                const p = profile as Record<string, unknown>;
                token.companies = p["companies"] as string[];
                token.active_company = p["active_company"] as string;
                token.role = p["role"] as string;
                token.tenant_schema = p["tenant_schema"] as string;
                token.client_slug = p["client_slug"] as string;
            }
            return token;
        },
        async session({ session, token }) {
            // Expor claims para o cliente
            return {
                ...session,
                user: {
                    ...session.user,
                    id: token.sub ?? "",
                    companies: token.companies as string[],
                    active_company: token.active_company as string,
                    role: token.role as string,
                    tenant_schema: token.tenant_schema as string,
                    client_slug: token.client_slug as string,
                },
            };
        },
    },
    pages: {
        signIn: "/login",
        error: "/auth/error",
    },
    session: {
        strategy: "jwt",
        maxAge: 60 * 60 * 24 * 14, // 14 dias
    },
});
