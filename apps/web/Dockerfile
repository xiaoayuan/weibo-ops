FROM node:20-alpine AS builder
WORKDIR /app
ARG BACKEND_ORIGIN=http://127.0.0.1:3007
ENV BACKEND_ORIGIN=$BACKEND_ORIGIN
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN mkdir -p public && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3008
ARG BACKEND_ORIGIN=http://127.0.0.1:3007
ENV BACKEND_ORIGIN=$BACKEND_ORIGIN
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
RUN npm ci --omit=dev && apk add --no-cache netcat-openbsd
EXPOSE 3008
USER node
CMD ["node", "server.js"]
