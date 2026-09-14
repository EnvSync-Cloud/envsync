# OSS / core API image.
# Build context: monorepo root (release.yml) so workspace deps resolve.
FROM oven/bun:1.3.9-alpine AS deps

WORKDIR /app

COPY package.json bun.lock ./
COPY packages ./packages
COPY sdks ./sdks
COPY apps ./apps

# Production graph for the API process (+ workspace envsync-kernel).
# --no-frozen-lockfile: GH Actions sets CI=true (Bun freezes the lockfile by default).
# Workspace graph in the image may differ slightly from a local install with gitignored
# private checkouts under packages/; never commit a lock rewrite from the image.
RUN bun install --production --no-frozen-lockfile

FROM oven/bun:1.3.9-alpine

WORKDIR /app

RUN apk add --no-cache wget \
	&& addgroup -S envsync && adduser -S envsync -G envsync

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/packages/envsync-kernel ./packages/envsync-kernel
COPY --from=deps /app/packages/envsync-analytics ./packages/envsync-analytics
COPY --from=deps /app/packages/envsync-api/package.json ./packages/envsync-api/package.json
COPY packages/envsync-api/src ./packages/envsync-api/src
COPY packages/envsync-api/scripts ./packages/envsync-api/scripts
COPY packages/envsync-api/tsconfig*.json ./packages/envsync-api/

RUN chown -R envsync:envsync /app

USER envsync

WORKDIR /app/packages/envsync-api

EXPOSE 4000

# Swarm must not SIGKILL a listening API. The deploy CLI probes /health itself.

CMD ["bun", "run", "src/entrypoint.ts"]
