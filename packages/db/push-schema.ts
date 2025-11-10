#!/usr/bin/env bun
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('   Please set SUPABASE_URL and SUPABASE_ANON_KEY');
  process.exit(1);
}

async function pushSchema() {
  console.log('🚀 Pushing schema to Supabase...\n');
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('📝 Creating tables...\n');

  // Create message_authors table
  console.log('[1/4] Creating message_authors table...');
  try {
    const { error } = await supabase.from('message_authors').select('*').limit(1);
    if (error && error.message.includes('does not exist')) {
      console.log('   ⚠️  Table does not exist - needs manual creation');
    } else {
      console.log('   ✅ Table exists');
    }
  } catch (e: any) {
    console.log(`   ⚠️  ${e.message}`);
  }

  // Create user_lists table
  console.log('[2/4] Creating user_lists table...');
  try {
    const { error } = await supabase.from('user_lists').select('*').limit(1);
    if (error && error.message.includes('does not exist')) {
      console.log('   ⚠️  Table does not exist - needs manual creation');
    } else {
      console.log('   ✅ Table exists');
    }
  } catch (e: any) {
    console.log(`   ⚠️  ${e.message}`);
  }

  // Create last_list_messages table
  console.log('[3/4] Creating last_list_messages table...');
  try {
    const { error } = await supabase.from('last_list_messages').select('*').limit(1);
    if (error && error.message.includes('does not exist')) {
      console.log('   ⚠️  Table does not exist - needs manual creation');
    } else {
      console.log('   ✅ Table exists');
    }
  } catch (e: any) {
    console.log(`   ⚠️  ${e.message}`);
  }

  // Create message_classifications table
  console.log('[4/4] Creating message_classifications table...');
  try {
    const { error } = await supabase.from('message_classifications').select('*').limit(1);
    if (error && error.message.includes('does not exist')) {
      console.log('   ⚠️  Table does not exist - needs manual creation');
    } else {
      console.log('   ✅ Table exists');
    }
  } catch (e: any) {
    console.log(`   ⚠️  ${e.message}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('📋 MANUAL SETUP REQUIRED');
  console.log('='.repeat(70));
  console.log('\nTo create the tables, follow these steps:\n');
  console.log('1. Open your Supabase dashboard:');
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  console.log(`   https://supabase.com/dashboard/project/${projectRef}/editor\n`);
  console.log('2. Click "SQL Editor" in the left sidebar\n');
  console.log('3. Click "New Query"\n');
  console.log('4. Copy the entire contents of: packages/db/supabase/schema.sql\n');
  console.log('5. Paste into the SQL editor\n');
  console.log('6. Click "Run" or press Cmd/Ctrl + Enter\n');
  console.log('7. Verify tables appear in "Table Editor"\n');
  console.log('='.repeat(70));
  
  // Read and display the schema
  const schemaPath = join(__dirname, 'supabase/schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  
  console.log('\n📄 Schema to copy:\n');
  console.log('─'.repeat(70));
  console.log(schema);
  console.log('─'.repeat(70));
}

pushSchema().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
