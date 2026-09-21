# syntax=docker/dockerfile:1

# Etapa 1 — compilación (PLAN §16.1)
FROM node:24-alpine AS build
RUN npm install -g pnpm@12.5.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG BUILD_ID=dev
ENV BUILD_ID=${BUILD_ID}
RUN pnpm build

# Etapa 2 — servidor de archivos estáticos, sin root, sin Node
FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
