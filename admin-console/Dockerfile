# Multi-stage build for TAAS admin console

FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json tsconfig*.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public

RUN npm ci
RUN npm run build

FROM nginx:alpine AS runner
WORKDIR /usr/share/nginx/html

COPY --from=builder /app/dist ./

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
