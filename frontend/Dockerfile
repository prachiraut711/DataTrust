# Multi-stage build for DataTrust frontend
FROM node:22-alpine AS builder

WORKDIR /app

# Build-time environment variable for Vite API target
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

# Copy dependency manifests
COPY package.json ./

# Install dependencies
RUN npm install

# Copy application sources
COPY . .

# Build application
RUN npm run build

# Production serving stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
