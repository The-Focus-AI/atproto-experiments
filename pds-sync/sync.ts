#!/usr/bin/env tsx
/**
 * PDS Sync Example
 *
 * Downloads and unpacks an entire Personal Data Server (PDS) repository as a CAR file.
 * Extracts all records, collections, and blobs into organized directories for offline backup or analysis.
 *
 * Usage:
 *   npm run pds-sync [did]               # Full sync: download + unpack + organize (defaults to your own)
 *   npm run pds-sync download [did]      # Just download repo as CAR file
 *   npm run pds-sync unpack <car-file>   # Just unpack a CAR file to directory structure
 *   npm run pds-sync list <car-file>     # Just list records in a CAR file
 */

import { BskyAgent } from '@atproto/api';
import { readCar, cborToLexRecord } from '@atproto/repo';
import * as dotenv from 'dotenv';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

dotenv.config();

interface RepoExport {
  did: string;
  handle?: string;
  exported: string;
  carFile: string;
  records: {
    [collection: string]: any[];
  };
  stats: {
    totalRecords: number;
    collections: number;
    size: number;
  };
}

async function downloadRepo(agent: BskyAgent, did?: string): Promise<string> {
  const targetDid = did || agent.session!.did;
  const targetHandle = did ? 'unknown' : agent.session!.handle;

  console.log(`\n📥 Downloading repository for: ${targetHandle}`);
  console.log(`📍 DID: ${targetDid}`);

  // Download the repository as a CAR file
  const repo = await agent.api.com.atproto.sync.getRepo({
    did: targetDid,
  });

  console.log(`✅ Downloaded ${repo.data.byteLength} bytes`);

  // Create export directory
  const exportDir = join(process.cwd(), 'pds-exports');
  if (!existsSync(exportDir)) {
    mkdirSync(exportDir, { recursive: true });
  }

  // Save CAR file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const carPath = join(exportDir, `repo-${targetHandle}-${timestamp}.car`);
  writeFileSync(carPath, Buffer.from(repo.data));

  console.log(`💾 Saved to: ${carPath}`);

  return carPath;
}

async function downloadBlobs(agent: BskyAgent, baseDir: string): Promise<number> {
  console.log('\n📥 Scanning account for blobs...');

  const blobsDir = join(baseDir, '_blobs');
  if (!existsSync(blobsDir)) {
    mkdirSync(blobsDir, { recursive: true });
  }

  const blobs = new Map<string, any>(); // Use Map to store unique blobs with metadata

  // Collections that might contain blobs
  const collectionsToScan = [
    'app.bsky.feed.post',
    'app.bsky.actor.profile',
    'ai.focus.sync.directory',
    // Add more collections as needed
  ];

  console.log('📋 Scanning collections for blob references...');

  // Scan each collection via API (not from CAR)
  for (const collection of collectionsToScan) {
    try {
      const records = await agent.api.com.atproto.repo.listRecords({
        repo: agent.session!.did,
        collection,
        limit: 100,
      });

      console.log(`  🔍 ${collection}: ${records.data.records.length} records`);

      // Extract blobs from each record
      for (const record of records.data.records) {
        const value = record.value as any;

        // Check for image embeds in posts
        if (value.embed && value.embed.$type === 'app.bsky.embed.images') {
          for (const image of value.embed.images) {
            let cid = image.image.ref?.$link || image.image.ref;
            // Convert CID object to string if needed
            if (cid && typeof cid === 'object' && cid.toString) {
              cid = cid.toString();
            }
            if (cid && typeof cid === 'string') {
              blobs.set(cid, {
                cid,
                mimeType: image.image.mimeType || 'image/*',
                size: image.image.size || 0,
                alt: image.alt,
                source: `${collection}:${record.uri}`,
              });
            }
          }
        }

        // Check for profile avatar/banner
        if (collection === 'app.bsky.actor.profile') {
          if (value.avatar) {
            let cid = value.avatar.ref?.$link || value.avatar.ref;
            if (cid && typeof cid === 'object' && cid.toString) cid = cid.toString();
            if (cid && typeof cid === 'string') {
              blobs.set(cid, {
                cid,
                mimeType: value.avatar.mimeType || 'image/*',
                size: value.avatar.size || 0,
                type: 'avatar',
                source: record.uri,
              });
            }
          }
          if (value.banner) {
            let cid = value.banner.ref?.$link || value.banner.ref;
            if (cid && typeof cid === 'object' && cid.toString) cid = cid.toString();
            if (cid && typeof cid === 'string') {
              blobs.set(cid, {
                cid,
                mimeType: value.banner.mimeType || 'image/*',
                size: value.banner.size || 0,
                type: 'banner',
                source: record.uri,
              });
            }
          }
        }

        // Check for custom directory sync blobs
        if (collection === 'ai.focus.sync.directory' && value.files) {
          for (const file of value.files) {
            let cid = file.blobRef?.ref?.$link || file.blobRef?.ref;
            if (cid && typeof cid === 'object' && cid.toString) cid = cid.toString();
            if (cid && typeof cid === 'string') {
              blobs.set(cid, {
                cid,
                mimeType: file.mimeType || file.blobRef?.mimeType || 'application/octet-stream',
                size: file.size || file.blobRef?.size || 0,
                path: file.path,
                source: record.uri,
              });
            }
          }
        }
      }
    } catch (error) {
      console.log(`  ⚠️  ${collection}: Collection not available`);
    }
  }

  console.log(`\n📊 Found ${blobs.size} unique blobs`);

  if (blobs.size === 0) {
    console.log('✅ No blobs to download');
    return 0;
  }

  let successCount = 0;
  let errorCount = 0;

  // Download each blob
  for (const [cid, metadata] of blobs.entries()) {
    try {
      // Fetch the blob using the PDS endpoint
      const cidStr = String(cid);
      const blobUrl = `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${agent.session!.did}&cid=${cidStr}`;

      const response = await fetch(blobUrl);

      if (!response.ok) {
        console.log(`  ⚠️  ${cidStr.substring(0, 20)}... - HTTP ${response.status}`);
        errorCount++;
        continue;
      }

      const blobData = await response.arrayBuffer();
      const blobPath = join(blobsDir, cidStr);
      writeFileSync(blobPath, Buffer.from(blobData));

      successCount++;
      if (successCount % 10 === 0) {
        console.log(`  📥 Downloaded ${successCount}/${blobs.size} blobs...`);
      }
    } catch (error: any) {
      const cidStr = String(cid);
      console.log(`  ❌ ${cidStr.substring(0, 20)}... - ${error.message}`);
      errorCount++;
    }
  }

  // Save blob metadata
  writeFileSync(
    join(blobsDir, '_index.json'),
    JSON.stringify(Array.from(blobs.values()), null, 2)
  );

  console.log(`\n✅ Downloaded ${successCount} blobs`);
  if (errorCount > 0) {
    console.log(`⚠️  Failed to download ${errorCount} blobs`);
  }
  console.log(`💾 Blobs saved to: ${blobsDir}/`);

  return successCount;
}

