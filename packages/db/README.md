# @halakabot/db

Shared database layer for HalakaBot using Convex.

## Setup

1. Create a Convex project at https://convex.dev
2. Install Convex CLI:
   ```bash
   bun add -g convex
   ```
3. Initialize Convex in the project:
   ```bash
   cd packages/db
   bunx convex dev
   ```
4. Follow the CLI prompts to authenticate and set up your project

## Usage

```typescript
import { api } from '@halakabot/db';
import { ConvexHttpClient } from '@halakabot/db';

const client = new ConvexHttpClient(process.env.CONVEX_URL!);

// Use Convex API
await client.mutation(api.storage.addUserToList, { chatId, postId, user });
```

## Database Schema

The database uses Convex for real-time data synchronization and includes:
- Message authors tracking
- User lists management
- Last list messages tracking
- Message classifications with AI integration
