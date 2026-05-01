FROM oven/bun:1-alpine AS dev
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
EXPOSE 3000
CMD ["bun", "run", "dev"]

FROM oven/bun:1-alpine AS production
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["bun", "index.js"]
