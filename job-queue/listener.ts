#!/usr/bin/env tsx
/**
 * Job Queue Listener (Lexicon-based)
 *
 * Polls repositories for pending jobs and processes them
 */

import { BskyAgent } from '@atproto/api';
import * as fs from 'fs';
import 'dotenv/config';
import { JobPayload, JobRecord, JobResult, JOB_COLLECTION } from './types.js';

// Job handler type
type JobHandler = (payload: JobPayload) => Promise<JobResult>;

// Registry of job handlers
const handlers = new Map<string, JobHandler>();

// Register a job handler
export function registerHandler(type: string, handler: JobHandler) {
  handlers.set(type, handler);
  console.log(`✅ Registered handler for job type: ${type}`);
}

// Process a job
async function processJob(agent: BskyAgent, jobUri: string, payload: JobPayload, rkey: string) {
  console.log(`\n🔄 Processing job: ${payload.type}`);

  // Update to "working"
  const workingRecord: JobRecord = {
    $type: JOB_COLLECTION,
    payload,
    status: 'working',
    createdAt: new Date().toISOString(),
    workerDid: agent.session!.did,
  };

  await agent.api.com.atproto.repo.putRecord({
    repo: agent.session!.did,
    collection: JOB_COLLECTION,
    rkey,
    record: workingRecord,
  });

  console.log(`✅ Updated status to "working"`);

  try {
    // Find handler
    const handler = handlers.get(payload.type);
    if (!handler) {
      throw new Error(`No handler registered for job type: ${payload.type}`);
    }

    // Execute handler
    const result = await handler(payload);

    // Upload blob if present
    let blobRef: any = undefined;
    if (result.blobRef) {
      console.log(`📤 Uploading result blob...`);
      const blobData = fs.readFileSync(result.blobRef.path);
      const blobUpload = await agent.uploadBlob(blobData, {
        encoding: result.blobRef.mimeType || 'application/octet-stream',
      });

      blobRef = blobUpload.data.blob;
      console.log(`✅ Blob uploaded (CID: ${blobRef.ref.toString()})`);
    }

    // Update to "success"
    const successRecord: JobRecord = {
      $type: JOB_COLLECTION,
      payload,
      status: 'success',
      createdAt: workingRecord.createdAt,
      workerDid: agent.session!.did,
      result: result.data,
      blobRef,
    };

    await agent.api.com.atproto.repo.putRecord({
      repo: agent.session!.did,
      collection: JOB_COLLECTION,
      rkey,
      record: successRecord,
    });

    console.log(`✅ Updated status to "success"`);

  } catch (error: any) {
    console.error(`❌ Job failed:`, error.message);

    // Update to "failed"
    const failedRecord: JobRecord = {
      $type: JOB_COLLECTION,
      payload,
      status: 'failed',
      createdAt: workingRecord.createdAt,
      workerDid: agent.session!.did,
      error: error.message,
    };

    await agent.api.com.atproto.repo.putRecord({
      repo: agent.session!.did,
      collection: JOB_COLLECTION,
      rkey,
      record: failedRecord,
    });

    console.log(`✅ Updated status to "failed"`);
  }
}

