FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
ARG DATABASE_URL=postgresql://postgres:password@db:5432/weibo_ops?schema=public
ARG JWT_SECRET=replace_me_with_a_strong_secret
ARG AUTH_COOKIE_SECURE=false
ARG ACCOUNT_SECRET_KEY=replace_me_with_a_32_char_secret
ARG EXECUTOR_MODE=weibo
ARG NODE_ROLE=controller
ARG NODE_ID=main-1
ARG ACTION_JOB_NODES=main-1:主服务器
ENV DATABASE_URL=$DATABASE_URL
ENV JWT_SECRET=$JWT_SECRET
ENV AUTH_COOKIE_SECURE=$AUTH_COOKIE_SECURE
ENV ACCOUNT_SECRET_KEY=$ACCOUNT_SECRET_KEY
ENV EXECUTOR_MODE=$EXECUTOR_MODE
ENV NODE_ROLE=$NODE_ROLE
ENV NODE_ID=$NODE_ID
ENV ACTION_JOB_NODES=$ACTION_JOB_NODES
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ARG DATABASE_URL=postgresql://postgres:password@db:5432/weibo_ops?schema=public
ARG JWT_SECRET=replace_me_with_a_strong_secret
ARG AUTH_COOKIE_SECURE=false
ARG ACCOUNT_SECRET_KEY=replace_me_with_a_32_char_secret
ARG EXECUTOR_MODE=weibo
ARG NODE_ROLE=controller
ARG NODE_ID=main-1
ARG ACTION_JOB_NODES=main-1:主服务器
ENV DATABASE_URL=$DATABASE_URL
ENV JWT_SECRET=$JWT_SECRET
ENV AUTH_COOKIE_SECURE=$AUTH_COOKIE_SECURE
ENV ACCOUNT_SECRET_KEY=$ACCOUNT_SECRET_KEY
ENV EXECUTOR_MODE=$EXECUTOR_MODE
ENV NODE_ROLE=$NODE_ROLE
ENV NODE_ID=$NODE_ID
ENV ACTION_JOB_NODES=$ACTION_JOB_NODES
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "server.js"]
