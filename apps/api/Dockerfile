FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
# better-sqlite3 normally downloads a prebuild; keep the compiler toolchain in
# the build stage so a new Node/Alpine ABI can fall back to node-gyp safely.
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
  && npm install \
  && apk del .build-deps
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev && npm cache clean --force

FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
