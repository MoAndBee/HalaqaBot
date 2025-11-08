# Design Document

## Overview

This design outlines the transformation of the HalakaBot project from a single-package application into a Bun monorepo with three distinct packages. The restructuring will enable code sharing between a Telegram bot and a web interface while maintaining clear separation of concerns. The monorepo will use Bun workspaces for dependency management and will consist of:

1. **@halakabot/db** - Shared database layer with SQLite operations
2. **@halakabot/bot** - Telegram bot using Grammy framework
3. **@halakabot/web** - TanStack Start web application with drag-and-drop UI

## Architecture

### Monorepo Structure

```
halakabot/
├── package.json                 # Root workspace configuration
├── bun.lock                     # Lockfile for all packages
├── tsconfig.json                # Base TypeScript config
├── .env                         # Environment variables
├── .gitignore
├── README.md
└── packages/
    ├── db/                      # Database package
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/
    │   │   ├── index.ts         # Main export
    │   │   ├── storage.service.ts
    │   │   └── types.ts
    │   └── README.md
    ├── bot/                     # Bot package
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── config/
    │   │   ├── handlers/
    │   │   └── services/
    │   ├── data/                # SQLite database files
    │   └── README.md
    └── web/                     # Web package
        ├── package.json
        ├── tsconfig.json
        ├── app/                 # TanStack Start app directory
        │   ├── routes/
        │   │   ├── __root.tsx
        │   │   ├── index.tsx    # Posts list
        │   │   └── posts.$postId.tsx  # Post detail with drag-drop
        │   ├── components/
        │   │   ├── PostsList.tsx
        │   │   ├── UserList.tsx
        │   │   └── DraggableUser.tsx
        │   ├── router.tsx
        │   └── ssr.tsx
        ├── public/
        └── README.md
```

### Dependency Graph

```mermaid
graph TD
    A[Root Workspace] --> B[@halakabot/db]
    A --> C[@halakabot/bot]
    A --> D[@halakabot/web]
    C --> B
    D --> B
    C --> E[grammy]
    C --> F[@ai-sdk/groq]
    D --> G[TanStack Start]
    D --> H[@dnd-kit/core]
```

## Components and Interfaces

### 1. DB Package (@halakabot/db)

The database package provides a shared data access layer for both bot and web packages.

#### Exports

```typescript
// packages/db/src/index.ts
export { StorageService } from './storage.service';
export type { User, MessageAuthor, UserListEntry, Classification } from './types';
```

#### StorageService Interface

```typescript
class StorageService {
  constructor(dbPath: string);
  
  // Message Authors
  addMessageAuthor(chatId: number, postId: number, messageId: number, user: User, messageText?: string): void;
  getMessageAuthor(chatId: number, postId: number, messageId: number): User | null;
  getPostIdForMessage(chatId: number, messageId: number): number | null;
  
  // User Lists
  addUserToList(chatId: number, postId: number, user: User): boolean;
  getUserList(chatId: number, postId: number): User[];
  updateUserPosition(chatId: number, postId: number, userId: number, newPosition: number): void;
  clearUserList(chatId: number, postId: number): void;
  
  // Posts
  getAllPosts(): Array<{ chatId: number; postId: number; userCount: number }>;
  getPostDetails(chatId: number, postId: number): { userCount: number; messageCount: number } | null;
  
  // Last List Messages
  setLastListMessage(chatId: number, postId: number, messageId: number): void;
  getLastListMessage(chatId: number, postId: number): number | null;
  clearLastListMessage(chatId: number, postId: number): void;
  
  // Classifications
  storeClassification(chatId: number, postId: number, messageId: number, containsName: boolean, detectedNames: string[]): void;
  getClassification(chatId: number, postId: number, messageId: number): Classification | null;
  getUnclassifiedMessages(chatId: number, postId: number): Array<{ messageId: number; text: string; user: User }>;
  
  close(): void;
}
```

#### New Methods for Web Package

The StorageService will be extended with new methods to support the web interface:

```typescript
// Get all unique posts across all chats
getAllPosts(): Array<{ chatId: number; postId: number; userCount: number }>;

// Update user position for drag-and-drop
updateUserPosition(chatId: number, postId: number, userId: number, newPosition: number): void;

// Get post metadata
getPostDetails(chatId: number, postId: number): { userCount: number; messageCount: number } | null;
```

