# HalakaBot

A Telegram bot built with [Grammy](https://grammy.dev/) and [Bun](https://bun.sh/) that listens to message reactions and manages user lists with Convex.

## Prerequisites

- [Bun](https://bun.sh/) installed on your system
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A [Convex](https://convex.dev) account and project

## Setup

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone <your-repo-url>
   cd halakabot
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Set up Convex**:
   - Install Convex CLI: `bun add -g convex`
   - Initialize Convex: `cd packages/db && bunx convex dev`
   - Follow the CLI prompts to authenticate and create a project
   - See `packages/db/SETUP.md` for detailed instructions

4. **Get a bot token from BotFather**:
   - Open Telegram and search for [@BotFather](https://t.me/BotFather)
   - Send `/newbot` and follow the instructions
   - Copy the bot token you receive

5. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and add your credentials:
   ```
   BOT_TOKEN=your_actual_bot_token_here
   CONVEX_URL=your_convex_deployment_url
   ```

6. **Enable reactions for your bot** (Important!):
   - Go to [@BotFather](https://t.me/BotFather)
   - Send `/mybots`
   - Select your bot
   - Go to "Bot Settings" → "Group Privacy"
   - Disable privacy mode (or add the bot as an admin) to receive reaction updates

## Running the Bot

Start the bot in development mode:
```bash
bun run dev
```

Or use:
```bash
bun start
```

The bot will start and log "Bot @your_bot_name is running!" when ready.

## Features

- Listens to individual message reactions (`message_reaction` updates)
- Listens to reaction count updates (`message_reaction_count` updates)
- Logs all reaction data to the console with details about:
  - User who reacted
  - Chat information
  - Old and new reactions
  - Timestamps

## Testing

1. Add your bot to a Telegram chat or group
2. Send a message in the chat
3. Add a reaction to the message
4. Check your console to see the logged reaction data

## Deployment & CI/CD

### Setting up CI/CD (Netlify, Vercel, etc.)

The project uses Convex for the database, which requires deploying functions before building. The build process automatically handles this.

**Required Environment Variables for CI:**
- `CONVEX_DEPLOY_KEY` - Deploy key from your Convex dashboard
- `CONVEX_URL` - Your Convex deployment URL
- `BOT_TOKEN` - Your Telegram bot token

**Getting your Convex Deploy Key:**
1. Go to your Convex dashboard: https://dashboard.convex.dev
2. Select your project
3. Go to Settings > Deploy Keys
4. Generate a new deploy key
5. Add it to your CI environment variables as `CONVEX_DEPLOY_KEY`

**Build Command:**
```bash
bun run build
```

This will:
1. Deploy Convex functions (generates TypeScript types)
2. Build the database package
3. Build the bot package
4. Build the web package

## Project Structure

```
halakabot/
├── src/
│   └── index.ts          # Main bot implementation
├── .env                  # Environment variables (create from .env.example)
├── .env.example          # Example environment variables
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

## Technologies

- **Bun**: Fast JavaScript runtime
- **Grammy**: Telegram bot framework
- **TypeScript**: Type-safe development
