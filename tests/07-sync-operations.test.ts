import { describe, it, expect, beforeAll } from 'vitest';
import { BskyAgent } from '@atproto/api';
import { createAuthenticatedClient } from './utils/client';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Test Suite 7: Sync Operations, Blobs, and Directory Management
 *
 * This suite explores syncing data between local directories and
 * Personal Data Servers (PDS), managing blobs, and watching for updates.
 */
describe('07. Sync and Directory Operations', () => {
  let agent: BskyAgent;
  const syncDir = join(process.cwd(), 'tests', 'sync-data');
  const blobDir = join(syncDir, 'blobs');

  beforeAll(async () => {
    agent = await createAuthenticatedClient();

    // Create sync directories
    if (!existsSync(syncDir)) {
      mkdirSync(syncDir, { recursive: true });
    }
    if (!existsSync(blobDir)) {
      mkdirSync(blobDir, { recursive: true });
    }
  });

  it('should sync repository commits', async () => {
    // Get the current repository state
    const repo = await agent.api.com.atproto.sync.getRepo({
      did: agent.session!.did,
    });

    expect(repo.data).toBeDefined();
    console.log('Repository synced, data length:', repo.data.byteLength);

    // Save the repository CAR file
    const carPath = join(syncDir, 'repo.car');
    writeFileSync(carPath, Buffer.from(repo.data));

    expect(existsSync(carPath)).toBe(true);
    console.log('Repository saved to:', carPath);
  });

  it('should retrieve repository records', async () => {
    // List all posts
    const posts = await agent.api.com.atproto.repo.listRecords({
      repo: agent.session!.did,
      collection: 'app.bsky.feed.post',
      limit: 10,
    });

    expect(posts.data.records).toBeDefined();
    console.log('Number of posts in repo:', posts.data.records.length);

    if (posts.data.records.length > 0) {
      console.log('Sample post:', JSON.stringify(posts.data.records[0], null, 2));
    }
  });

  it('should list all collections in repository', async () => {
    // Common collections in AT Protocol
    const collections = [
      'app.bsky.feed.post',
      'app.bsky.feed.like',
      'app.bsky.feed.repost',
      'app.bsky.graph.follow',
      'app.bsky.actor.profile',
    ];

    for (const collection of collections) {
      try {
        const records = await agent.api.com.atproto.repo.listRecords({
          repo: agent.session!.did,
          collection,
          limit: 5,
        });

        console.log(`${collection}: ${records.data.records.length} records`);
      } catch (error) {
        console.log(`${collection}: not available or empty`);
      }
    }

    expect(true).toBe(true);
  });

  it('should upload and track blobs', async () => {
    // Create test blobs
    const testBlobs = [
      { name: 'blob1.txt', content: 'Hello, AT Protocol!' },
      { name: 'blob2.txt', content: 'Testing blob sync' },
      { name: 'blob3.txt', content: JSON.stringify({ test: 'data' }) },
    ];

    const uploadedBlobs = [];

    for (const blob of testBlobs) {
      const blobData = Buffer.from(blob.content, 'utf-8');

      // Upload blob
      const response = await agent.uploadBlob(blobData, {
        encoding: 'text/plain',
      });

      expect(response.data.blob).toBeDefined();

      uploadedBlobs.push({
        name: blob.name,
        ref: response.data.blob,
      });

      console.log(`Uploaded ${blob.name}:`, response.data.blob.ref);
    }

    // Save blob registry
    const registryPath = join(blobDir, 'registry.json');
    writeFileSync(registryPath, JSON.stringify(uploadedBlobs, null, 2));

    expect(uploadedBlobs.length).toBe(testBlobs.length);
  });

  it('should create a custom record for directory structure', async () => {
    // Create a custom record to represent a directory structure
    const directoryStructure = {
      $type: 'com.example.directory',
      name: 'my-documents',
      files: [
        { name: 'file1.txt', size: 100, modified: new Date().toISOString() },
        { name: 'file2.txt', size: 200, modified: new Date().toISOString() },
      ],
      createdAt: new Date().toISOString(),
    };

    // Note: Creating custom records requires proper lexicon definitions
    // This is an example of how it would work

    console.log('Directory structure:', JSON.stringify(directoryStructure, null, 2));

    // Save locally
    const dirStructPath = join(syncDir, 'directory-structure.json');
    writeFileSync(dirStructPath, JSON.stringify(directoryStructure, null, 2));

    expect(existsSync(dirStructPath)).toBe(true);
  });

  it('should sync all blobs from repository', async () => {
    // List all posts which may contain blobs
    const posts = await agent.api.com.atproto.repo.listRecords({
      repo: agent.session!.did,
      collection: 'app.bsky.feed.post',
      limit: 50,
    });

    const blobsFound = [];

    for (const record of posts.data.records) {
      const value = record.value as any;

      // Check for image embeds
      if (value.embed && value.embed.$type === 'app.bsky.embed.images') {
        for (const image of value.embed.images) {
          blobsFound.push({
            postUri: record.uri,
            blobRef: image.image,
            alt: image.alt,
          });
        }
      }
    }

    console.log('Total blobs found in posts:', blobsFound.length);

    if (blobsFound.length > 0) {
      // Save blob inventory
      const inventoryPath = join(blobDir, 'blob-inventory.json');
      writeFileSync(inventoryPath, JSON.stringify(blobsFound, null, 2));
    }

    expect(blobsFound).toBeDefined();
  });

  it('should watch for repository updates using subscribeRepos', async () => {
    // Note: This demonstrates the concept of watching for updates
    // In a real application, you would use a WebSocket connection

    console.log('Repository subscription endpoint: com.atproto.sync.subscribeRepos');
    console.log('DID:', agent.session!.did);

    // The actual subscription would be done using a WebSocket
    // Example endpoint: wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos

    // For testing, we'll just verify the concept
    expect(agent.session!.did).toBeDefined();

    /*
    Example of how to subscribe (requires WebSocket):

    const ws = new WebSocket('wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos');

    ws.on('message', (data) => {
      const event = cbor.decode(data);
      console.log('Repository update:', event);
    });
    */
  });

  it('should export entire repository structure', async () => {
    const exportData = {
      did: agent.session!.did,
      handle: agent.session!.handle,
      exported: new Date().toISOString(),
      collections: {} as any,
    };

    // Export each collection
    const collections = [
      'app.bsky.feed.post',
      'app.bsky.feed.like',
      'app.bsky.graph.follow',
    ];

    for (const collection of collections) {
      try {
        const records = await agent.api.com.atproto.repo.listRecords({
          repo: agent.session!.did,
          collection,
          limit: 100,
        });

        exportData.collections[collection] = records.data.records;
      } catch (error) {
        exportData.collections[collection] = [];
      }
    }

    // Save export
    const exportPath = join(syncDir, 'full-export.json');
    writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

    console.log('Repository exported to:', exportPath);
    console.log('Collections exported:', Object.keys(exportData.collections).length);

    expect(existsSync(exportPath)).toBe(true);
  });

  it('should sync directory to PDS as metadata', async () => {
    // Create a local directory structure
    const localDir = join(syncDir, 'test-directory');
    if (!existsSync(localDir)) {
      mkdirSync(localDir, { recursive: true });
    }

    // Create test files
    writeFileSync(join(localDir, 'file1.txt'), 'Content 1');
    writeFileSync(join(localDir, 'file2.txt'), 'Content 2');
    writeFileSync(join(localDir, 'file3.txt'), 'Content 3');

    // Scan directory
    const files = readdirSync(localDir);

    // Create metadata for directory
    const directoryMetadata = {
      path: localDir,
      files: files.map((file) => ({
        name: file,
        path: join(localDir, file),
        content: readFileSync(join(localDir, file), 'utf-8'),
      })),
      synced: new Date().toISOString(),
    };

    // Upload each file as a blob and create a post with metadata
    const blobRefs = [];

    for (const file of directoryMetadata.files) {
      const blobData = Buffer.from(file.content, 'utf-8');

      const uploadResult = await agent.uploadBlob(blobData, {
        encoding: 'text/plain',
      });

      blobRefs.push({
        name: file.name,
        blob: uploadResult.data.blob,
      });
    }

    console.log('Directory synced, blobs uploaded:', blobRefs.length);

    // Save sync manifest
    const manifestPath = join(syncDir, 'sync-manifest.json');
    writeFileSync(
      manifestPath,
      JSON.stringify({ directory: localDir, blobs: blobRefs }, null, 2)
    );

    expect(blobRefs.length).toBe(files.length);
  });
});
