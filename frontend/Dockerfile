# syntax=docker/dockerfile:1

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Pin to the exact version declared in packageManager to avoid behaviour
# differences between pnpm releases.
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

WORKDIR /app

# Install dependencies (cached unless lockfile changes).
# --ignore-scripts is safe here: esbuild ≥ 0.17 ships its binary inside the
# platform package (@esbuild/linux-x64 etc.) and no longer needs an install
# script, so skipping all scripts avoids pnpm 11's build-approval prompt.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Build the production bundle
COPY . .
RUN pnpm build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Replace default nginx config with a SPA-friendly one
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy the built assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
