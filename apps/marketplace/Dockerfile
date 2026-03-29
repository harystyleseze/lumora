FROM node:22-alpine AS base
RUN npm install -g pnpm@10.33.0

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/marketplace/package.json ./apps/marketplace/package.json
RUN pnpm install --filter @lumora/marketplace...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/marketplace/node_modules ./apps/marketplace/node_modules
COPY packages/types ./packages/types
COPY apps/marketplace ./apps/marketplace
WORKDIR /app/apps/marketplace
ARG NEXT_PUBLIC_ROUTER_URL=http://localhost:3001
ENV NEXT_PUBLIC_ROUTER_URL=$NEXT_PUBLIC_ROUTER_URL
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/marketplace/.next/standalone ./
COPY --from=builder /app/apps/marketplace/.next/static ./.next/static
# Copy public dir if it exists
COPY --from=builder /app/apps/marketplace/public* ./public/
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