// Poll for new jobs
async function pollJobs(agent: BskyAgent, watchDids: string[]) {
  console.log(`\n🔍 Polling ${watchDids.length} account(s) for jobs...`);

  try {
    const processedJobs = new Set<string>();

    for (const did of watchDids) {
      try {
        const response = await agent.api.com.atproto.repo.listRecords({
          repo: did,
          collection: JOB_COLLECTION,
          limit: 100,
        });

        console.log(`📊 Found ${response.data.records.length} job(s) from ${did.slice(0, 20)}...`);

        for (const record of response.data.records) {
          const jobRecord = record.value as JobRecord;

          // Only process pending jobs
          if (jobRecord.status !== 'pending') {
            continue;
          }

          // Check if we have a handler
          if (!handlers.has(jobRecord.payload.type)) {
            console.log(`⏭️  Skipping ${record.uri}: No handler for "${jobRecord.payload.type}"`);
            continue;
          }

          console.log(`\n📝 Found pending job: ${record.uri}`);
          console.log(`   Type: ${jobRecord.payload.type}`);
          console.log(`   🎯 Handler found! Processing...`);

          // Extract rkey
          const rkey = record.uri.split('/').pop()!;

          await processJob(agent, record.uri, jobRecord.payload, rkey);
          processedJobs.add(record.uri);
        }
      } catch (error: any) {
        console.error(`❌ Error checking ${did}:`, error.message);
      }
    }

    if (processedJobs.size === 0) {
      console.log(`\n💤 No new jobs to process`);
    } else {
      console.log(`\n✅ Processed ${processedJobs.size} job(s)`);
    }

  } catch (error: any) {
    console.error(`❌ Error polling jobs:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Start listener
async function startListener(watchDids: string[], intervalMs: number = 30000) {
  const agent = new BskyAgent({ service: 'https://bsky.social' });

  const identifier = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_PASSWORD || process.env.BLUESKY_APP_PASSWORD;

  if (!identifier || !password) {
    console.error('❌ Error: BLUESKY_HANDLE and BLUESKY_PASSWORD must be set in .env');
    process.exit(1);
  }

  await agent.login({ identifier, password });
  console.log(`✅ Logged in as @${agent.session!.handle}`);
  console.log(`🎧 Listening for jobs (polling every ${intervalMs / 1000}s)...`);
  console.log(`👀 Watching ${watchDids.length} account(s)`);

  // Poll immediately
  await pollJobs(agent, watchDids);

  // Then poll on interval
  setInterval(async () => {
    await pollJobs(agent, watchDids);
  }, intervalMs);
}

// Example job handlers (same as post-based version)
registerHandler('echo', async (payload: JobPayload): Promise<JobResult> => {
  return {
    status: 'success',
    data: {
      echo: payload.data,
      timestamp: new Date().toISOString(),
    },
  };
});

registerHandler('reverse', async (payload: JobPayload): Promise<JobResult> => {
  if (typeof payload.data !== 'string') {
    throw new Error('Data must be a string');
  }

  return {
    status: 'success',
    data: {
      original: payload.data,
      reversed: payload.data.split('').reverse().join(''),
    },
  };
});

registerHandler('wait', async (payload: JobPayload): Promise<JobResult> => {
  const seconds = payload.data.seconds || 5;
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));

  return {
    status: 'success',
    data: {
      waited: seconds,
      message: `Waited for ${seconds} seconds`,
    },
  };
});

registerHandler('image-gen', async (payload: JobPayload): Promise<JobResult> => {
  const text = payload.data.text || 'Hello from Job Queue!';
  const width = payload.data.width || 400;
  const height = payload.data.height || 200;
  const bgColor = payload.data.bgColor || '#4a90e2';
  const textColor = payload.data.textColor || '#ffffff';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${bgColor}"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24"
        fill="${textColor}" text-anchor="middle" dominant-baseline="middle">
    ${text}
  </text>
  <text x="50%" y="85%" font-family="monospace" font-size="12"
        fill="${textColor}" text-anchor="middle" opacity="0.7">
    Generated: ${new Date().toISOString()}
  </text>
</svg>`;

  const outputPath = `/tmp/job-${Date.now()}.svg`;
  fs.writeFileSync(outputPath, svg);

  return {
    status: 'success',
    data: {
      text,
      width,
      height,
      bgColor,
      textColor,
      fileSize: svg.length,
    },
    blobRef: {
      path: outputPath,
      mimeType: 'image/svg+xml',
      alt: `SVG with text: ${text}`,
    },
  };
});

// CLI
async function main() {
  const args = process.argv.slice(2);

  // First arg can be interval or --watch
  let intervalMs = 30000;
  const watchDids: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--watch' && args[i + 1]) {
      watchDids.push(args[i + 1]);
      i++; // Skip next arg
    } else if (!isNaN(parseInt(args[i]))) {
      intervalMs = parseInt(args[i]) * 1000;
    }
  }

  console.log(`
🎧 Job Queue Listener (Lexicon-based)

Usage:
  npm run job-listener-lex [interval] --watch <did> [--watch <did2> ...]

Options:
  interval              Polling interval in seconds (default: 30)
  --watch <did>         DID to watch for jobs (can specify multiple)

Registered Handlers:
  - echo: Echo back the input data
  - reverse: Reverse a string
  - wait: Wait for specified seconds (simulates long job)
  - image-gen: Generate an SVG image with custom text (returns blob)

Examples:
  # Watch your own account (default)
  npm run job-listener-lex

  # Watch your account every 10 seconds
  npm run job-listener-lex 10

  # Watch another account's jobs
  npm run job-listener-lex --watch did:plc:abc123...

  # Watch multiple accounts
  npm run job-listener-lex 10 --watch did:plc:abc... --watch did:plc:def...

Press Ctrl+C to stop
`);

  // If no DIDs specified, watch own account
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  const identifier = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_PASSWORD || process.env.BLUESKY_APP_PASSWORD;

  if (!identifier || !password) {
    console.error('❌ Error: BLUESKY_HANDLE and BLUESKY_PASSWORD must be set in .env');
    process.exit(1);
  }

  await agent.login({ identifier, password });

  if (watchDids.length === 0) {
    watchDids.push(agent.session!.did);
    console.log(`📍 No --watch specified, watching own account: ${agent.session!.did}\n`);
  }

  await startListener(watchDids, intervalMs);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down listener...');
  process.exit(0);
});

main().catch(console.error);
