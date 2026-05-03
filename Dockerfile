FROM node:22-alpine AS builder
WORKDIR /app
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV JWT_SECRET=
ENV AUTH_COOKIE_SECURE=false
ENV ACCOUNT_SECRET_KEY=
ENV EXECUTOR_MODE=weibo
ENV NODE_ROLE=controller
ENV NODE_ID=main-1
ENV ACTION_JOB_NODES=main-1:主服务器
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && mkdir -p node_modules/.prisma/client && cp -r src/generated/prisma/* node_modules/.prisma/client/ && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=node:node /app/src/generated ./src/generated
RUN npm ci --omit=dev && apk add --no-cache netcat-openbsd
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
USER node
CMD ["node", "server.js"]
