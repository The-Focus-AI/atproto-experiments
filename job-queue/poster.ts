#!/usr/bin/env tsx
/**
 * Job Queue Poster (Lexicon-based)
 *
 * Uses custom records instead of posts - jobs won't appear in your feed!
 */

import { BskyAgent } from '@atproto/api';
import * as fs from 'fs';
import 'dotenv/config';
import { JobPayload, JobRecord, JobPost, JOB_COLLECTION } from './types.js';

async function postJob(agent: BskyAgent, payload: JobPayload): Promise<string> {
  const record: JobRecord = {
    $type: JOB_COLLECTION,
    payload,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const response = await agent.api.com.atproto.repo.createRecord({
    repo: agent.session!.did,
    collection: JOB_COLLECTION,
    record,
  });

  console.log(`\n📤 Job created!`);
  console.log(`URI: ${response.data.uri}`);
  console.log(`Type: ${payload.type}`);

  return response.data.uri;
}

async function getJob(agent: BskyAgent, jobUri: string): Promise<JobPost> {
  // Parse URI: at://did/collection/rkey
  const parts = jobUri.replace('at://', '').split('/');
  const repo = parts[0];
  const rkey = parts[2];

  const response = await agent.api.com.atproto.repo.getRecord({
    repo,
    collection: JOB_COLLECTION,
    rkey,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
    record: response.data.value as JobRecord,
  };
}

async function listJobs(agent: BskyAgent): Promise<JobPost[]> {
  const jobs: JobPost[] = [];

  console.log(`📡 Fetching jobs from your repository...`);

  const response = await agent.api.com.atproto.repo.listRecords({
    repo: agent.session!.did,
    collection: JOB_COLLECTION,
    limit: 100,
  });

  console.log(`📊 Found ${response.data.records.length} job(s)`);

  for (const record of response.data.records) {
    jobs.push({
      uri: record.uri,
      cid: record.cid,
      record: record.value as JobRecord,
    });
  }

  // Sort by creation time, newest first
  jobs.sort((a, b) =>
    new Date(b.record.createdAt).getTime() - new Date(a.record.createdAt).getTime()
  );

  return jobs;
}

async function downloadBlob(agent: BskyAgent, blobRef: any, workerDid: string, outputPath: string) {
  // Extract CID - same approach as directory-sync
  const cid = blobRef.ref?.$link || blobRef.ref?.['$link'] || blobRef.ref;

  if (!cid) {
    console.error('BlobRef structure:', JSON.stringify(blobRef, null, 2));
    throw new Error('Invalid blob reference - missing CID');
  }

  const blobUrl = `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${workerDid}&cid=${cid}`;

  const response = await fetch(blobUrl);
  if (!response.ok) {
    throw new Error(`Failed to download blob: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);

  console.log(`✅ Blob downloaded to: ${outputPath}`);
}

async function deleteJob(agent: BskyAgent, jobUri: string) {
  const parts = jobUri.replace('at://', '').split('/');
  const rkey = parts[2];

  await agent.api.com.atproto.repo.deleteRecord({
    repo: agent.session!.did,
    collection: JOB_COLLECTION,
    rkey,
  });

  console.log(`🗑️  Job deleted: ${jobUri}`);
}

async function finishJob(agent: BskyAgent, jobUri: string, outputDir: string, keepRecord: boolean = false) {
  console.log(`\n📦 Finishing job: ${jobUri}`);
  console.log(`📁 Output directory: ${outputDir}`);

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`✅ Created directory: ${outputDir}`);
  }

  // Get job details
  const job = await getJob(agent, jobUri);

  // Save job metadata
  const metadataPath = `${outputDir}/job.json`;
  fs.writeFileSync(metadataPath, JSON.stringify(job.record, null, 2));
  console.log(`✅ Saved metadata: ${metadataPath}`);

  // Download blob if present
  if (job.record.blobRef && job.record.workerDid) {
    const extension = job.record.blobRef.mimeType?.split('/')[1] || 'bin';
    const blobPath = `${outputDir}/result.${extension}`;

    await downloadBlob(agent, job.record.blobRef, job.record.workerDid, blobPath);
  } else if (job.record.blobRef) {
    console.log(`⚠️  Blob present but no worker DID - cannot download`);
  }

  // Delete job record unless --keep specified
  if (!keepRecord) {
    await deleteJob(agent, jobUri);
  } else {
    console.log(`✅ Job record kept (use --keep to preserve)`);
  }

  console.log(`\n✨ Job finished! Results in: ${outputDir}`);
}

// CLI
async function main() {
  const command = process.argv[2];

  if (!command) {
    console.log(`
📤 Job Queue Poster

Usage:
  npm run job-poster post <payload-file>              Post a new job
  npm run job-poster get <job-uri>                    Get job status
  npm run job-poster list                             List all jobs
  npm run job-poster finish <job-uri> <output-dir>    Download results and cleanup
  npm run job-poster download <job-uri> <output-file> Download result blob
  npm run job-poster delete <job-uri>                 Delete a job

Examples:
  # Create a job
  echo '{"type":"echo","data":{"message":"test"}}' > job.json
  npm run job-poster post job.json

  # Check status
  npm run job-poster get at://did:plc:.../ai.thefocus.jobqueue.job/...

  # List all jobs
  npm run job-poster list

  # Finish job (download results + cleanup)
  npm run job-poster finish at://... ./results

  # Finish job but keep record
  npm run job-poster finish at://... ./results --keep

  # Download blob only
  npm run job-poster download at://... ./result.png

  # Delete job
  npm run job-poster delete at://...
`);
    process.exit(0);
  }

  const service = process.env.ATP_SERVICE || 'https://bsky.social';
  const agent = new BskyAgent({ service });

  const identifier = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_PASSWORD || process.env.BLUESKY_APP_PASSWORD;

  if (!identifier || !password) {
    console.error('❌ Error: BLUESKY_HANDLE and BLUESKY_PASSWORD must be set in .env');
    process.exit(1);
  }

  await agent.login({ identifier, password });
  console.log(`✅ Logged in as @${agent.session!.handle}`);

  if (command === 'post') {
    const payloadFile = process.argv[3];
    if (!payloadFile) {
      console.error('❌ Error: Payload file required');
      process.exit(1);
    }

    const payload: JobPayload = JSON.parse(fs.readFileSync(payloadFile, 'utf-8'));
    await postJob(agent, payload);

  } else if (command === 'get') {
    const jobUri = process.argv[3];
    if (!jobUri) {
      console.error('❌ Error: Job URI required');
      process.exit(1);
    }

    const job = await getJob(agent, jobUri);
    console.log('\n📋 Job:\n');
    console.log(JSON.stringify(job, null, 2));

  } else if (command === 'list') {
    const jobs = await listJobs(agent);
    console.log(`\n📋 Jobs:\n`);

    if (jobs.length === 0) {
      console.log('No jobs found.');
    } else {
      jobs.forEach((job, i) => {
        console.log(`${i + 1}. [${job.record.status.toUpperCase()}] ${job.record.payload.type}`);
        console.log(`   URI: ${job.uri}`);
        console.log(`   Created: ${new Date(job.record.createdAt).toLocaleString()}`);
        if (job.record.workerDid) console.log(`   Worker: ${job.record.workerDid}`);
        if (job.record.error) console.log(`   Error: ${job.record.error}`);
        console.log();
      });
    }

  } else if (command === 'finish') {
    const jobUri = process.argv[3];
    const outputDir = process.argv[4];
    const keepRecord = process.argv.includes('--keep');

    if (!jobUri || !outputDir) {
      console.error('❌ Error: Job URI and output directory required');
      process.exit(1);
    }

    await finishJob(agent, jobUri, outputDir, keepRecord);

  } else if (command === 'download') {
    const jobUri = process.argv[3];
    const outputPath = process.argv[4];

    if (!jobUri || !outputPath) {
      console.error('❌ Error: Job URI and output path required');
      process.exit(1);
    }

    const job = await getJob(agent, jobUri);

    if (!job.record.blobRef) {
      console.error('❌ Error: No blob attached to this job');
      process.exit(1);
    }

    if (!job.record.workerDid) {
      console.error('❌ Error: Job has no worker DID');
      process.exit(1);
    }

    await downloadBlob(agent, job.record.blobRef, job.record.workerDid, outputPath);

  } else if (command === 'delete') {
    const jobUri = process.argv[3];
    if (!jobUri) {
      console.error('❌ Error: Job URI required');
      process.exit(1);
    }

    await deleteJob(agent, jobUri);

  } else {
    console.error(`❌ Unknown command: ${command}`);
    process.exit(1);
  }
}

main().catch(console.error);
