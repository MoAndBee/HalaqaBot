# Build stage - Use Bun to build the Vite application
FROM oven/bun:1 AS builder

# Set working directory
WORKDIR /app

# Copy root package.json and workspace configuration
COPY package.json ./
COPY packages/web/package.json ./packages/web/
COPY packages/db/package.json ./packages/db/

# Install dependencies (this will handle workspace dependencies)
RUN bun install --frozen-lockfile

# Copy source code for both web and db packages
COPY packages/web ./packages/web
COPY packages/db ./packages/db

# Copy environment file if it exists (optional)
COPY .env* ./ 2>/dev/null || true

# Generate convex dev deployment (needed for db package)
WORKDIR /app/packages/db
RUN bunx convex dev --once

# Build the web application
WORKDIR /app/packages/web
RUN bun run build

# Production stage - Use nginx to serve the static files
FROM nginx:alpine

# Copy built files from builder stage
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Copy nginx configuration for SPA routing
RUN echo 'server { \n\
    listen 80; \n\
    server_name _; \n\
    root /usr/share/nginx/html; \n\
    index index.html; \n\
    location / { \n\
        try_files $uri $uri/ /index.html; \n\
    } \n\
}' > /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
