#!/usr/bin/env tsx
/**
 * Firehose Private Groups Filter
 *
 * Connects to the Bluesky firehose and filters for ai.thefocus.groups.*
 * records, storing them in a JSON database file.
 *
 * Usage:
 *   npx tsx firehose-filter/firehose-filter.ts [output-file] [--limit=N]
 *
 * Options:
 *   output-file    JSON file to store records (default: ./output/private-groups-db.json)
 *   --limit=N      Stop after collecting N records (default: unlimited)
 *   --groups       Only collect group records
 *   --memberships  Only collect membership records
 *   --messages     Only collect message records
 */

import { Firehose } from '@atproto/sync';
import { IdResolver } from '@atproto/identity';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import {
  GROUP_COLLECTION,
  MEMBERSHIP_COLLECTION,
  MESSAGE_COLLECTION,
  GroupRecord,
  MembershipRecord,
  MessageRecord,
} from '../private-groups/types';

interface StoredRecord {
  uri: string;
  cid: string;
  did: string;
  rkey: string;
  collection: string;
  record: GroupRecord | MembershipRecord | MessageRecord;
  indexedAt: string;
}

interface Database {
  groups: StoredRecord[];
  memberships: StoredRecord[];
  messages: StoredRecord[];
  metadata: {
    lastUpdated: string;
    totalRecords: number;
    startedAt: string;
  };
}

interface FilterStats {
  totalEvents: number;
  groupsFound: number;
  membershipsFound: number;
  messagesFound: number;
  errors: number;
  startTime: Date;
}

// Parse command line arguments
const args = process.argv.slice(2);
const outputFile = args.find(arg => !arg.startsWith('--')) || './output/private-groups-db.json';
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const groupsOnly = args.includes('--groups');
const membershipsOnly = args.includes('--memberships');
const messagesOnly = args.includes('--messages');

// Ensure output directory exists
const outputDir = dirname(outputFile);
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Load or create database
let db: Database;
if (existsSync(outputFile)) {
  try {
    db = JSON.parse(readFileSync(outputFile, 'utf-8'));
    console.log(`Loaded existing database with ${db.metadata.totalRecords} records`);
  } catch {
    db = createEmptyDatabase();
  }
} else {
  db = createEmptyDatabase();
}

function createEmptyDatabase(): Database {
  return {
    groups: [],
    memberships: [],
    messages: [],
    metadata: {
      lastUpdated: new Date().toISOString(),
      totalRecords: 0,
      startedAt: new Date().toISOString(),
    },
  };
}

// Statistics
const stats: FilterStats = {
  totalEvents: 0,
  groupsFound: 0,
  membershipsFound: 0,
  messagesFound: 0,
  errors: 0,
  startTime: new Date(),
};

// Track seen URIs to avoid duplicates
const seenUris = new Set<string>([
  ...db.groups.map(r => r.uri),
  ...db.memberships.map(r => r.uri),
  ...db.messages.map(r => r.uri),
]);

/**
 * Save database to file
 */
function saveDatabase() {
  db.metadata.lastUpdated = new Date().toISOString();
  db.metadata.totalRecords = db.groups.length + db.memberships.length + db.messages.length;
  writeFileSync(outputFile, JSON.stringify(db, null, 2));
}

/**
 * Add a record to the database
 */
function addRecord(storedRecord: StoredRecord): boolean {
  if (seenUris.has(storedRecord.uri)) {
    return false; // Already have this record
  }

  seenUris.add(storedRecord.uri);

  switch (storedRecord.collection) {
    case GROUP_COLLECTION:
      db.groups.push(storedRecord);
      stats.groupsFound++;
      console.log(`\n  Group: ${(storedRecord.record as GroupRecord).name}`);
      console.log(`    URI: ${storedRecord.uri}`);
      console.log(`    Visibility: ${(storedRecord.record as GroupRecord).visibility}`);
      break;

    case MEMBERSHIP_COLLECTION:
      db.memberships.push(storedRecord);
      stats.membershipsFound++;
      const membership = storedRecord.record as MembershipRecord;
      console.log(`\n  Membership: ${membership.memberDid}`);
      console.log(`    Role: ${membership.role}`);
      console.log(`    Group: ${membership.groupUri}`);
      break;

    case MESSAGE_COLLECTION:
      db.messages.push(storedRecord);
      stats.messagesFound++;
      const message = storedRecord.record as MessageRecord;
      console.log(`\n  Message in group: ${message.groupUri}`);
      console.log(`    Encrypted: ${message.isEncrypted}`);
      console.log(`    Preview: ${message.text?.substring(0, 50)}${message.text?.length > 50 ? '...' : ''}`);
      break;
  }

  // Save every 10 records
  if ((stats.groupsFound + stats.membershipsFound + stats.messagesFound) % 10 === 0) {
    saveDatabase();
  }

  return true;
}

