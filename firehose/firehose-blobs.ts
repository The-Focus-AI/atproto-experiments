#!/usr/bin/env tsx
/**
 * Firehose Blob Downloader
 *
 * Connects to the Bluesky firehose and downloads image and video blobs
 * to a local directory in real-time.
 *
 * Usage:
 *   npm run firehose [output-directory] [--limit=N]
 *
 * Options:
 *   output-directory   Directory to save blobs (default: ./firehose-blobs)
 *   --limit=N          Stop after downloading N blobs (default: unlimited)
 *   --images-only      Only download images (skip videos)
 *   --videos-only      Only download videos (skip images)
 */

import { Firehose } from '@atproto/sync';
import { IdResolver } from '@atproto/identity';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

interface BlobDownloadStats {
  totalPosts: number;
  postsWithBlobs: number;
  imagesDownloaded: number;
  videosDownloaded: number;
  errors: number;
  startTime: Date;
}

interface BlobInfo {
  cid: string;
  mimeType: string;
  size: number;
  did: string;
  rkey: string;
  alt?: string;
}

// Parse command line arguments
const args = process.argv.slice(2);
const outputDir = args.find(arg => !arg.startsWith('--')) || './firehose-blobs';
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const imagesOnly = args.includes('--images-only');
const videosOnly = args.includes('--videos-only');

// Create output directories
const imagesDir = join(outputDir, 'images');
const videosDir = join(outputDir, 'videos');
const metadataDir = join(outputDir, 'metadata');

for (const dir of [outputDir, imagesDir, videosDir, metadataDir]) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Statistics
const stats: BlobDownloadStats = {
  totalPosts: 0,
  postsWithBlobs: 0,
  imagesDownloaded: 0,
  videosDownloaded: 0,
  errors: 0,
  startTime: new Date(),
};

// Track downloaded blobs to avoid duplicates
const downloadedCids = new Set<string>();

/**
 * Download a blob from Bluesky's CDN
 */
async function downloadBlob(blob: BlobInfo): Promise<boolean> {
  if (downloadedCids.has(blob.cid)) {
    return false; // Already downloaded
  }

  const isImage = blob.mimeType.startsWith('image/');
  const isVideo = blob.mimeType.startsWith('video/');

  // Apply filters
  if (imagesOnly && !isImage) return false;
  if (videosOnly && !isVideo) return false;

  try {
    // Construct blob URL
    const blobUrl = `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${blob.did}&cid=${blob.cid}`;

    // Download blob
    const response = await fetch(blobUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine file extension from mime type
    const ext = getFileExtension(blob.mimeType);
    const targetDir = isImage ? imagesDir : videosDir;
    const filename = `${blob.cid}${ext}`;
    const filepath = join(targetDir, filename);

    // Save blob
    writeFileSync(filepath, buffer);

    // Save metadata
    const metadata = {
      cid: blob.cid,
      mimeType: blob.mimeType,
      size: blob.size,
      downloadedSize: buffer.byteLength,
      did: blob.did,
      rkey: blob.rkey,
      alt: blob.alt,
      timestamp: new Date().toISOString(),
      url: blobUrl,
      postUrl: `https://bsky.app/profile/${blob.did}/post/${blob.rkey}`,
    };

    const metadataPath = join(metadataDir, `${blob.cid}.json`);
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // Update stats
    downloadedCids.add(blob.cid);
    if (isImage) {
      stats.imagesDownloaded++;
    } else if (isVideo) {
      stats.videosDownloaded++;
    }

    console.log(`  ✅ Downloaded ${isImage ? 'image' : 'video'}: ${filename} (${formatBytes(buffer.byteLength)})`);
    console.log(`     Post: https://bsky.app/profile/${blob.did}/post/${blob.rkey}`);

    return true;
  } catch (error: any) {
    stats.errors++;
    console.error(`  ❌ Error downloading ${blob.cid}: ${error.message}`);
    return false;
  }
}

/**
 * Get file extension from MIME type
 */
function getFileExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/mpeg': '.mpeg',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
  };

  return extensions[mimeType] || '';
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Print statistics
 */
function printStats() {
  const elapsed = (Date.now() - stats.startTime.getTime()) / 1000;
  const totalBlobs = stats.imagesDownloaded + stats.videosDownloaded;

  console.log('\n' + '─'.repeat(60));
  console.log('📊 Statistics:');
  console.log('─'.repeat(60));
  console.log(`  Posts processed:      ${stats.totalPosts.toLocaleString()}`);
  console.log(`  Posts with blobs:     ${stats.postsWithBlobs.toLocaleString()}`);
  console.log(`  Images downloaded:    ${stats.imagesDownloaded.toLocaleString()}`);
  console.log(`  Videos downloaded:    ${stats.videosDownloaded.toLocaleString()}`);
  console.log(`  Total blobs:          ${totalBlobs.toLocaleString()}`);
  console.log(`  Errors:               ${stats.errors.toLocaleString()}`);
  console.log(`  Running time:         ${elapsed.toFixed(1)}s`);
  console.log(`  Rate:                 ${(stats.totalPosts / elapsed).toFixed(1)} posts/sec`);
  console.log('─'.repeat(60));
}

