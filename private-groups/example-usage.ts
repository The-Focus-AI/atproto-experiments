/**
 * Example usage of the private groups system
 */

import { BskyAgent } from '@atproto/api';
import { GroupManager } from './group-manager';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  // Initialize agent
  const agent = new BskyAgent({
    service: process.env.ATP_SERVICE || 'https://bsky.social',
  });

  await agent.login({
    identifier: process.env.BLUESKY_HANDLE!,
    password: process.env.BLUESKY_PASSWORD!,
  });

  console.log(`✅ Logged in as @${agent.session!.handle}`);

  const groupManager = new GroupManager(agent);

  // Example 1: Create a private group
  console.log('\n📁 Creating a private group...');
  const privateGroup = await groupManager.createGroup({
    name: 'Secret Club',
    description: 'A private group for testing encrypted messages',
    visibility: 'private',
  });

  console.log(`✅ Created private group: ${privateGroup.uri}`);
  console.log(`🔑 Encryption key: ${privateGroup.encryptionKey?.substring(0, 20)}...`);

  // Example 2: Create a public group
  console.log('\n📢 Creating a public group...');
  const publicGroup = await groupManager.createGroup({
    name: 'Public Announcements',
    description: 'A public group for community updates',
    visibility: 'public',
  });

  console.log(`✅ Created public group: ${publicGroup.uri}`);

  // Example 3: Post to private group (encrypted)
  console.log('\n🔒 Posting encrypted message to private group...');
  const privateMessage = await groupManager.postMessage({
    groupUri: privateGroup.uri,
    text: 'This is a secret message that only group members can read!',
  });

  console.log(`✅ Posted encrypted message: ${privateMessage.uri}`);

  // Example 4: Post to public group (plain text)
  console.log('\n📣 Posting public message...');
  const publicMessage = await groupManager.postMessage({
    groupUri: publicGroup.uri,
    text: 'This is a public announcement visible to everyone!',
  });

  console.log(`✅ Posted public message: ${publicMessage.uri}`);

  // Example 5: List all groups
  console.log('\n📋 Listing all groups...');
  const groups = await groupManager.listGroups();

  for (const group of groups) {
    console.log(`\n  📁 ${group.record.name}`);
    console.log(`     Visibility: ${group.record.visibility}`);
    console.log(`     URI: ${group.uri}`);
    console.log(`     Admin: ${group.isAdmin ? 'Yes' : 'No'}`);
  }

  // Example 6: Get messages from private group (auto-decrypted)
  console.log('\n💬 Fetching messages from private group...');
  const privateMessages = await groupManager.getGroupMessages({
    groupUri: privateGroup.uri,
    limit: 10,
  });

  for (const msg of privateMessages) {
    console.log(`\n  From: ${msg.author.did}`);
    console.log(`  Encrypted: ${msg.record.isEncrypted ? 'Yes' : 'No'}`);
    console.log(`  Text: ${msg.decryptedText || msg.record.text}`);
    console.log(`  Time: ${msg.record.createdAt}`);
  }

  // Example 7: Get messages from public group
  console.log('\n💬 Fetching messages from public group...');
  const publicMessages = await groupManager.getGroupMessages({
    groupUri: publicGroup.uri,
    limit: 10,
  });

  for (const msg of publicMessages) {
    console.log(`\n  From: ${msg.author.did}`);
    console.log(`  Text: ${msg.record.text}`);
    console.log(`  Time: ${msg.record.createdAt}`);
  }

  // Example 8: Check membership
  const isMemberOfPrivate = await groupManager.isMember(privateGroup.uri);
  console.log(`\n👤 Am I a member of private group? ${isMemberOfPrivate ? 'Yes' : 'No'}`);
}

// Run the example
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