async function unpackCar(carPath: string, createDirs: boolean = true): Promise<RepoExport> {
  console.log(`\n📦 Unpacking CAR file: ${carPath}`);

  const carData = readFileSync(carPath);
  const car = await readCar(carData);

  console.log(`📊 CAR contains ${car.blocks.size} blocks`);
  console.log(`🔑 Root CIDs: ${car.roots.map(r => r.toString()).join(', ')}`);

  // Extract all records by collection
  const records: { [collection: string]: any[] } = {};
  let totalRecords = 0;

  // Iterate through all blocks to find records
  car.blocks.forEach((bytes, cid) => {
    try {
      // Decode the CBOR block to a Lexicon record
      const record = cborToLexRecord(bytes);

      if (record && typeof record === 'object' && record.$type) {
        const recordType = record.$type;

        if (!records[recordType]) {
          records[recordType] = [];
        }

        records[recordType].push({
          cid: cid.toString(),
          ...record,
        });

        totalRecords++;
      }
    } catch (error) {
      // Skip blocks that aren't records (like commit objects, MST nodes, etc.)
    }
  });

  console.log(`\n✅ Extracted ${totalRecords} records across ${Object.keys(records).length} collections`);

  const exportData: RepoExport = {
    did: 'unknown', // Will be extracted from car if available
    exported: new Date().toISOString(),
    carFile: carPath,
    records,
    stats: {
      totalRecords,
      collections: Object.keys(records).length,
      size: carData.byteLength,
    },
  };

  if (createDirs) {
    // Create organized directory structure
    const baseDir = carPath.replace('.car', '');

    console.log(`\n📁 Creating directory structure: ${baseDir}/`);

    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }

    // Save metadata
    writeFileSync(
      join(baseDir, '_metadata.json'),
      JSON.stringify({
        did: exportData.did,
        exported: exportData.exported,
        carFile: carPath,
        stats: exportData.stats,
      }, null, 2)
    );

    // Create a directory for each collection
    for (const [collection, collectionRecords] of Object.entries(records)) {
      const collectionDir = join(baseDir, collection.replace(/\./g, '-'));

      if (!existsSync(collectionDir)) {
        mkdirSync(collectionDir, { recursive: true });
      }

      // Save each record as a separate file
      collectionRecords.forEach((record, index) => {
        const filename = join(collectionDir, `${index + 1}.json`);
        writeFileSync(filename, JSON.stringify(record, null, 2));
      });

      console.log(`  ✅ ${collection}: ${collectionRecords.length} records → ${collectionDir}/`);
    }

    // Also save the complete export
    writeFileSync(join(baseDir, '_complete.json'), JSON.stringify(exportData, null, 2));

    console.log(`\n💾 Complete export saved to: ${baseDir}/`);
  } else {
    // Just save JSON file (backward compatibility)
    const jsonPath = carPath.replace('.car', '.json');
    writeFileSync(jsonPath, JSON.stringify(exportData, null, 2));
    console.log(`💾 Unpacked data saved to: ${jsonPath}`);
  }

  return exportData;
}

