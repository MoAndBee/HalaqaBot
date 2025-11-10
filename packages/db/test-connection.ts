#!/usr/bin/env bun
import { StorageService } from './src/storage.service';

async function testConnection() {
  console.log('🔍 Testing Supabase connection...\n');
  
  try {
    const storage = new StorageService();
    console.log('✅ StorageService initialized successfully');
    
    // Test basic query
    console.log('\n📊 Testing database query...');
    const posts = await storage.getAllPosts();
    console.log(`✅ Query successful! Found ${posts.length} posts`);
    
    if (posts.length > 0) {
      console.log('\n📝 Sample post data:');
      console.log(posts[0]);
    }
    
    console.log('\n✨ All tests passed! Supabase migration is complete.');
    
  } catch (error) {
    console.error('\n❌ Connection test failed:');
    console.error(error);
    process.exit(1);
  }
}

testConnection();
