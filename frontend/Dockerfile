# Producción Nuxt 3 SSR — Easypanel / Docker
# Build context: raíz del repo (Easypanel: Dockerfile = frontend/Dockerfile, Root = /)
# Local: docker build -f frontend/Dockerfile -t clinica-frontend .
# Proxy /api/v1 → backend vía NUXT_API_PROXY en runtime

FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .

ENV NODE_ENV=production
ENV NUXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NUXT_TELEMETRY_DISABLED=1

RUN addgroup -S nuxt && adduser -S nuxt -G nuxt

COPY --from=builder /app/.output ./.output

USER nuxt

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
