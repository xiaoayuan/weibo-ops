FROM node:20-alpine AS builder
WORKDIR /repo
ARG DATABASE_URL=postgresql://postgres:password@db:5432/weibo_ops?schema=public
ARG JWT_SECRET=replace_me_with_a_strong_secret
ARG ACCOUNT_SECRET_KEY=replace_me_with_a_32_char_secret
ENV DATABASE_URL=$DATABASE_URL
ENV JWT_SECRET=$JWT_SECRET
ENV ACCOUNT_SECRET_KEY=$ACCOUNT_SECRET_KEY
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY apps/api ./apps/api
RUN npx prisma generate --schema prisma/schema.prisma && mkdir -p apps/api/src/generated && cp -r src/generated/prisma apps/api/src/generated/ && mkdir -p node_modules/.prisma/client && cp -r src/generated/prisma/* node_modules/.prisma/client/ && cd apps/api && PATH="/repo/node_modules/.bin:$PATH" npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3009
ARG DATABASE_URL=postgresql://postgres:password@db:5432/weibo_ops?schema=public
ARG JWT_SECRET=replace_me_with_a_strong_secret
ARG ACCOUNT_SECRET_KEY=replace_me_with_a_32_char_secret
ENV DATABASE_URL=$DATABASE_URL
ENV JWT_SECRET=$JWT_SECRET
ENV ACCOUNT_SECRET_KEY=$ACCOUNT_SECRET_KEY
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/package-lock.json ./package-lock.json
RUN npm ci --omit=dev && apk add --no-cache netcat-openbsd
COPY --from=builder /repo/apps/api ./apps/api
COPY --from=builder /repo/src/generated ./src/generated
COPY --from=builder /repo/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3009
CMD ["npx", "tsx", "-C", "/app/apps/api", "src/server.ts"]
