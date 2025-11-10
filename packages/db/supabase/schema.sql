-- HalakaBot Database Schema for Supabase

-- Message Authors Table
CREATE TABLE IF NOT EXISTS message_authors (
  chat_id BIGINT NOT NULL,
  post_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  first_name TEXT NOT NULL,
  username TEXT,
  message_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (chat_id, post_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_authors_chat_post ON message_authors(chat_id, post_id);

-- User Lists Table
CREATE TABLE IF NOT EXISTS user_lists (
  chat_id BIGINT NOT NULL,
  post_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  first_name TEXT NOT NULL,
  username TEXT,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (chat_id, post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_lists_chat_post ON user_lists(chat_id, post_id);
CREATE INDEX IF NOT EXISTS idx_user_lists_position ON user_lists(chat_id, post_id, position);

-- Last List Messages Table
CREATE TABLE IF NOT EXISTS last_list_messages (
  chat_id BIGINT NOT NULL,
  post_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (chat_id, post_id)
);

-- Message Classifications Table
CREATE TABLE IF NOT EXISTS message_classifications (
  chat_id BIGINT NOT NULL,
  post_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  contains_name BOOLEAN NOT NULL,
  detected_names JSONB,
  classified_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (chat_id, post_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_classifications_chat_post ON message_classifications(chat_id, post_id);
