# Multi-stage: build the React app from its pnpm workspace, then serve it with nginx.
# Self-hosters never need Node locally — `docker compose up` builds everything.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --filter opengym-frontend...
COPY apps/web apps/web
COPY packages/ui packages/ui
RUN pnpm --filter opengym-frontend build

FROM nginx:alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
# exercise media (img/gif) is mounted at runtime from the media volume
