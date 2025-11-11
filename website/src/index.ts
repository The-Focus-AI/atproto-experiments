#!/usr/bin/env node
import { BskyAgent } from '@atproto/api';
import * as dotenv from 'dotenv';
import { EnvConfig } from './lib/types.js';
import { postCommand } from './commands/post.js';
import { viewCommand } from './commands/view.js';
import { generateCommand } from './commands/generate.js';

// Load environment variables
dotenv.config();

/**
 * Main CLI entry point
 */
async function main() {
  const command = process.argv[2];
  const flags = process.argv.slice(3);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  // Load environment config
  const envConfig: EnvConfig = {
    blueskyHandle: process.env.BLUESKY_HANDLE || '',
    blueskyPassword: process.env.BLUESKY_PASSWORD || '',
    atpService: process.env.ATP_SERVICE || 'https://bsky.social',
    contentDir: process.env.CONTENT_DIR || './content',
    outputDir: process.env.OUTPUT_DIR || './public',
  };

  // Validate credentials for commands that need them
  if (command !== 'help') {
    if (!envConfig.blueskyHandle || !envConfig.blueskyPassword) {
      console.error('❌ Error: BLUESKY_HANDLE and BLUESKY_PASSWORD must be set in .env');
      console.error('See .env.example for reference');
      process.exit(1);
    }
  }

  // Create and authenticate agent
  const agent = new BskyAgent({ service: envConfig.atpService });

  try {
    await agent.login({
      identifier: envConfig.blueskyHandle,
      password: envConfig.blueskyPassword,
    });

    console.log(`✅ Logged in as @${agent.session!.handle}\n`);
  } catch (error: any) {
    console.error('❌ Authentication failed:', error.message);
    process.exit(1);
  }

  // Execute command
  try {
    switch (command) {
      case 'post':
        await postCommand(agent, envConfig);
        break;

      case 'view':
        const overwrite = flags.includes('--overwrite');
        await viewCommand(agent, envConfig, overwrite);
        break;

      case 'generate':
        const remotePreSync = flags.includes('--remote-pre-sync');
        await generateCommand(agent, envConfig, remotePreSync);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.error('Run "website help" for usage information');
        process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
🌐 ATProto Website Tool

Manage a personal blog/website with content stored in ATProto PDS.

Usage:
  website <command> [options]

Commands:
  post                    Sync content from local to PDS
  view [--overwrite]      Sync content from PDS to local
                          --overwrite: Replace existing local files
  generate [--remote-pre-sync]
                          Generate static HTML site from local content
                          --remote-pre-sync: Sync from PDS before generating
  help                    Show this help message

Environment Variables (in .env):
  BLUESKY_HANDLE         Your Bluesky handle
  BLUESKY_PASSWORD       Your Bluesky app password
  ATP_SERVICE            ATProto service URL (default: https://bsky.social)
  CONTENT_DIR            Content directory (default: ./content)
  OUTPUT_DIR             Generated site output (default: ./public)

Directory Structure:
  content/
    articles/            Long-form articles (markdown)
    microposts/          Daily notes with short posts
    themes/              CSS theme files
  config.json            Site configuration
  public/                Generated static site

Examples:
  website view           Pull content from PDS (first-time setup)
  website post           Publish local content to PDS
  website generate       Build static HTML site
  website generate --remote-pre-sync
                         Sync from PDS then build site

Learn more: https://github.com/your-repo/atproto-website
`);
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
