# Enterprise API image: core process + manage surface (/api/v1/manage/...)
# Build context: monorepo root (see release.yml).
FROM oven/bun:1.3.9-alpine AS build

WORKDIR /app

# Full workspace graph is required so bun can resolve workspace:* deps.
COPY package.json bun.lock ./
COPY packages ./packages
COPY sdks ./sdks
COPY apps ./apps

# --no-frozen-lockfile: GH Actions sets CI=true (Bun freezes the lockfile by default).
RUN bun install --no-frozen-lockfile

WORKDIR /app/packages/envsync-api
RUN bun run builder.enterprise.ts

FROM oven/bun:1.3.9-alpine

WORKDIR /app

RUN apk add --no-cache wget \
	&& addgroup -S envsync && adduser -S envsync -G envsync

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/envsync-kernel ./packages/envsync-kernel
COPY --from=build /app/packages/envsync-enterprise ./packages/envsync-enterprise
COPY --from=build /app/packages/envsync-api ./packages/envsync-api

WORKDIR /app/packages/envsync-api

RUN chown -R envsync:envsync /app

USER envsync

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=8 \
  CMD wget -q -O /dev/null http://127.0.0.1:4000/health

CMD ["bun", "run", "dist/entrypoint.enterprise.js"]
