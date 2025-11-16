# Use official Bun image
FROM oven/bun:1 AS base

# Set working directory
WORKDIR /app

# Copy root package.json and workspace configuration
COPY package.json ./
COPY packages/bot/package.json ./packages/bot/
COPY packages/db/package.json ./packages/db/

# Install dependencies (this will handle workspace dependencies)
RUN bun install --frozen-lockfile

# Copy source code for both bot and db packages
COPY packages/bot ./packages/bot
COPY packages/db ./packages/db

# Set working directory to bot package
WORKDIR /app/packages/bot

# Expose port if needed (optional, remove if not using webhooks)
# EXPOSE 3000

# Start the bot
CMD ["bun", "start"]
