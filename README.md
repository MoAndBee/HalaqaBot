# HalakaBot

A Telegram bot built with [Grammy](https://grammy.dev/) and [Bun](https://bun.sh/) that listens to message reactions and manages user lists with Supabase.

## Prerequisites

- [Bun](https://bun.sh/) installed on your system
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A [Supabase](https://supabase.com) account and project

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

3. **Set up Supabase**:
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to the SQL Editor in your Supabase dashboard
   - Copy and run the schema from `packages/db/supabase/schema.sql`
   - Get your project URL and anon key from Settings > API

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
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
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
