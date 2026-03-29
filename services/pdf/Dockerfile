FROM node:22-alpine AS base
RUN npm install -g pnpm@10.33.0

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY services/pdf/package.json ./services/pdf/package.json
RUN pnpm install --filter @lumora/pdf...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/pdf/node_modules ./services/pdf/node_modules
COPY services/pdf ./services/pdf
WORKDIR /app/services/pdf
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache wget
COPY --from=builder /app/services/pdf/dist ./dist
COPY --from=builder /app/services/pdf/node_modules ./node_modules
EXPOSE 3002
CMD ["node", "dist/index.js"]
