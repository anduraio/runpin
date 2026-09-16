FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
COPY web ./web
RUN npm run build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
# Optional vendor handler packages (docs/VENDOR-HANDLERS.md). A plain clone has
# none, so this is conditional and never writes package.json / package-lock.json.
COPY vendor ./vendor
RUN if ls vendor/*.tgz >/dev/null 2>&1; then \
      npm install --omit=dev --no-save --no-package-lock ./vendor/*.tgz; \
    else echo "no vendor packages"; fi
COPY --from=build /app/dist ./dist
COPY --from=build /app/web/dist ./web/dist
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "dist/api/index.js"]
