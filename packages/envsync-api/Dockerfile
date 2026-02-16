# Stage 1: Install dependencies
FROM oven/bun:1.2.15-alpine AS deps

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Stage 2: Production runtime
FROM oven/bun:1.2.15-alpine

WORKDIR /app

RUN addgroup -S envsync && adduser -S envsync -G envsync

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY scripts ./scripts
COPY tsconfig*.json ./

RUN chown -R envsync:envsync /app

USER envsync

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["bun", "run", "src/entrypoint.ts"]
