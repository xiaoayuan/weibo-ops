FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ARG DATABASE_URL=postgresql://postgres:password@db:5432/weibo_ops?schema=public
ARG JWT_SECRET=replace_me_with_a_strong_secret
ARG AUTH_COOKIE_SECURE=false
ARG ACCOUNT_SECRET_KEY=replace_me_with_a_32_char_secret
ENV DATABASE_URL=$DATABASE_URL
ENV JWT_SECRET=$JWT_SECRET
ENV AUTH_COOKIE_SECURE=$AUTH_COOKIE_SECURE
ENV ACCOUNT_SECRET_KEY=$ACCOUNT_SECRET_KEY
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
ENV DATABASE_URL=$DATABASE_URL
ENV JWT_SECRET=$JWT_SECRET
ENV AUTH_COOKIE_SECURE=$AUTH_COOKIE_SECURE
ENV ACCOUNT_SECRET_KEY=$ACCOUNT_SECRET_KEY
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma
EXPOSE 3000
CMD ["npm", "run", "start"]
