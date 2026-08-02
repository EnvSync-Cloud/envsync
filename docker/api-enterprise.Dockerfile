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

RUN addgroup -S envsync && adduser -S envsync -G envsync

COPY --from=build /app/packages/envsync-api/dist/entrypoint.enterprise.js ./dist/entrypoint.enterprise.js
COPY --from=build /app/packages/envsync-api/dist/templates ./dist/templates
COPY --from=build /app/packages/envsync-api/dist/libs ./dist/libs
COPY --from=build /app/packages/envsync-api/dist/assets ./dist/assets
COPY --from=build /app/packages/envsync-api/package.json ./package.json

RUN chown -R envsync:envsync /app

USER envsync

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["bun", "run", "dist/entrypoint.enterprise.js"]
