# Multi-stage build for TAAS backend

FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
COPY db ./db
RUN npm ci
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built artifacts and db assets
COPY --from=builder /app/dist ./dist
COPY db ./db

EXPOSE 4000
CMD ["node", "dist/server.js"]
