FROM node:22-alpine AS base
RUN npm install -g pnpm@10.33.0

FROM base AS deps
WORKDIR /app
# Copy workspace manifests only — for dependency resolution
COPY package.json pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/router/package.json ./apps/router/package.json
# Install router + all its workspace dependencies
RUN pnpm install --filter @lumora/router...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/router/node_modules ./apps/router/node_modules
# Copy source (types first since router depends on it)
COPY packages/types ./packages/types
COPY apps/router ./apps/router
WORKDIR /app/apps/router
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache wget
COPY --from=builder /app/apps/router/dist ./dist
COPY --from=builder /app/apps/router/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
