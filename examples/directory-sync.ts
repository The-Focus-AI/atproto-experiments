#!/usr/bin/env tsx
/**
 * Directory Sync Utility for AT Protocol Blob Store
 *
 * This script demonstrates how to:
 * 1. Upload an entire directory to the blob store
 * 2. Create a manifest record to track all files
 * 3. Download and restore the directory from the blob store
 */

import { BskyAgent } from '@atproto/api';
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

interface FileManifest {
  path: string;
  blobRef: any;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

interface DirectoryManifest {
  $type: 'app.bsky.sync.directory';
  name: string;
  rootPath: string;
  files: FileManifest[];
  totalSize: number;
  createdAt: string;
}

async function getAllFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursively get files from subdirectories
      files.push(...await getAllFiles(fullPath, baseDir));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'txt': 'text/plain',
    'json': 'application/json',
    'js': 'text/javascript',
    'ts': 'text/typescript',
    'md': 'text/markdown',
    'html': 'text/html',
    'css': 'text/css',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'pdf': 'application/pdf',
    'zip': 'application/zip',
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}

async function uploadDirectory(agent: BskyAgent, dirPath: string): Promise<DirectoryManifest> {
  console.log(`\n📦 Uploading directory: ${dirPath}`);
  console.log('─'.repeat(50));

  const files = await getAllFiles(dirPath);
  const manifest: DirectoryManifest = {
    $type: 'app.bsky.sync.directory',
    name: dirPath.split('/').pop() || 'unknown',
    rootPath: dirPath,
    files: [],
    totalSize: 0,
    createdAt: new Date().toISOString(),
  };

  for (const filePath of files) {
    const relativePath = relative(dirPath, filePath);
    const fileData = readFileSync(filePath);
    const stat = statSync(filePath);
    const mimeType = getMimeType(filePath);

    console.log(`  ⬆️  Uploading: ${relativePath} (${stat.size} bytes)`);

    // Upload blob
    const uploadResult = await agent.uploadBlob(fileData, {
      encoding: mimeType,
    });

    manifest.files.push({
      path: relativePath,
      blobRef: uploadResult.data.blob,
      size: stat.size,
      mimeType,
      uploadedAt: new Date().toISOString(),
    });

    manifest.totalSize += stat.size;
  }

  console.log('─'.repeat(50));
  console.log(`✅ Uploaded ${manifest.files.length} files (${manifest.totalSize} bytes total)`);

  return manifest;
}

async function saveManifest(agent: BskyAgent, manifest: DirectoryManifest): Promise<string> {
  console.log('\n💾 Saving manifest as a custom record...');

  // Create a custom record that anchors all the blobs
  // This makes them retrievable via com.atproto.sync.getBlob
  const record = {
    $type: 'ai.focus.sync.directory',
    name: manifest.name,
    rootPath: manifest.rootPath,
    files: manifest.files,
    totalSize: manifest.totalSize,
    createdAt: manifest.createdAt,
  };

  // Write the custom record to the repository
  const recordResult = await agent.com.atproto.repo.createRecord({
    repo: agent.session!.did,
    collection: 'ai.focus.sync.directory',
    record: record,
  });

  console.log(`✅ Manifest saved as record: ${recordResult.data.uri}`);

  // Also create a post for discoverability
  const post = await agent.post({
    text: `📁 Directory Sync: ${manifest.name}\n\n${manifest.files.length} files, ${manifest.totalSize} bytes\nCreated: ${new Date(manifest.createdAt).toLocaleString()}\n\nRecord: ${recordResult.data.uri}`,
    createdAt: new Date().toISOString(),
  });

  console.log(`📝 Post created: ${post.uri}`);
  console.log(`   View at: https://bsky.app/profile/${agent.session?.handle}/post/${post.uri.split('/').pop()}`);

  // Also save manifest to local file
  const manifestPath = `${manifest.name}-manifest.json`;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`📄 Local manifest: ${manifestPath}`);

  return recordResult.data.uri;
}

async function loadManifest(manifestPath: string): Promise<DirectoryManifest> {
  console.log(`\n📖 Loading manifest from: ${manifestPath}`);
  const data = readFileSync(manifestPath, 'utf-8');
  return JSON.parse(data);
}

