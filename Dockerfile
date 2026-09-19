FROM node:22-alpine
# Coolify's generated localhost probe uses curl. Alpine wget may try only ::1
# while the application listens on IPv4; curl can fall back to 127.0.0.1.
RUN apk add --no-cache curl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --chown=node:node server ./server
COPY --chown=node:node assets ./assets
COPY --chown=node:node auth ./auth
COPY --chown=node:node account ./account
COPY --chown=node:node legal ./legal
COPY --chown=node:node index.html company.html 404.html ./
ENV NODE_ENV=production HOST=0.0.0.0 PORT=80
RUN mkdir -p /app/artifacts/market-cache && chown -R node:node /app/artifacts
USER node
EXPOSE 80
# Keep research/account pages routable while market data is being configured.
# Monitor /readyz separately for provider configuration and cache readiness.
HEALTHCHECK --interval=30s --timeout=3s CMD curl --fail --silent --show-error --max-time 2 http://127.0.0.1:80/healthz || exit 1
CMD ["node", "server/index.js"]
