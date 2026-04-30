FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
RUN npm install --legacy-peer-deps
COPY . .
RUN npm --workspace @huntledger/api run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/api/package*.json ./apps/api/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 8080
ENV PORT=8080
ENV HOST=0.0.0.0
CMD ["node", "dist/server.js"]