/**
 * Main function
 */
async function main() {
  console.log('\n🔥 Bluesky Firehose Blob Downloader');
  console.log('─'.repeat(60));
  console.log(`Output directory: ${outputDir}`);
  console.log(`Images directory: ${imagesDir}`);
  console.log(`Videos directory: ${videosDir}`);
  if (limit) {
    console.log(`Download limit:   ${limit} blobs`);
  }
  if (imagesOnly) {
    console.log(`Filter:           Images only`);
  } else if (videosOnly) {
    console.log(`Filter:           Videos only`);
  }
  console.log('─'.repeat(60));
  console.log('Connecting to firehose...\n');

  const idResolver = new IdResolver();

  const firehose = new Firehose({
    idResolver,
    service: 'wss://bsky.network',
    handleEvent: async (evt) => {
      // We only care about create events for posts
      if (evt.event !== 'create') return;

      // Only process post records
      if (evt.collection !== 'app.bsky.feed.post') return;

      stats.totalPosts++;

      // Extract the record
      const record = evt.record as any;

      // Check if post has embeds with blobs
      if (!record.embed) return;

      const blobs: BlobInfo[] = [];

      // Extract image embeds
      if (record.embed.$type === 'app.bsky.embed.images') {
        for (const image of record.embed.images || []) {
          if (image.image?.ref) {
            blobs.push({
              cid: image.image.ref.$link || image.image.ref.toString(),
              mimeType: image.image.mimeType || 'image/jpeg',
              size: image.image.size || 0,
              did: evt.did,
              rkey: evt.rkey,
              alt: image.alt,
            });
          }
        }
      }

      // Extract video embeds
      if (record.embed.$type === 'app.bsky.embed.video') {
        const video = record.embed.video;
        if (video?.ref) {
          blobs.push({
            cid: video.ref.$link || video.ref.toString(),
            mimeType: video.mimeType || 'video/mp4',
            size: video.size || 0,
            did: evt.did,
            rkey: evt.rkey,
          });
        }
      }

      // Handle external embeds with images (like link previews)
      if (record.embed.$type === 'app.bsky.embed.external') {
        const external = record.embed.external;
        if (external?.thumb?.ref) {
          blobs.push({
            cid: external.thumb.ref.$link || external.thumb.ref.toString(),
            mimeType: external.thumb.mimeType || 'image/jpeg',
            size: external.thumb.size || 0,
            did: evt.did,
            rkey: evt.rkey,
          });
        }
      }

      // Handle record with media embeds (quote posts with images)
      if (record.embed.$type === 'app.bsky.embed.recordWithMedia') {
        const media = record.embed.media;

        if (media?.$type === 'app.bsky.embed.images') {
          for (const image of media.images || []) {
            if (image.image?.ref) {
              blobs.push({
                cid: image.image.ref.$link || image.image.ref.toString(),
                mimeType: image.image.mimeType || 'image/jpeg',
                size: image.image.size || 0,
                did: evt.did,
                rkey: evt.rkey,
                alt: image.alt,
              });
            }
          }
        }

        if (media?.$type === 'app.bsky.embed.video') {
          const video = media.video;
          if (video?.ref) {
            blobs.push({
              cid: video.ref.$link || video.ref.toString(),
              mimeType: video.mimeType || 'video/mp4',
              size: video.size || 0,
              did: evt.did,
              rkey: evt.rkey,
            });
          }
        }
      }

      // Download all blobs found in this post
      if (blobs.length > 0) {
        stats.postsWithBlobs++;
        console.log(`\n📦 Found ${blobs.length} blob(s) in post`);

        for (const blob of blobs) {
          await downloadBlob(blob);

          // Check if we've hit the limit
          if (limit && (stats.imagesDownloaded + stats.videosDownloaded) >= limit) {
            console.log(`\n✨ Reached download limit of ${limit} blobs`);
            printStats();
            await firehose.destroy();
            process.exit(0);
          }
        }
      }

      // Print stats every 100 posts
      if (stats.totalPosts % 100 === 0) {
        process.stdout.write(`\r📊 Processed ${stats.totalPosts} posts | ${stats.imagesDownloaded} images | ${stats.videosDownloaded} videos`);
      }
    },
    onError: (err) => {
      console.error('\n❌ Firehose error:', err.message);
      stats.errors++;
    },
    filterCollections: ['app.bsky.feed.post'],
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    printStats();
    await firehose.destroy();
    process.exit(0);
  });

  // Start the firehose
  firehose.start();

  console.log('✅ Connected! Listening for posts with media...\n');
  console.log('Press Ctrl+C to stop\n');
}

main().catch((error) => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
