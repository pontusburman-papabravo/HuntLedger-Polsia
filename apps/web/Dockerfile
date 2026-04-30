# Build stage
FROM node:20 AS builder
WORKDIR /app

# Vi kopierar in allt för att behålla monorepo-kontexten
COPY . .

# Gå in i web-mappen
WORKDIR /app/apps/web

# Tvinga installation av zod och andra beroenden lokalt så Rolldown hittar dem
RUN npm install zod --legacy-peer-deps
RUN npm install --include=dev --legacy-peer-deps --no-workspaces --install-links=true

# Ta emot build-args för API-URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Kör bygget
RUN ./node_modules/.bin/vite build

# Production stage
FROM node:20-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/apps/web/dist ./dist
EXPOSE 8080
CMD ["serve", "-s", "dist", "-l", "8080"]
