ARG NODE_BASE_IMAGE=harbor.happyladysauce.local/knowledge-core/base/node:24.18.1-bookworm-slim@sha256:a09aabc645e86e81e23dab78e0c0f2eaa233cab4277c7188232181a1a8bd5d39

FROM ${NODE_BASE_IMAGE} AS deps

WORKDIR /app
ENV COREPACK_HOME=/tmp/corepack
RUN corepack enable && corepack install --global pnpm@10.31.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
ARG BUILD_CPU_PERCENT=75
ARG BUILD_JOBS
ENV BUILD_CPU_PERCENT=${BUILD_CPU_PERCENT} \
    BUILD_JOBS=${BUILD_JOBS}
COPY . .
RUN mkdir -p public && pnpm build

FROM ${NODE_BASE_IMAGE} AS runner

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    HOME=/tmp

RUN mkdir -p /app/.next/cache /tmp && chown -R node:node /app /tmp
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
