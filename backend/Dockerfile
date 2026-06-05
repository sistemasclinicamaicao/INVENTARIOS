# Producción — Easypanel / Docker
# Build context: raíz del repo (Easypanel: Dockerfile = backend/Dockerfile, Root = /)
# Local: docker build -f backend/Dockerfile -t clinica-api .
# Puerto interno: 3000

FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/ .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S nestjs && adduser -S nestjs -G nestjs

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
