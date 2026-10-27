FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS=--experimental-sqlite
COPY --from=build /app ./
EXPOSE 3000
CMD ["sh", "-c", "test -f data/atlas.db || node db/seed.mjs; exec node_modules/.bin/next start"]