async function listRecords(carPath: string): Promise<void> {
  console.log(`\n📋 Listing records in: ${carPath}`);

  const carData = readFileSync(carPath);
  const car = await readCar(carData);

  const collections = new Map<string, number>();

  // Count records by type
  car.blocks.forEach((bytes, cid) => {
    try {
      const record = cborToLexRecord(bytes);

      if (record && typeof record === 'object' && record.$type) {
        const count = collections.get(record.$type) || 0;
        collections.set(record.$type, count + 1);
      }
    } catch (error) {
      // Skip blocks that aren't records
    }
  });

  console.log('\n📊 Records by collection:');
  console.log('─'.repeat(60));

  for (const [collection, count] of collections.entries()) {
    console.log(`  ${collection.padEnd(45)} ${count.toString().padStart(6)}`);
  }

  console.log('─'.repeat(60));
  console.log(`  ${'TOTAL'.padEnd(45)} ${Array.from(collections.values()).reduce((a, b) => a + b, 0).toString().padStart(6)}`);
}

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  // Check if first arg looks like a DID or is a subcommand
  const isSubcommand = command && ['download', 'unpack', 'list'].includes(command);

  if (command === '--help' || command === '-h') {
    console.log(`
PDS Sync - Download and unpack AT Protocol repositories

Usage:
  npm run pds-sync [did]               Full sync: download + unpack + organize (default)
  npm run pds-sync download [did]      Just download repo as CAR file
  npm run pds-sync unpack <car-file>   Just unpack a CAR file to directories
  npm run pds-sync list <car-file>     Just list records in a CAR file

Examples:
  npm run pds-sync                                    # Full sync of your repo
  npm run pds-sync did:plc:abc123                     # Full sync of specific DID
  npm run pds-sync download                            # Just download
  npm run pds-sync unpack pds-exports/repo-*.car      # Just unpack
  npm run pds-sync list pds-exports/repo-*.car        # Just list
`);
    process.exit(0);
  }

  // Default behavior: full sync (download + unpack)
  if (!command || (!isSubcommand && command.startsWith('did:'))) {
    const targetDid = command && command.startsWith('did:') ? command : undefined;

    // Login to get authenticated agent
    const service = process.env.ATP_SERVICE || 'https://bsky.social';
    const agent = new BskyAgent({ service });
    await agent.login({
      identifier: process.env.BLUESKY_HANDLE!,
      password: process.env.BLUESKY_PASSWORD!,
    });

    console.log('🔐 Logged in as:', agent.session?.handle);
    console.log('📍 DID:', agent.session?.did);

    // Step 1: Download
    const carPath = await downloadRepo(agent, targetDid);

    // Step 2: Unpack
    const exportData = await unpackCar(carPath, true);

    // Step 3: Download blobs
    const baseDir = carPath.replace('.car', '');
    const blobCount = await downloadBlobs(agent, baseDir);

    console.log('\n✨ Full sync complete!');
    console.log('\n📊 Summary:');
    console.log(`  Total records: ${exportData.stats.totalRecords}`);
    console.log(`  Collections: ${exportData.stats.collections}`);
    console.log(`  Blobs downloaded: ${blobCount}`);
    for (const [collection, records] of Object.entries(exportData.records)) {
      console.log(`    • ${collection}: ${records.length} records`);
    }

    process.exit(0);
  }

  if (command === 'download') {
    // Login to get authenticated agent
    const service = process.env.ATP_SERVICE || 'https://bsky.social';
    const agent = new BskyAgent({ service });
    await agent.login({
      identifier: process.env.BLUESKY_HANDLE!,
      password: process.env.BLUESKY_PASSWORD!,
    });

    console.log('🔐 Logged in as:', agent.session?.handle);
    console.log('📍 DID:', agent.session?.did);

    const carPath = await downloadRepo(agent, arg);

    console.log('\n✨ Download complete!');
    console.log('\nNext steps:');
    console.log(`  npm run pds-sync list ${carPath}`);
    console.log(`  npm run pds-sync unpack ${carPath}`);
  } else if (command === 'unpack') {
    if (!arg) {
      console.error('❌ Please specify a CAR file to unpack');
      process.exit(1);
    }

    if (!existsSync(arg)) {
      console.error(`❌ File not found: ${arg}`);
      process.exit(1);
    }

    const exportData = await unpackCar(arg, true);

    console.log('\n📊 Collections extracted:');
    for (const [collection, records] of Object.entries(exportData.records)) {
      console.log(`  ${collection}: ${records.length} records`);
    }
  } else if (command === 'list') {
    if (!arg) {
      console.error('❌ Please specify a CAR file to list');
      process.exit(1);
    }

    if (!existsSync(arg)) {
      console.error(`❌ File not found: ${arg}`);
      process.exit(1);
    }

    await listRecords(arg);
  } else {
    console.error(`❌ Unknown command: ${command}`);
    console.log('Run "npm run pds-sync --help" for usage information');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
