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
import { createHash } from 'crypto';
import { CID } from 'multiformats/cid';
import * as Block from 'multiformats/block';
import { sha256 } from 'multiformats/hashes/sha2';
import * as raw from 'multiformats/codecs/raw';
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

async function calculateCID(data: Buffer): Promise<string> {
  // AT Protocol uses CIDv1 with raw codec and sha256
  const hash = await sha256.digest(data);
  const cid = CID.create(1, raw.code, hash);
  return cid.toString();
}

async function getPreviousManifest(agent: BskyAgent, dirName: string): Promise<DirectoryManifest | null> {
  try {
    const records = await agent.api.com.atproto.repo.listRecords({
      repo: agent.session!.did,
      collection: 'ai.focus.sync.directory',
      limit: 50,
    });

    // Find the most recent manifest for this directory
    const matching = records.data.records
      .filter((r: any) => r.value.name === dirName)
      .sort((a: any, b: any) =>
        new Date(b.value.createdAt).getTime() - new Date(a.value.createdAt).getTime()
      );

    if (matching.length > 0) {
      return matching[0].value as DirectoryManifest;
    }
  } catch (error) {
    // No previous manifest found
  }
  return null;
}

async function uploadDirectory(agent: BskyAgent, dirPath: string): Promise<DirectoryManifest> {
  const dirName = dirPath.split('/').pop() || 'unknown';

  console.log(`\n📦 Uploading directory: ${dirPath}`);

  // Try to get previous manifest for incremental upload
  const previousManifest = await getPreviousManifest(agent, dirName);
  const previousFiles = new Map<string, FileManifest>();

  if (previousManifest) {
    console.log(`✨ Found previous sync from ${new Date(previousManifest.createdAt).toLocaleString()}`);
    previousManifest.files.forEach(f => {
      const cid = f.blobRef.ref?.$link || f.blobRef.ref;
      if (cid) {
        previousFiles.set(f.path, f);
      }
    });
  }

  console.log('─'.repeat(50));

  const files = await getAllFiles(dirPath);
  const manifest: DirectoryManifest = {
    $type: 'app.bsky.sync.directory',
    name: dirName,
    rootPath: dirPath,
    files: [],
    totalSize: 0,
    createdAt: new Date().toISOString(),
  };

  let uploadedCount = 0;
  let skippedCount = 0;

  for (const filePath of files) {
    const relativePath = relative(dirPath, filePath);
    const fileData = readFileSync(filePath);
    const stat = statSync(filePath);
    const mimeType = getMimeType(filePath);

    // Calculate local CID
    const localCID = await calculateCID(fileData);
    const previousFile = previousFiles.get(relativePath);
    let previousCID = previousFile?.blobRef.ref?.$link || previousFile?.blobRef.ref;

    // Convert CID object to string if needed
    if (previousCID && typeof previousCID === 'object' && previousCID.toString) {
      previousCID = previousCID.toString();
    }

    // Check if file unchanged
    if (previousCID === localCID) {
      console.log(`  ⏭️  Skipping: ${relativePath} (unchanged)`);
      manifest.files.push({
        path: relativePath,
        blobRef: previousFile.blobRef,
        size: stat.size,
        mimeType,
        uploadedAt: previousFile.uploadedAt,
      });
      skippedCount++;
    } else {
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
      uploadedCount++;
    }

    manifest.totalSize += stat.size;
  }

  console.log('─'.repeat(50));
  console.log(`✅ Uploaded ${uploadedCount} new/modified files`);
  if (skippedCount > 0) {
    console.log(`⏭️  Skipped ${skippedCount} unchanged files`);
  }
  console.log(`📦 Total: ${manifest.files.length} files (${manifest.totalSize} bytes)`);

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

async function loadManifestFromFile(manifestPath: string): Promise<DirectoryManifest> {
  console.log(`\n📖 Loading manifest from local file: ${manifestPath}`);
  const data = readFileSync(manifestPath, 'utf-8');
  return JSON.parse(data);
}

async function loadManifestFromRecord(agent: BskyAgent, recordUri: string): Promise<DirectoryManifest> {
  console.log(`\n📖 Loading manifest from record: ${recordUri}`);

  // Parse AT URI: at://did:plc:abc123/ai.focus.sync.directory/abc123
  const uriParts = recordUri.replace('at://', '').split('/');
  const repo = uriParts[0];
  const collection = uriParts.slice(1, -1).join('.'); // Join all parts between repo and rkey
  const rkey = uriParts[uriParts.length - 1];

  // Fetch the record
  const record = await agent.api.com.atproto.repo.getRecord({
    repo,
    collection,
    rkey,
  });

  console.log(`✅ Loaded manifest: ${record.data.value.name}`);

  return record.data.value as DirectoryManifest;
}

async function getLatestManifest(agent: BskyAgent): Promise<DirectoryManifest> {
  console.log('\n🔍 Finding latest directory sync record...');

  const records = await agent.api.com.atproto.repo.listRecords({
    repo: agent.session!.did,
    collection: 'ai.focus.sync.directory',
    limit: 1,
    // Records are returned newest first by default
  });

  if (records.data.records.length === 0) {
    throw new Error('No directory sync records found');
  }

  const record = records.data.records[0];
  console.log(`✅ Found: ${record.value.name} (${record.uri})`);

  return record.value as DirectoryManifest;
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
    console.log(`  tsx examples/directory-sync.ts download ./restored`);

  } else if (command === 'download') {
    let manifest: DirectoryManifest;

    // Determine if we have a source (URI/file) and/or output directory
    if (!path) {
      // No args - use latest and default output dir
      manifest = await getLatestManifest(agent);
      await downloadDirectory(agent, manifest, './restored-dir');
    } else if (!outputDir) {
      // One arg - could be output dir or source
      if (path.startsWith('at://') || (existsSync(path) && path.endsWith('.json'))) {
        // It's a source, need output dir
        console.error('Usage: tsx examples/directory-sync.ts download [record-uri|manifest-file] <output-directory>');
        process.exit(1);
      } else {
        // It's an output dir - use latest record
        manifest = await getLatestManifest(agent);
        await downloadDirectory(agent, manifest, path);
      }
    } else {
      // Both args provided
      if (path.startsWith('at://')) {
        // It's a record URI
        manifest = await loadManifestFromRecord(agent, path);
      } else {
        // It's a local file (backward compatibility)
        manifest = await loadManifestFromFile(path);
      }
      await downloadDirectory(agent, manifest, outputDir);
    }

  } else if (command === 'list') {
    // List all directory sync records
    console.log('\n📋 Listing directory sync records...');

    const records = await agent.api.com.atproto.repo.listRecords({
      repo: agent.session!.did,
      collection: 'ai.focus.sync.directory',
      limit: 50,
    });

    console.log(`\nFound ${records.data.records.length} directory sync records:\n`);

    records.data.records.forEach((record: any, index: number) => {
      const value = record.value;
      console.log(`${index + 1}. ${value.name}`);
      console.log(`   URI: ${record.uri}`);
      console.log(`   Files: ${value.files?.length || 0}`);
      console.log(`   Size: ${value.totalSize || 0} bytes`);
      console.log(`   Created: ${new Date(value.createdAt).toLocaleString()}`);
      console.log('');
    });

  } else if (command === 'delete') {
    if (!path) {
      console.error('Usage: tsx directory-sync/sync.ts delete <record-uri>');
      console.error('\nGet the record URI from: npm run sync list');
      process.exit(1);
    }

    console.log(`\n🗑️  Deleting directory sync record: ${path}`);

    // Parse AT URI: at://did:plc:abc123/ai.focus.sync.directory/abc123
    const uriParts = path.replace('at://', '').split('/');
    const repo = uriParts[0];
    const collection = uriParts.slice(1, -1).join('.');
    const rkey = uriParts[uriParts.length - 1];

    // Verify it's the user's own record
    if (repo !== agent.session!.did) {
      console.error('❌ Error: You can only delete your own records');
      process.exit(1);
    }

    try {
      // Delete the record
      await agent.api.com.atproto.repo.deleteRecord({
        repo: agent.session!.did,
        collection,
        rkey,
      });

      console.log('✅ Record deleted successfully');
      console.log('\n⚠️  Note: The blobs referenced by this record still exist on the server.');
      console.log('   They will be garbage collected if no other records reference them.');
    } catch (error: any) {
      console.error(`❌ Error deleting record: ${error.message}`);
      process.exit(1);
    }

  } else {
    console.log(`
Directory Sync Utility for AT Protocol Blob Store

Usage:
  Upload a directory:
    npm run sync upload <directory-path>

  Download a directory:
    npm run sync download [record-uri] <output-directory>

  List synced directories:
    npm run sync list

  Delete a synced directory:
    npm run sync delete <record-uri>

Examples:
  # Upload a directory
  npm run sync upload ./my-documents

  # Download latest sync to ./restored-dir
  npm run sync download

  # Download latest sync to specific directory
  npm run sync download ./my-restored-files

  # Download specific record by URI
  npm run sync download at://did:plc:.../ai.focus.sync.directory/... ./restored

  # List all synced directories (shows record URIs)
  npm run sync list

  # Delete a synced directory record
  npm run sync delete at://did:plc:.../ai.focus.sync.directory/...

How it works:
  1. Upload: Walks through directory, uploads each file as a blob
  2. Manifest: Creates a custom record (ai.focus.sync.directory) with all blob references
  3. Anchor: Blobs are anchored to the record, making them retrievable
  4. Download: Fetches manifest from record and reconstructs directory structure
  5. Delete: Removes the manifest record (blobs are garbage collected if unreferenced)

Note:
  - Blobs are downloaded from: https://bsky.social/xrpc/com.atproto.sync.getBlob?did={did}&cid={cid}
  - Record URIs from 'list' command can be used to download/delete specific versions
  - Deleting a record does not immediately delete blobs (they're garbage collected)
  - Backward compatible with local manifest files for legacy usage
    `);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
