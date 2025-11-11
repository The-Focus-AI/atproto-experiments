/**
 * Setup Script: Create account and configure .env
 *
 * This script helps you get started by:
 * 1. Creating a new Bluesky account
 * 2. Automatically creating your .env file
 * 3. Running a quick test to verify everything works
 */

import { BskyAgent } from '@atproto/api';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setup() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   AT Protocol Examples - Setup Wizard                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Check if .env already exists
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const overwrite = await question('⚠️  .env file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      rl.close();
      process.exit(0);
    }
  }

  console.log('\n📝 Let\'s create your Bluesky account...\n');

  // Get account details
  const useDefaults = await question('Use auto-generated values? (Y/n): ');

  let handle: string;
  let email: string;
  let password: string;

  if (useDefaults.toLowerCase() === 'n') {
    handle = await question('Enter handle (e.g., myname.bsky.social): ');
    email = await question('Enter email: ');
    password = await question('Enter password (min 8 chars): ');
  } else {
    const timestamp = Date.now();
    handle = `test-user-${timestamp}.bsky.social`;
    email = `test-${timestamp}@example.com`;
    password = `TestPassword${timestamp}!`;

    console.log('\n📋 Generated credentials:');
    console.log(`   Handle: ${handle}`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
  }

  console.log('\n🚀 Creating account...\n');

  try {
    // Create account
    const service = process.env.ATP_SERVICE || 'https://bsky.social';
    const agent = new BskyAgent({ service });

    const response = await agent.createAccount({
      handle,
      email,
      password,
    });

    console.log('✅ Account created successfully!\n');
    console.log('Account Details:');
    console.log('─────────────────────────────────────');
    console.log('Handle:', response.data.handle);
    console.log('DID:', response.data.did);
    console.log('─────────────────────────────────────\n');

    // Create .env file
    const envContent = `# AT Protocol / Bluesky Credentials
BLUESKY_HANDLE=${handle}
BLUESKY_PASSWORD=${password}

# Optional: Custom PDS endpoint (defaults to bsky.social)
# ATP_SERVICE=https://bsky.social

# Note: Bluesky has been open for public signups since February 2024
# No invite codes needed! Just email, handle, and password.
`;

    writeFileSync(envPath, envContent);
    console.log('✅ .env file created successfully!\n');

    // Make a test post
    console.log('📝 Making a test post...\n');

    const post = await agent.post({
      text: '👋 Hello from AT Protocol! This is my first automated post.',
      createdAt: new Date().toISOString(),
    });

    console.log('✅ Test post created!\n');
    console.log('🔗 View your profile:');
    console.log(`   https://bsky.app/profile/${handle}\n`);
    console.log('🔗 View your post:');
    console.log(`   https://bsky.app/profile/${handle}/post/${post.uri.split('/').pop()}\n`);

    // Summary
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   Setup Complete! 🎉                                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log('Next steps:');
    console.log('1. Run tests: npm test');
    console.log('2. Run specific test: npm test -- tests/01-authentication.test.ts');
    console.log('3. Watch mode: npm run test:watch\n');
    console.log('Your credentials are saved in .env');
    console.log('Keep them secure and don\'t commit .env to git!\n');

  } catch (error: any) {
    console.error('\n❌ Setup failed:', error.message);

    if (error.message.includes('handle')) {
      console.log('\n💡 Tip: The handle might be taken. Try running setup again.');
    } else if (error.message.includes('email')) {
      console.log('\n💡 Tip: Check the email format or try a different email.');
    } else if (error.message.includes('password')) {
      console.log('\n💡 Tip: Password must be at least 8 characters.');
    } else {
      console.log('\n💡 Tip: Check your internet connection and try again.');
    }

    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run setup
if (import.meta.url === `file://${process.argv[1]}`) {
  setup().catch(console.error);
}

export { setup };
