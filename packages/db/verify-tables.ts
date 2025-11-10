#!/usr/bin/env bun
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

async function verifyTables() {
  console.log('🔍 Verifying Supabase tables...\n');
  console.log(`📍 Project: ${supabaseUrl}\n`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  const tables = [
    'message_authors',
    'user_lists', 
    'last_list_messages',
    'message_classifications'
  ];

  let allExist = true;

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
        if (error.message.includes('does not exist') || error.message.includes('relation')) {
          allExist = false;
        }
      } else {
        console.log(`✅ ${table}: exists (${count || 0} rows)`);
      }
    } catch (e: any) {
      console.log(`❌ ${table}: ${e.message}`);
      allExist = false;
    }
  }

  console.log('\n' + '='.repeat(70));
  
  if (allExist) {
    console.log('✨ All tables exist and are accessible!\n');
    console.log('If you don\'t see them in the Supabase dashboard:');
    console.log('1. Try refreshing the page');
    console.log('2. Check you\'re viewing the correct project');
    console.log('3. Go to: Table Editor (not SQL Editor)');
  } else {
    console.log('⚠️  Some tables are missing. Creating them now...\n');
    console.log('Please run the SQL from packages/db/supabase/schema.sql');
    console.log('in your Supabase SQL Editor:\n');
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  }
  
  console.log('='.repeat(70));
}

verifyTables();
