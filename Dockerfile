# syntax=docker/dockerfile:1

# Etapa 1 — compilación del cliente y de la API (PLAN §16.1, §24.1)
FROM node:24-alpine AS build
RUN npm install -g pnpm@12.5.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG BUILD_ID=dev
ENV BUILD_ID=${BUILD_ID}
RUN pnpm build && pnpm build:server

# API de tableros: un solo archivo, sin node_modules, sin npm, sin root.
FROM node:24-alpine AS api
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
 && mkdir -p /data \
 && chown node:node /data
WORKDIR /app
COPY --from=build /app/dist-server/server.js ./server.js
USER node
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]

# Web: nginx sin privilegios con los estáticos y el proxy de /api. Va última para que
# `docker build .` siga dando esta imagen.
FROM nginxinc/nginx-unprivileged:1.29-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
