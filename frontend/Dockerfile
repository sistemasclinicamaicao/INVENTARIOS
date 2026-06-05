# Producción Nuxt 3 SSR — Easypanel / Docker
# Build context: raíz del repo (Easypanel: Dockerfile = frontend/Dockerfile, Root = /)
# Local: docker build -f frontend/Dockerfile -t clinica-frontend .
# Easypanel: Dominios → puerto del contenedor = 3000

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
ENV NUXT_TELEMETRY_DISABLED=1

RUN addgroup -S nuxt && adduser -S nuxt -G nuxt

COPY --from=builder /app/.output ./.output

USER nuxt

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "const p=process.env.PORT||'3000';fetch('http://127.0.0.1:'+p+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
