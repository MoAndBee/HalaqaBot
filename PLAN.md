# HalakaBot - Telegram Bot Development Plan

## Overview
Build a Telegram bot using the grammY framework that monitors group messages and stores them in memory.

## Requirements
- Bot must be added as an admin to a Telegram group
- Listen to all messages in the group
- Collect and store messages in memory
- Use grammY framework for Telegram API interactions
- Use **Bun** as the JavaScript runtime (faster than Node.js with built-in TypeScript support)

---

## Implementation Plan

### Phase 1: Project Setup

#### 1.1 Initialize Bun Project
- Initialize with `bun init` to create `package.json`
- Set up TypeScript (Bun has built-in TypeScript support, no compilation needed)
- Configure `tsconfig.json` for IDE support and type checking
- Add development scripts

#### 1.2 Install Dependencies
- **Core dependencies:**
  - `grammy` - Telegram Bot framework

- **Development dependencies:**
  - `@types/bun` - Bun type definitions (optional, for better IDE support)

**Note:** Bun has built-in support for:
- TypeScript execution (no tsx/ts-node needed)
- Environment variables (auto-loads .env files, no dotenv needed)
- Fast package installation (replaces npm/yarn)
- Hot reloading with `--watch` flag (no nodemon needed)

#### 1.3 Environment Configuration
- Create `.env.example` template file
- Add `TELEGRAM_BOT_TOKEN` variable
- Document how to obtain bot token from @BotFather

---

### Phase 2: Bot Core Implementation

#### 2.1 Basic Bot Structure
- Create `src/` directory for source code
- Create `src/bot.ts` - Main bot entry point
- Create `src/config.ts` - Configuration loader
- Create `src/types.ts` - TypeScript type definitions

#### 2.2 Message Storage System
- Create `src/storage/messageStore.ts`
- Implement in-memory message storage using:
  - Array or Map data structure
  - Message interface with fields:
    - `messageId`: number
    - `chatId`: number
    - `userId`: number
    - `userName`: string (optional)
    - `text`: string
    - `date`: Date
    - `messageType`: 'text' | 'photo' | 'video' | 'document' | 'audio' | etc.
- Add methods:
  - `addMessage(message)` - Store a new message
  - `getMessages(chatId?)` - Retrieve messages (optionally filtered by chat)
  - `getMessageCount(chatId?)` - Get count of stored messages
  - `clearMessages(chatId?)` - Clear messages from memory

#### 2.3 Bot Event Handlers
- Create `src/handlers/messageHandler.ts`
- Implement handler to:
  - Listen to all message types (text, photos, videos, documents, etc.)
  - Extract relevant message data
  - Store messages using messageStore
  - Handle errors gracefully

#### 2.4 Admin and Permission Checks
- Create `src/utils/permissions.ts`
- Implement function to check if bot is admin in group
- Add validation to ensure bot has necessary permissions:
  - Read messages
  - Receive all group messages (privacy mode OFF)

---

### Phase 3: Bot Features

#### 3.1 Command Handlers
Create `src/handlers/commandHandler.ts` with commands:
- `/start` - Welcome message and instructions
- `/help` - Display available commands
- `/stats` - Show statistics (total messages, storage info)
- `/count` - Show message count for current chat
- `/clear` - Clear messages from memory (admin only)

#### 3.2 Middleware
Create `src/middleware/`:
- `logger.ts` - Log all incoming updates
- `adminCheck.ts` - Verify admin permissions for sensitive commands
- `errorHandler.ts` - Global error handling

#### 3.3 Group Management
- Detect when bot is added to a group
- Send welcome message with setup instructions
- Verify bot has admin permissions
- Handle privacy mode warnings

---

### Phase 4: Testing & Documentation

#### 4.1 Documentation
- Update `README.md` with:
  - Project description
  - Setup instructions
  - How to obtain Telegram bot token
  - How to add bot as admin to a group
  - How to disable privacy mode
  - Available commands
  - Environment variables

#### 4.2 Testing Checklist
- Bot connects successfully with valid token
- Bot receives messages in groups where it's admin
- Messages are stored correctly in memory
- Commands work as expected
- Error handling works properly
- Bot handles different message types

---

### Phase 5: Deployment Preparation

#### 5.1 Production Configuration
- Add production-ready logging
- Configure process management (PM2, systemd, or Bun's built-in process management)
- Add graceful shutdown handling
- Implement memory management warnings
- Consider using `bun --smol` for reduced memory usage in production

#### 5.2 Deployment Options
- Document deployment to:
  - VPS (Ubuntu/Debian)
  - Docker container
  - Cloud platforms (Railway, Heroku, etc.)

---

## Project Structure

```
HalakaBot/
├── src/
│   ├── bot.ts              # Main entry point
│   ├── config.ts           # Configuration loader
│   ├── types.ts            # TypeScript types
│   ├── handlers/
│   │   ├── messageHandler.ts   # Message handling logic
│   │   └── commandHandler.ts   # Command handling logic
│   ├── storage/
│   │   └── messageStore.ts     # In-memory message storage
│   ├── middleware/
│   │   ├── logger.ts           # Logging middleware
│   │   ├── adminCheck.ts       # Admin verification
│   │   └── errorHandler.ts     # Error handling
│   └── utils/
│       └── permissions.ts      # Permission checking utilities
├── .env                    # Environment variables (git-ignored)
├── .env.example            # Environment template
├── .gitignore             # Git ignore rules
├── package.json           # Project dependencies
├── bun.lockb              # Bun lock file (binary format)
├── tsconfig.json          # TypeScript configuration
├── README.md              # Project documentation
└── PLAN.md               # This file
```

---

## Technical Considerations

### Memory Management
- In-memory storage is volatile (data lost on restart)
- Consider memory limits for large groups
- Implement optional message limit/rotation
- Future: Add persistent storage option (database)

### Privacy Mode
- Bot must have privacy mode disabled to receive all messages
- Configure via @BotFather → Bot Settings → Group Privacy → Turn OFF
- Document this requirement clearly

### Admin Permissions
Bot needs these admin permissions:
- Read messages
- (Optional) Delete messages if implementing moderation features

### Error Handling
- Handle network errors (Telegram API downtime)
- Handle rate limiting
- Log errors for debugging
- Graceful degradation

---

## Future Enhancements

### Potential Features (Post-MVP)
1. Persistent storage (SQLite, PostgreSQL, MongoDB)
2. Message search and filtering
3. Export messages to JSON/CSV
4. Message analytics and insights
5. Multi-group support with separate storage
6. User activity tracking
7. Keyword/phrase monitoring
8. Web dashboard for viewing messages
9. Message retention policies
10. Backup and restore functionality

---

## Implementation Timeline

- **Phase 1**: 1-2 hours (Setup)
- **Phase 2**: 2-3 hours (Core Implementation)
- **Phase 3**: 1-2 hours (Features)
- **Phase 4**: 1 hour (Testing & Docs)
- **Phase 5**: 1 hour (Deployment)

**Total Estimated Time**: 6-9 hours

---

## Getting Started

After creating this plan, follow these steps:
1. Initialize the project (Phase 1)
2. Obtain bot token from @BotFather
3. Implement core functionality (Phase 2)
4. Add features and commands (Phase 3)
5. Test thoroughly (Phase 4)
6. Deploy and monitor (Phase 5)

---

*Last Updated: 2025-11-01*
