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

# Generate convex dev deployment (needed for db package)
RUN bun -F @halakabot/db convex:dev

COPY packages/db/convex ./packages/db/

# Build the web application
WORKDIR /app/packages/web
RUN bun run build

# Production stage - Use nginx to serve the static files
FROM nginx:alpine

# Copy built files from builder stage
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Copy nginx configuration for SPA routing
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
