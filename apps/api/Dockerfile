FROM node:20-alpine AS builder
WORKDIR /repo/apps/api
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci
WORKDIR /repo
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY apps/api ./apps/api
RUN cd apps/api && npx prisma generate --schema ../../prisma/schema.prisma && mkdir -p public && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3009
COPY --from=builder /repo/apps/api/.next/standalone ./
COPY --from=builder /repo/apps/api/.next/static ./.next/static
COPY --from=builder /repo/apps/api/public ./public
COPY --from=builder /repo/apps/api/package.json ./package.json
COPY --from=builder /repo/apps/api/package-lock.json ./package-lock.json
RUN npm ci --omit=dev && apk add --no-cache netcat-openbsd
EXPOSE 3009
CMD ["node", "server.js"]
