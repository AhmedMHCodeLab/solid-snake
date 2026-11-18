# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e
#
# SOLID SNAKE: one image serving the web app and the API on one port. The build stage compiles everything on a full
# Node image; the runtime image is a distroless Node base (no shell, no package manager, non-root) holding only the
# bundled server, the built web app and the runtime data. It works with a read-only root filesystem.
#
# Run:   docker run --rm -p 8080:8080 --read-only --cap-drop=ALL --security-opt no-new-privileges \
#          -e AUDIT_HMAC_KEY=<32+ chars> -v solidsnake-audit:/data solid-snake
# The signing key is never in the image: the server refuses to start without AUDIT_HMAC_KEY or AUDIT_HMAC_KEY_FILE.
#
# Bumping a base: resolve the new digest with `docker buildx imagetools inspect <tag>`, then scan the built image.

ARG NODE_IMAGE=node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee
ARG RUNTIME_IMAGE=gcr.io/distroless/nodejs22-debian13:nonroot@sha256:39c66687298417dbf3ff2fb8b6012c20554494e16414ef7afd07b9abbb45b501

# ---- build -----------------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
WORKDIR /src

# Dependencies first so this layer is cached until the lockfile changes. `npm ci` installs exactly the locked versions.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY tsconfig.json vite.config.ts ./
COPY shared ./shared
COPY scripts ./scripts
COPY data/geo ./data/geo
COPY server ./server
COPY web ./web

# Generates the synthetic data, type-checks, builds the web app and runs the size budget and the answer-leak check.
RUN npm run build

# Assemble exactly what runs: one self-contained server file (so the image needs no node_modules), the web app, and
# only the data files the API reads. The generator's answer file (ground-truth.json) is deliberately left behind.
RUN npx esbuild server/api/server.ts --bundle --platform=node --format=esm --target=node22 --legal-comments=none --outfile=/out/app/server.mjs \
 && cp -r dist /out/app/dist \
 && mkdir -p /out/app/data/generated /out/audit \
 && cp data/generated/case-a.json data/generated/case-b.json data/generated/case-c.json data/generated/case-d.json data/generated/feed.ndjson data/generated/connectors.json /out/app/data/generated/

# ---- runtime ---------------------------------------------------------------------------------------------------
# The pinned distroless base arrives as 22 layers. It is copied into an empty image as one, so the finished image has
# three layers (base, app, audit directory). Its few settings are restated below; they are the base's own.
FROM ${RUNTIME_IMAGE} AS base
FROM scratch

ARG VERSION=dev
ARG REVISION=unknown
ARG CREATED=unknown
LABEL org.opencontainers.image.title="SOLID SNAKE" \
      org.opencontainers.image.description="Telecom fraud intelligence platform demo on synthetic data. Not connected to any operator." \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${CREATED}"

COPY --from=base / /
COPY --from=build /out/app /app
# The only writable path: the audit log. Mount persistent storage here (-v name:/data). No VOLUME instruction, so a plain
# `docker run` does not leave anonymous volumes behind.
COPY --from=build --chown=65532:65532 /out/audit /data

ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
    NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    DATA_DIR=/app/data/generated \
    RUNTIME_DIR=/data \
    STATIC_DIR=/app/dist

WORKDIR /app
EXPOSE 8080
USER 65532:65532

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"]

# Exec form, so node is PID 1 and receives SIGTERM directly (the server handles it and exits 0).
ENTRYPOINT ["/nodejs/bin/node"]
CMD ["/app/server.mjs"]
