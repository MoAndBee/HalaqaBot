# Implementation Plan

- [x] 1. Set up monorepo structure and workspace configuration
  - Create `packages/` directory with subdirectories for `db`, `bot`, and `web`
  - Create root `package.json` with Bun workspace configuration
  - Update root `tsconfig.json` to support workspace references
  - Create base `tsconfig.json` files for each package
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Extract and create the DB package
  - [x] 2.1 Create DB package structure and configuration
    - Create `packages/db/package.json` with package metadata and exports
    - Create `packages/db/tsconfig.json` extending root config
    - Create `packages/db/src/index.ts` as main export file
    - _Requirements: 2.1, 2.2, 2.5_
  
  - [x] 2.2 Move storage service to DB package
    - Move `src/services/storage.service.ts` to `packages/db/src/storage.service.ts`
    - Move `src/types/index.ts` to `packages/db/src/types.ts`
    - Export StorageService and types from `packages/db/src/index.ts`
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 2.3 Add new methods for web package support
    - Implement `getAllPosts()` method to retrieve all unique posts with user counts
    - Implement `updateUserPosition()` method for drag-and-drop reordering
    - Implement `getPostDetails()` method for post metadata
    - _Requirements: 2.3, 2.4, 7.4_
  
  - [ ]* 2.4 Write unit tests for DB package
    - Create test file for StorageService with in-memory SQLite
    - Test CRUD operations for message authors, user lists, and classifications
    - Test new methods: getAllPosts, updateUserPosition, getPostDetails
    - _Requirements: 2.3, 2.4_

- [x] 3. Migrate bot code to bot package
  - [x] 3.1 Create bot package structure
    - Create `packages/bot/package.json` with dependencies including `@halakabot/db`
    - Create `packages/bot/tsconfig.json` extending root config
    - Move `data/` directory to `packages/bot/data/`
    - _Requirements: 3.1, 3.4, 1.4_
  
  - [x] 3.2 Move bot source code
    - Move `src/` directory contents to `packages/bot/src/`
    - Remove `src/services/storage.service.ts` (now in db package)
    - Remove `src/types/index.ts` (now in db package)
    - _Requirements: 3.1, 3.3_
  
  - [x] 3.3 Update bot imports to use DB package
    - Update all imports of StorageService to `@halakabot/db`
    - Update all type imports to `@halakabot/db`
    - Update database path references in services
    - Verify all handlers and services compile without errors
    - _Requirements: 3.2, 3.3, 3.5_
  
  - [ ]* 3.4 Test bot functionality after migration
    - Run bot in development mode
    - Verify reaction handling works correctly
    - Verify message handling and classification work correctly
    - Test auto-classify command
    - _Requirements: 3.3, 3.5_

- [ ] 4. Bootstrap web package with TanStack Start
  - [ ] 4.1 Fetch and set up TanStack Start Trellaux example
    - Use gitpick to fetch TanStack Router Trellaux example
    - Extract relevant files to `packages/web/` directory
    - Create `packages/web/package.json` with TanStack Start dependencies
    - Add `@halakabot/db` as a dependency
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ] 4.2 Configure web package for the project
    - Create `packages/web/tsconfig.json` extending root config
    - Set up Tailwind CSS configuration
    - Remove Trellaux-specific code and components
    - Configure TanStack Start with proper base paths
    - _Requirements: 4.2, 4.3, 4.5_
  
  - [ ] 4.3 Create basic app structure and routing
    - Create `app/routes/__root.tsx` with base layout
    - Create `app/router.tsx` for router configuration
    - Set up basic styling and theme
    - _Requirements: 4.2, 4.3_

- [ ] 5. Implement posts list view
  - [ ] 5.1 Create server function for fetching posts
    - Create `app/api/posts.ts` with server function using StorageService
    - Implement `getPosts()` server function calling `storage.getAllPosts()`
    - Handle errors and return properly typed data
    - _Requirements: 5.1, 5.2, 2.4_
  
  - [ ] 5.2 Create posts list route and component
    - Create `app/routes/index.tsx` for posts list route
    - Create `app/components/PostsList.tsx` component
    - Fetch posts data using server function
    - Display posts as clickable cards with post ID and user count
    - Implement empty state when no posts exist
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ] 5.3 Style posts list with Tailwind CSS
    - Create responsive grid layout for post cards
    - Add hover effects and visual feedback
    - Style empty state message
    - _Requirements: 5.1, 5.3_

- [ ] 6. Implement post detail view with user list
  - [ ] 6.1 Create server functions for post details
    - Create `getPostUsers()` server function in `app/api/posts.ts`
    - Implement function to fetch user list for specific post
    - Create `updateUserPosition()` server function for reordering
    - _Requirements: 6.2, 6.3, 7.4_
  
  - [ ] 6.2 Create post detail route
    - Create `app/routes/posts.$postId.tsx` for post detail route
    - Fetch post users data using server function
    - Display post ID and user count in header
    - Add back button to navigate to posts list
    - _Requirements: 6.1, 6.2, 6.5_
  
  - [ ] 6.3 Create UserList component
    - Create `app/components/UserList.tsx` component
    - Display ordered list of users with position numbers
    - Show user first name and username (if available)
    - Format display similar to bot's Arabic numbering style
    - _Requirements: 6.2, 6.3, 6.4_

- [ ] 7. Implement drag-and-drop functionality
  - [ ] 7.1 Install and configure dnd-kit
    - Add `@dnd-kit/core` and `@dnd-kit/sortable` dependencies
    - Set up DndContext in UserList component
    - Configure sensors for mouse and touch interactions
    - _Requirements: 7.1, 7.2_
  
  - [ ] 7.2 Create DraggableUser component
    - Create `app/components/DraggableUser.tsx` component
    - Implement useSortable hook for drag-and-drop
    - Add drag handle and visual feedback during drag
    - Style dragging and drop states
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ] 7.3 Implement reordering logic
    - Handle onDragEnd event in UserList component
    - Calculate new position based on drop location
    - Call updateUserPosition server function with new position
    - Update local state optimistically for immediate feedback
    - Handle errors and revert state if update fails
    - _Requirements: 7.3, 7.4, 7.5_
  
  - [ ]* 7.4 Test drag-and-drop interactions
    - Test dragging users to different positions
    - Verify position updates persist to database
    - Test error handling when update fails
    - Verify UI updates correctly after reorder
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 8. Configure monorepo scripts and finalize setup
  - [ ] 8.1 Create root-level development scripts
    - Add `dev:bot` script to run bot package
    - Add `dev:web` script to run web package
    - Add `dev:all` script to run both packages concurrently
    - Add `build` script to build all packages
    - _Requirements: 8.1, 8.2, 8.3, 8.5_
  
  - [ ] 8.2 Update environment configuration
    - Ensure `.env` file is accessible to both packages
    - Update bot config to use correct database path
    - Configure web package to access shared database
    - _Requirements: 3.5, 4.4_
  
  - [ ] 8.3 Create package-specific README files
    - Create `packages/db/README.md` documenting the DB package API
    - Create `packages/bot/README.md` with bot setup instructions
    - Create `packages/web/README.md` with web app setup instructions
    - Update root `README.md` with monorepo overview and workflow
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ] 8.4 Clean up old files and verify structure
    - Remove old `src/` directory from root
    - Remove old `data/` directory from root
    - Verify all imports resolve correctly
    - Run `bun install` to ensure all dependencies are installed
    - Test that both bot and web packages start successfully
    - _Requirements: 1.1, 1.2, 1.5, 8.5_
