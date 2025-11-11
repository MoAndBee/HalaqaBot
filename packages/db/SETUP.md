# Database Setup Guide

## Quick Start

1. **Install Convex CLI**
   ```bash
   bun add -g convex
   ```

2. **Initialize Convex**
   ```bash
   cd packages/db
   bunx convex dev
   ```
   - This will open your browser for authentication
   - Choose to create a new project or use an existing one
   - The CLI will automatically set up your schema

3. **Get Deployment URL**
   - After initialization, Convex will provide a deployment URL
   - Copy the `CONVEX_URL` displayed in the terminal
   - Add it to your `.env` file:
     ```
     CONVEX_URL=https://your-project.convex.cloud
     ```

4. **Verify Setup**
   - The Convex dev server will run and sync your schema
   - Open the Convex dashboard at https://dashboard.convex.dev
   - You should see your functions and data tables

## Database Schema

The Convex schema is defined in `convex/schema.ts` and includes:

### messageAuthors
Stores information about message authors and their messages.
- Indexed by: chatId, postId, messageId

### userLists
Stores users who have been added to lists for specific posts.
- Indexed by: chatId, postId, userId

### lastListMessages
Tracks the last list message for each post.
- Indexed by: chatId, postId

### messageClassifications
Stores AI classification results for messages.
- Indexed by: chatId, postId, messageId

## Benefits of Convex

- **Real-time by default**: Automatic subscription and live updates
- **TypeScript-first**: End-to-end type safety
- **Serverless functions**: Built-in backend functions and mutations
- **Automatic scaling**: No infrastructure management needed
- **Local development**: Full local dev environment with `convex dev`

## Troubleshooting

**Error: "CONVEX_URL not found"**
- Make sure `.env` file exists in project root
- Verify `CONVEX_URL` is set
- Check for typos in variable names

**Connection issues**
- Check your internet connection
- Run `bunx convex dev` to ensure the dev server is running
- Verify your Convex project is active in the dashboard

**Schema issues**
- Convex automatically validates and updates your schema
- Check the terminal output from `convex dev` for any schema errors
- Visit the dashboard to see the current schema state
