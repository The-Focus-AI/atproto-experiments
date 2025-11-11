/**
 * Example: Creating a new Bluesky account
 *
 * This example shows how to programmatically create a new account
 * on the Bluesky network. Bluesky has been open for public signups
 * since February 2024 - no invite codes needed!
 *
 * Prerequisites:
 * - A unique handle
 * - A valid email address
 * - A secure password
 */

import { BskyAgent } from '@atproto/api';
import { config } from 'dotenv';

config();

async function createAccount() {
  // Get service endpoint from environment or use default
  const service = process.env.ATP_SERVICE || 'https://bsky.social';

  // Initialize agent
  const agent = new BskyAgent({
    service,
  });

  // Account details
  const handle = process.argv[2] || `user-${Date.now()}.bsky.social`;
  const email = process.argv[3] || `user-${Date.now()}@example.com`;
  const password = process.argv[4] || `SecurePassword${Date.now()}!`;

  console.log('Creating account...');
  console.log('Service:', service);
  console.log('Handle:', handle);
  console.log('Email:', email);

  try {
    const response = await agent.createAccount({
      handle,
      email,
      password,
    });

    console.log('\n✓ Account created successfully!');
    console.log('\nAccount Details:');
    console.log('─────────────────────────────────────');
    console.log('Handle:', response.data.handle);
    console.log('DID:', response.data.did);
    console.log('Access Token:', response.data.accessJwt.substring(0, 20) + '...');
    console.log('Refresh Token:', response.data.refreshJwt.substring(0, 20) + '...');
    console.log('\nSave these credentials to login:');
    console.log(`BLUESKY_HANDLE=${response.data.handle}`);
    console.log(`BLUESKY_PASSWORD=${password}`);

    // The agent is now logged in
    console.log('\n✓ Agent is now authenticated');
    console.log('Session:', agent.session?.handle);

    // Try a test post
    const post = await agent.post({
      text: 'Hello from AT Protocol! 👋 This is my first post.',
      createdAt: new Date().toISOString(),
    });

    console.log('\n✓ Test post created:', post.uri);
    console.log('\nView your post at:');
    console.log(`https://bsky.app/profile/${response.data.handle}`);

  } catch (error: any) {
    console.error('\n✗ Account creation failed');
    console.error('Error:', error.message);

    if (error.message.includes('handle')) {
      console.log('\nPossible issues:');
      console.log('- Handle is already taken');
      console.log('- Handle format is invalid');
      console.log('- Try a different handle');
    } else if (error.message.includes('password')) {
      console.log('\nPassword requirements:');
      console.log('- At least 8 characters');
      console.log('- Mix of letters and numbers recommended');
    }

    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createAccount().catch(console.error);
}

export { createAccount };