### 2. Bot Package (@halakabot/bot)

The bot package contains all Telegram bot logic and imports the db package for data persistence.

#### Structure

- **config/** - Environment configuration
- **handlers/** - Grammy event handlers (message, reaction, auto-classify)
- **services/** - Bot-specific services (MessageService, UserListService, ClassificationService)
- **index.ts** - Bot initialization and startup

#### Key Changes

- Import `StorageService` from `@halakabot/db`
- Remove local storage.service.ts
- Update all imports to use the db package
- Maintain all existing bot functionality

#### Dependencies

```json
{
  "dependencies": {
    "@halakabot/db": "workspace:*",
    "grammy": "^1.30.0",
    "@ai-sdk/groq": "^2.0.28",
    "ai": "^5.0.89"
  }
}
```

### 3. Web Package (@halakabot/web)

The web package is a TanStack Start application that provides a UI for viewing and managing posts and user lists.

#### Technology Stack

- **TanStack Start** - Full-stack React framework with file-based routing
- **TanStack Router** - Type-safe routing
- **@dnd-kit/core** - Drag-and-drop functionality
- **@dnd-kit/sortable** - Sortable list utilities
- **Tailwind CSS** - Styling (from Trellaux example)

#### Routes

**1. Index Route (`/`)**
- Lists all posts with their IDs and user counts
- Clickable cards that navigate to post detail
- Shows empty state if no posts exist

**2. Post Detail Route (`/posts/$postId`)**
- Displays user list for the selected post
- Implements drag-and-drop reordering
- Shows user first name and username
- Back button to return to posts list

#### Components

**PostsList Component**
```typescript
interface PostsListProps {
  posts: Array<{ chatId: number; postId: number; userCount: number }>;
}

// Displays grid of post cards
// Each card shows post ID and user count
// Clicking navigates to /posts/:postId
```

**UserList Component**
```typescript
interface UserListProps {
  chatId: number;
  postId: number;
  users: User[];
  onReorder: (userId: number, newPosition: number) => Promise<void>;
}

// Renders sortable list of users
// Integrates with @dnd-kit for drag-and-drop
// Calls onReorder when user is dropped
```

**DraggableUser Component**
```typescript
interface DraggableUserProps {
  user: User;
  index: number;
}

// Individual draggable user item
// Shows position number, first name, and username
// Provides drag handle and visual feedback
```

#### API Layer

The web package will use TanStack Start's server functions for data access:

```typescript
// app/api/posts.ts
import { createServerFn } from '@tanstack/start';
import { StorageService } from '@halakabot/db';

const storage = new StorageService('../../bot/data/bot.sqlite');

export const getPosts = createServerFn('GET', async () => {
  return storage.getAllPosts();
});

export const getPostUsers = createServerFn('GET', async (postId: number) => {
  // Extract chatId from post context or use default
  return storage.getUserList(chatId, postId);
});

export const updateUserPosition = createServerFn('POST', async ({
  chatId,
  postId,
  userId,
  newPosition
}: {
  chatId: number;
  postId: number;
  userId: number;
  newPosition: number;
}) => {
  storage.updateUserPosition(chatId, postId, userId, newPosition);
  return { success: true };
});
```

## Data Models

### User

```typescript
interface User {
  id: number;
  first_name: string;
  username?: string;
}
```

### Post (New)

```typescript
interface Post {
  chatId: number;
  postId: number;
  userCount: number;
}
```

### UserListEntry (Enhanced)

```typescript
interface UserListEntry {
  chatId: number;
  postId: number;
  userId: number;
  firstName: string;
  username?: string;
  position: number;
}
```

## Database Schema Updates

The existing schema will be extended with a new method for efficient post retrieval:

```sql
-- New query for getAllPosts()
SELECT DISTINCT 
  ul.chat_id,
  ul.post_id,
  COUNT(ul.user_id) as user_count
FROM user_lists ul
GROUP BY ul.chat_id, ul.post_id
ORDER BY ul.chat_id, ul.post_id DESC;
```

The `updateUserPosition` method will handle reordering:

```sql
-- Update single user position
UPDATE user_lists 
SET position = ? 
WHERE chat_id = ? AND post_id = ? AND user_id = ?;

-- Shift other users' positions
UPDATE user_lists 
SET position = position + 1 
WHERE chat_id = ? AND post_id = ? AND position >= ? AND user_id != ?;
```

## Error Handling

### DB Package

- Database connection errors: Log and throw with descriptive messages
- Invalid queries: Validate parameters before execution
- Transaction failures: Rollback and report error state

### Bot Package

- Maintain existing error handling patterns
- Wrap db package calls in try-catch blocks
- Log errors to console with context

### Web Package

- API errors: Display user-friendly error messages
- Network failures: Show retry options
- Drag-and-drop failures: Revert UI state and notify user
- Use TanStack Router's error boundaries for route-level errors

## Testing Strategy

### DB Package

- Unit tests for StorageService methods
- Test database initialization and schema creation
- Test CRUD operations for all entities
- Test new methods: `getAllPosts()`, `updateUserPosition()`
- Use in-memory SQLite for fast test execution

### Bot Package

- Integration tests for handlers with mocked Grammy context
- Test service layer with real db package
- Mock external APIs (Telegram, Groq)
- Verify existing functionality remains intact after refactor

### Web Package

- Component tests for PostsList, UserList, DraggableUser
- Test drag-and-drop interactions with @testing-library/react
- Test server functions with mocked StorageService
- E2E tests for critical user flows (view posts, reorder users)

## Migration Strategy

### Phase 1: Create Monorepo Structure

1. Create `packages/` directory
2. Set up root `package.json` with workspace configuration
3. Create package directories: `db/`, `bot/`, `web/`

### Phase 2: Extract DB Package

1. Move `storage.service.ts` and `types/index.ts` to `packages/db/src/`
2. Create `packages/db/package.json`
3. Add new methods: `getAllPosts()`, `updateUserPosition()`
4. Export all types and StorageService from `packages/db/src/index.ts`

### Phase 3: Migrate Bot Package

1. Move existing `src/` to `packages/bot/src/`
2. Update imports to use `@halakabot/db`
3. Remove local storage.service.ts
4. Move `data/` directory to `packages/bot/data/`
5. Update environment config to reference correct paths
6. Test bot functionality

### Phase 4: Bootstrap Web Package

1. Use gitpick to fetch TanStack Start Trellaux example
2. Extract relevant files to `packages/web/`
3. Install dependencies
4. Configure to import `@halakabot/db`
5. Remove Trellaux-specific code

### Phase 5: Implement Web Features

1. Create posts list route and component
2. Create post detail route with user list
3. Implement drag-and-drop with @dnd-kit
4. Create server functions for data access
5. Style with Tailwind CSS

### Phase 6: Testing and Documentation

1. Write tests for all packages
2. Update README files for each package
3. Create root README with monorepo instructions
4. Document development workflow

## Development Workflow

### Running the Monorepo

```bash
# Install all dependencies
bun install

# Run bot in development
bun --filter @halakabot/bot dev

# Run web app in development
bun --filter @halakabot/web dev

# Run both simultaneously
bun run dev:all
```

### Building

```bash
# Build all packages
bun run build

# Build specific package
bun --filter @halakabot/db build
```

### Environment Variables

The bot package will continue to use `.env` at the root level. The web package will share the same database path but won't need bot-specific credentials.

## Security Considerations

- Database file access: Ensure proper file permissions
- Web API: Consider adding authentication for production use
- Environment variables: Keep sensitive data in `.env` and out of version control
- SQL injection: Use parameterized queries (already implemented)

## Performance Considerations

- Database: SQLite is sufficient for current scale; consider PostgreSQL for high traffic
- Web app: Use TanStack Router's data loading for efficient data fetching
- Drag-and-drop: Debounce position updates to reduce database writes
- Caching: Consider caching post list in web app to reduce database queries

## Future Enhancements

- Real-time updates using WebSockets or Server-Sent Events
- User authentication and authorization for web app
- Bulk operations (delete multiple users, clear lists)
- Export user lists to CSV or other formats
- Analytics dashboard showing post engagement metrics
- Mobile-responsive design improvements
