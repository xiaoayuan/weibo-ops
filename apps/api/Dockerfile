FROM node:22-alpine AS builder
WORKDIR /repo
ENV DATABASE_URL=
ENV JWT_SECRET=
ENV ACCOUNT_SECRET_KEY=
COPY package.json package-lock.json ./
RUN npm ci
# Copy all installed node_modules so tsc (run from apps/api sub-dir) can resolve
# dependencies declared in root package.json (e.g. ws, @types/ws, hono)
COPY --from=builder --chown=node:node /repo/node_modules ./node_modules
# Symlink apps/api/node_modules to root node_modules so tsc can resolve cross-package deps
# The tsconfig baseUrl is "." (relative to apps/api/) but paths map to root node_modules
RUN mkdir -p apps/api && ln -sfn /repo/node_modules apps/api/node_modules
COPY prisma ./prisma
COPY apps/api ./apps/api
RUN npx prisma generate --schema prisma/schema.prisma && mkdir -p apps/api/src/generated && cp -r src/generated/prisma apps/api/src/generated/ && mkdir -p node_modules/.prisma/client && cp -r src/generated/prisma/* node_modules/.prisma/client/ && cd apps/api && PATH="/repo/node_modules/.bin:$PATH" npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3009
COPY --from=builder --chown=node:node /repo/package.json ./package.json
COPY --from=builder --chown=node:node /repo/package-lock.json ./package-lock.json
RUN npm ci --omit=dev && apk add --no-cache netcat-openbsd
COPY --from=builder --chown=node:node /repo/apps/api ./apps/api
COPY --from=builder --chown=node:node /repo/src/generated ./src/generated
COPY --from=builder --chown=node:node /repo/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3009
USER node
CMD ["node", "--import", "tsx", "apps/api/src/server.ts"]
