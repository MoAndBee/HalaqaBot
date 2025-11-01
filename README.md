# HalakaBot 🤖

A Telegram bot built with the [grammY](https://grammy.dev/) framework that monitors and collects messages from groups. All messages are stored in memory for analysis and statistics.

## Features ✨

- 📝 Monitors and stores all messages from Telegram groups
- 💾 In-memory storage with configurable limits
- 📊 Detailed statistics and analytics
- 🎯 Support for all message types (text, photos, videos, documents, etc.)
- 🛡️ Admin-only commands for sensitive operations
- ⚡ Built with Bun for blazing-fast performance
- 🔧 TypeScript for type safety

## Prerequisites 📋

- [Bun](https://bun.sh/) installed on your system
- A Telegram account
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

## Quick Start 🚀

### 1. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. Clone and Setup

```bash
git clone <your-repo-url>
cd HalakaBot
bun install
```

### 3. Create Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Save the bot token provided

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your bot token:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

### 5. Disable Privacy Mode

**Important:** The bot needs to access all messages in the group.

1. Open [@BotFather](https://t.me/BotFather)
2. Send `/mybots`
3. Select your bot
4. Go to **Bot Settings** → **Group Privacy**
5. **Turn OFF** Privacy Mode

### 6. Run the Bot

Development mode (with auto-reload):
```bash
bun run dev
```

Production mode:
```bash
bun run start
```

## Adding Bot to a Group 👥

1. Add your bot to a Telegram group
2. Make the bot an **admin** with at least these permissions:
   - Read messages
3. The bot will send a welcome message
4. Start chatting and the bot will collect messages!

## Available Commands 📋

- `/start` - Welcome message and setup instructions
- `/help` - Show help and available commands
- `/stats` - View detailed message statistics
- `/count` - Show message count for current chat
- `/clear` - Clear stored messages from memory (admin only)

## Configuration ⚙️

You can configure the bot using environment variables in `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Your bot token from @BotFather | *Required* |
| `MAX_STORED_MESSAGES` | Maximum messages to store in memory | `10000` |
| `ENABLE_LOGGING` | Enable detailed logging | `true` |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | `info` |

## Project Structure 📁

```
HalakaBot/
├── src/
│   ├── bot.ts                    # Main entry point
│   ├── config.ts                 # Configuration loader
│   ├── types.ts                  # TypeScript type definitions
│   ├── handlers/
│   │   ├── messageHandler.ts    # Message processing logic
│   │   └── commandHandler.ts    # Command handlers
│   ├── storage/
│   │   └── messageStore.ts      # In-memory message storage
│   ├── middleware/
│   │   ├── logger.ts            # Logging middleware
│   │   ├── adminCheck.ts        # Admin verification
│   │   └── errorHandler.ts     # Error handling
│   └── utils/
│       └── permissions.ts       # Permission utilities (future)
├── .env                         # Environment variables (create this)
├── .env.example                 # Environment template
├── package.json                 # Project dependencies
├── tsconfig.json                # TypeScript configuration
└── README.md                    # This file
```

## Development 🔧

### Scripts

- `bun run dev` - Start development server with hot reload
- `bun run start` - Start production server
- `bun run build` - Build for production

### Adding New Features

1. Create your handler/middleware in the appropriate directory
2. Import and register in `src/bot.ts`
3. Update types in `src/types.ts` if needed
4. Test thoroughly before deploying

## Storage & Memory 💾

- Messages are stored **in-memory only**
- Data is lost when the bot restarts
- Default limit: 10,000 messages (configurable)
- Implements circular buffer (oldest messages removed when limit reached)
- Memory usage displayed in `/stats` command

## Limitations ⚠️

- **In-memory storage**: Messages are lost on restart
- **Single instance**: Not designed for horizontal scaling
- **Privacy mode**: Must be disabled for the bot to see all messages
- **Admin required**: Bot must be admin to receive all messages

## Future Enhancements 🔮

- Persistent storage (SQLite/PostgreSQL/MongoDB)
- Message search and filtering
- Export to JSON/CSV
- Web dashboard
- Message analytics and insights
- Multi-bot support
- Backup and restore functionality

## Troubleshooting 🔍

### Bot not receiving messages

1. ✅ Check if bot is admin in the group
2. ✅ Ensure Privacy Mode is OFF in @BotFather
3. ✅ Verify bot token is correct in `.env`
4. ✅ Check bot logs for errors

### Bot crashes or restarts

1. Check memory usage with `/stats`
2. Reduce `MAX_STORED_MESSAGES` if needed
3. Review error logs
4. Ensure Bun is up to date

### Commands not working

1. Make sure commands start with `/`
2. For `/clear`, verify you're an admin
3. Check bot logs for error messages

## License 📄

[Add your license here]

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

## Support 💬

If you encounter any issues or have questions:
- Check the [grammY documentation](https://grammy.dev/)
- Review the logs for error messages
- Open an issue on GitHub

---

**Built with ❤️ using [grammY](https://grammy.dev/) and [Bun](https://bun.sh/)**
