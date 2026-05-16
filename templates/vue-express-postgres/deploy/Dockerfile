FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend .
RUN npm run build

FROM node:20-alpine AS backend-build
WORKDIR /backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci
COPY backend .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=backend-build /backend/package.json ./
COPY --from=backend-build /backend/node_modules ./node_modules
COPY --from=backend-build /backend/dist ./dist
COPY --from=frontend-build /frontend/dist ./public

ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", "dist/index.js"]
