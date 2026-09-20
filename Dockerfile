# syntax=docker/dockerfile:1

# Debian slim rather than Alpine, deliberately.
#
# This image has to carry four packages with native binaries — lightningcss
# (through Tailwind v4), sharp, @node-rs/argon2 and Prisma's engines — and on
# musl each of them depends on a separate prebuild being published and
# correctly resolved. When one is not, the failure arrives as a missing `.node`
# file in the middle of `next build`, which reads like a code error and is not
# one. The glibc image costs about eighty megabytes and removes that class of
# problem entirely.

# ---------- deps ----------
FROM node:22-bookworm-slim AS deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# ---------- build ----------
FROM node:22-bookworm-slim AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Three steps, not one chain. A failure then names the command that failed
# instead of quoting a sixty-character shell line, and a change to application
# code no longer re-runs the client generation.
RUN npx prisma generate
RUN npm run build
RUN npm run worker:build

# The worker bundle carries this project's own code and resolves its packages
# the way the web app does. Pruning here leaves exactly the production tree the
# runner needs — Next's standalone output traces only what the *server* imports,
# and BullMQ, which reads its Lua command files from its own package directory,
# is not among them.
RUN npm prune --omit=dev

# ---------- runner ----------
FROM node:22-bookworm-slim AS runner
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -g 1001 nodejs \
 && useradd -u 1001 -g nodejs -M -s /usr/sbin/nologin nextjs
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/dist-worker ./dist-worker
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs
EXPOSE 3000
# Debian puts tini in /usr/bin; the Alpine package used /sbin.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
