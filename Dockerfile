# Stage 1: Builder
FROM node:24.21.0-alpine3.24 AS builder
WORKDIR /app

# pnpm is pinned by the packageManager field in package.json
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# Node/Nitro target — the default `pnpm build` targets Cloudflare Workers
RUN pnpm build:node

# Stage 2: Production
FROM node:24.21.0-alpine3.24 AS production
WORKDIR /app

# pnpm is pinned by the packageManager field in package.json
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder --chown=node:node /app/.output ./.output

EXPOSE 3000

ENV NODE_ENV=production

# Run as the unprivileged node user
USER node

# dd-trace must be initialized before the app
CMD ["node", "--require", "dd-trace/init", ".output/server/index.mjs"]
