# Stage 1 — build the client
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY vite.config.js ./
COPY client ./client
RUN npm run build

# Stage 2 — lean runtime: Express serves dist + /api on $PORT
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/client/dist ./client/dist
# Persistent volume mount point for JSON data (see DEPLOY.md)
ENV DATA_DIR=/data
ENV PORT=8787
EXPOSE 8787
USER node
CMD ["node", "server/index.js"]
