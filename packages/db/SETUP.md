# Database Setup Guide

## Quick Start

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose a name and password
   - Wait for project to be ready

2. **Run Schema Migration**
   - Open your Supabase project dashboard
   - Navigate to "SQL Editor" in the left sidebar
   - Click "New Query"
   - Copy the entire contents of `supabase/schema.sql`
   - Paste into the SQL editor
   - Click "Run" or press Cmd/Ctrl + Enter

3. **Get API Credentials**
   - Go to Settings > API
   - Copy your "Project URL" (SUPABASE_URL)
   - Copy your "anon public" key (SUPABASE_ANON_KEY)
   - Add these to your `.env` file

4. **Verify Setup**
   - Go to "Table Editor" in Supabase dashboard
   - You should see 4 tables:
     - `message_authors`
     - `user_lists`
     - `last_list_messages`
     - `message_classifications`

## Tables Overview

### message_authors
Stores information about message authors and their messages.
- Primary Key: (chat_id, post_id, message_id)
- Indexes: (chat_id, post_id)

### user_lists
Stores users who have been added to lists for specific posts.
- Primary Key: (chat_id, post_id, user_id)
- Indexes: (chat_id, post_id), (chat_id, post_id, position)

### last_list_messages
Tracks the last list message for each post.
- Primary Key: (chat_id, post_id)

### message_classifications
Stores AI classification results for messages.
- Primary Key: (chat_id, post_id, message_id)
- Indexes: (chat_id, post_id)

## Security Notes

- The `SUPABASE_ANON_KEY` is safe to use in client-side code
- Row Level Security (RLS) is not enabled by default
- For production, consider enabling RLS policies
- Keep your service role key secret (not needed for this app)

## Troubleshooting

**Error: "Missing Supabase credentials"**
- Make sure `.env` file exists in project root
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set
- Check for typos in variable names

**Error: "relation does not exist"**
- Schema migration wasn't run
- Go back to step 2 and run the schema.sql file

**Connection issues**
- Check your internet connection
- Verify Supabase project is active (not paused)
- Check Supabase status page for outages