async function downloadDirectory(agent: BskyAgent, manifest: DirectoryManifest, outputDir: string) {
  console.log(`\n📥 Downloading directory to: ${outputDir}`);
  console.log('─'.repeat(50));

  // Create output directory
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  let successCount = 0;
  let errorCount = 0;

  for (const file of manifest.files) {
    const outputPath = join(outputDir, file.path);
    const outputDirPath = dirname(outputPath);

    // Create subdirectories if needed
    if (!existsSync(outputDirPath)) {
      mkdirSync(outputDirPath, { recursive: true });
    }

    console.log(`  ⬇️  Downloading: ${file.path}`);

    try {
      // Extract CID from blob reference
      const cid = file.blobRef.ref.$link || file.blobRef.ref;

      // Construct blob URL - Bluesky's CDN endpoint for raw blobs
      const blobUrl = `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${agent.session!.did}&cid=${cid}`;

      // Download without authentication (blobs are public)
      const response = await fetch(blobUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.arrayBuffer();
      writeFileSync(outputPath, Buffer.from(blob));

      console.log(`     ✅ Downloaded ${blob.byteLength} bytes`);
      successCount++;

    } catch (error: any) {
      console.log(`     ❌ Error: ${error.message}`);
      errorCount++;
    }
  }

  console.log('─'.repeat(50));
  console.log(`✅ Successfully downloaded ${successCount} files`);
  if (errorCount > 0) {
    console.log(`❌ Failed to download ${errorCount} files`);
  }
}

async function main() {
  const command = process.argv[2];
  const path = process.argv[3];
  const outputDir = process.argv[4];

  if (!process.env.BLUESKY_HANDLE || !process.env.BLUESKY_PASSWORD) {
    console.error('Error: BLUESKY_HANDLE and BLUESKY_PASSWORD must be set in .env');
    process.exit(1);
  }

  const agent = new BskyAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: process.env.BLUESKY_HANDLE,
    password: process.env.BLUESKY_PASSWORD,
  });

  console.log(`\n🔐 Logged in as: ${agent.session?.handle}`);
  console.log(`📍 DID: ${agent.session?.did}`);

  if (command === 'upload') {
    if (!path) {
      console.error('Usage: tsx examples/directory-sync.ts upload <directory-path>');
      process.exit(1);
    }

    const manifest = await uploadDirectory(agent, path);
    await saveManifest(agent, manifest);

    console.log('\n✨ Upload complete!');
    console.log(`\nTo restore later, run:`);
    console.log(`  tsx examples/directory-sync.ts download ${manifest.name}-manifest.json ./restored`);

  } else if (command === 'download') {
    if (!path || !outputDir) {
      console.error('Usage: tsx examples/directory-sync.ts download <manifest-file> <output-directory>');
      process.exit(1);
    }

    const manifest = await loadManifest(path);
    await downloadDirectory(agent, manifest, outputDir);

  } else if (command === 'list') {
    // List all directory sync posts
    console.log('\n📋 Listing directory sync posts...');

    const posts = await agent.api.com.atproto.repo.listRecords({
      repo: agent.session!.did,
      collection: 'app.bsky.feed.post',
      limit: 50,
    });

    const syncPosts = posts.data.records.filter((record: any) => {
      const text = record.value?.text || '';
      return text.includes('📁 Directory Sync:');
    });

    console.log(`\nFound ${syncPosts.length} directory sync posts:\n`);

    syncPosts.forEach((post: any, index: number) => {
      const text = post.value.text;
      const match = text.match(/📁 Directory Sync: (.+)/);
      const name = match ? match[1].split('\n')[0] : 'Unknown';
      console.log(`${index + 1}. ${name}`);
      console.log(`   URI: ${post.uri}`);
      console.log(`   Created: ${new Date(post.value.createdAt).toLocaleString()}`);
      console.log('');
    });

  } else {
    console.log(`
Directory Sync Utility for AT Protocol Blob Store

Usage:
  Upload a directory:
    tsx examples/directory-sync.ts upload <directory-path>

  Download a directory:
    tsx examples/directory-sync.ts download <manifest-file> <output-directory>

  List synced directories:
    tsx examples/directory-sync.ts list

Examples:
  # Upload a directory
  tsx examples/directory-sync.ts upload ./my-documents

  # Download using the generated manifest
  tsx examples/directory-sync.ts download my-documents-manifest.json ./restored

  # List all synced directories
  tsx examples/directory-sync.ts list

How it works:
  1. Upload: Walks through directory, uploads each file as a blob
  2. Manifest: Creates a JSON manifest with all blob references
  3. Post: Saves manifest in a post for easy retrieval
  4. Download: Uses manifest to reconstruct directory structure

Note: Blob downloads require fetching from:
  https://bsky.social/xrpc/com.atproto.sync.getBlob?did={did}&cid={cid}
    `);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
