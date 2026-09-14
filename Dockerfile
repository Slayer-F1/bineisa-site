FROM node:22-alpine
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
USER node
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/readyz || exit 1
CMD ["node", "server/index.js"]
