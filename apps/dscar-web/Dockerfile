# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /repo

# Instala dependências a partir da raiz do monorepo (Turborepo workspace)
COPY package.json package-lock.json turbo.json ./
COPY apps/dscar-web/package.json apps/dscar-web/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY packages/auth/package.json packages/auth/
COPY packages/utils/package.json packages/utils/

RUN npm ci

# Copia código fonte
COPY apps/dscar-web/ apps/dscar-web/
COPY packages/ packages/

# Build args para vars públicas do Next.js (baked in no build)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG R2_PUBLIC_URL
ENV R2_PUBLIC_URL=$R2_PUBLIC_URL

RUN npm run build --workspace=apps/dscar-web

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system nextjs && adduser --system --ingroup nextjs nextjs

# Standalone output inclui apenas o necessário para runtime
COPY --from=builder /repo/apps/dscar-web/.next/standalone ./
COPY --from=builder /repo/apps/dscar-web/.next/static ./apps/dscar-web/.next/static
COPY --from=builder /repo/apps/dscar-web/public ./apps/dscar-web/public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "apps/dscar-web/server.js"]
