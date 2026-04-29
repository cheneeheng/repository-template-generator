# Stage 1: build frontend
FROM node:20-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: production app
FROM node:20-alpine AS app
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install --omit=dev
COPY backend/ ./
COPY --from=build /app/frontend/dist ../frontend/dist
EXPOSE 3001
CMD ["node", "index.js"]