/**
 * Print statistics
 */
function printStats() {
  const elapsed = (Date.now() - stats.startTime.getTime()) / 1000;
  const totalFound = stats.groupsFound + stats.membershipsFound + stats.messagesFound;

  console.log('\n' + '-'.repeat(60));
  console.log('Statistics:');
  console.log('-'.repeat(60));
  console.log(`  Total events processed: ${stats.totalEvents.toLocaleString()}`);
  console.log(`  Groups found:           ${stats.groupsFound.toLocaleString()}`);
  console.log(`  Memberships found:      ${stats.membershipsFound.toLocaleString()}`);
  console.log(`  Messages found:         ${stats.messagesFound.toLocaleString()}`);
  console.log(`  Total records:          ${totalFound.toLocaleString()}`);
  console.log(`  Errors:                 ${stats.errors.toLocaleString()}`);
  console.log(`  Running time:           ${elapsed.toFixed(1)}s`);
  console.log(`  Rate:                   ${(stats.totalEvents / elapsed).toFixed(1)} events/sec`);
  console.log('-'.repeat(60));
  console.log(`Database saved to: ${outputFile}`);
  console.log('-'.repeat(60));
}

/**
 * Main function
 */
async function main() {
  console.log('\nBluesky Firehose Private Groups Filter');
  console.log('-'.repeat(60));
  console.log(`Output file:      ${outputFile}`);
  console.log(`Existing records: ${db.metadata.totalRecords}`);
  if (limit) {
    console.log(`Record limit:     ${limit}`);
  }
  if (groupsOnly) {
    console.log(`Filter:           Groups only`);
  } else if (membershipsOnly) {
    console.log(`Filter:           Memberships only`);
  } else if (messagesOnly) {
    console.log(`Filter:           Messages only`);
  } else {
    console.log(`Filter:           All ai.thefocus.groups.* records`);
  }
  console.log('-'.repeat(60));
  console.log('Connecting to firehose...\n');

  const idResolver = new IdResolver();

  // Build list of collections to filter
  const collections: string[] = [];
  if (!groupsOnly && !membershipsOnly && !messagesOnly) {
    collections.push(GROUP_COLLECTION, MEMBERSHIP_COLLECTION, MESSAGE_COLLECTION);
  } else {
    if (groupsOnly) collections.push(GROUP_COLLECTION);
    if (membershipsOnly) collections.push(MEMBERSHIP_COLLECTION);
    if (messagesOnly) collections.push(MESSAGE_COLLECTION);
  }

  const firehose = new Firehose({
    idResolver,
    service: 'wss://bsky.network',
    handleEvent: async (evt) => {
      stats.totalEvents++;

      // Only process create events
      if (evt.event !== 'create') return;

      // Check if this is a collection we care about
      if (!collections.includes(evt.collection)) return;

      try {
        const storedRecord: StoredRecord = {
          uri: `at://${evt.did}/${evt.collection}/${evt.rkey}`,
          cid: evt.cid.toString(),
          did: evt.did,
          rkey: evt.rkey,
          collection: evt.collection,
          record: evt.record as GroupRecord | MembershipRecord | MessageRecord,
          indexedAt: new Date().toISOString(),
        };

        const added = addRecord(storedRecord);

        if (added) {
          // Check if we've hit the limit
          const totalFound = stats.groupsFound + stats.membershipsFound + stats.messagesFound;
          if (limit && totalFound >= limit) {
            console.log(`\nReached record limit of ${limit}`);
            saveDatabase();
            printStats();
            await firehose.destroy();
            process.exit(0);
          }
        }
      } catch (error: any) {
        stats.errors++;
        console.error(`\nError processing record: ${error.message}`);
      }

      // Print progress every 1000 events
      if (stats.totalEvents % 1000 === 0) {
        const totalFound = stats.groupsFound + stats.membershipsFound + stats.messagesFound;
        process.stdout.write(
          `\rProcessed ${stats.totalEvents.toLocaleString()} events | Found: ${totalFound} records (${stats.groupsFound}G/${stats.membershipsFound}M/${stats.messagesFound}Msg)`
        );
      }
    },
    onError: (err) => {
      console.error('\nFirehose error:', err.message);
      stats.errors++;
    },
    filterCollections: collections,
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    saveDatabase();
    printStats();
    await firehose.destroy();
    process.exit(0);
  });

  // Start the firehose
  firehose.start();

  console.log('Connected! Listening for private groups records...\n');
  console.log('Looking for collections:');
  collections.forEach(c => console.log(`  - ${c}`));
  console.log('\nPress Ctrl+C to stop\n');
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  saveDatabase();
  process.exit(1);
});
