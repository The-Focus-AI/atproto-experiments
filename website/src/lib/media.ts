import { BskyAgent, BlobRef } from '@atproto/api';
import * as fs from 'fs';
import * as path from 'path';
import { MediaFile, ArticleBlob } from './types.js';

/**
 * Upload a media file to PDS blob storage
 */
export async function uploadBlob(
  agent: BskyAgent,
  filePath: string,
  mimeType: string
): Promise<BlobRef> {
  const fileData = fs.readFileSync(filePath);

  const response = await agent.uploadBlob(fileData, {
    encoding: mimeType,
  });

  return response.data.blob;
}

/**
 * Upload multiple media files and return a mapping
 */
export async function uploadMediaFiles(
  agent: BskyAgent,
  mediaFiles: MediaFile[]
): Promise<Map<string, BlobRef>> {
  const blobMap = new Map<string, BlobRef>();

  for (const mediaFile of mediaFiles) {
    console.log(`📤 Uploading ${mediaFile.localPath}...`);

    try {
      const blobRef = await uploadBlob(
        agent,
        mediaFile.absolutePath,
        mediaFile.mimeType
      );

      blobMap.set(mediaFile.localPath, blobRef);
      console.log(`✅ Uploaded ${mediaFile.localPath}`);
    } catch (error) {
      console.error(`❌ Failed to upload ${mediaFile.localPath}:`, error);
      throw error;
    }
  }

  return blobMap;
}

/**
 * Create ArticleBlob array from media files and blob refs
 */
export function createArticleBlobs(
  mediaFiles: MediaFile[],
  blobMap: Map<string, BlobRef>
): ArticleBlob[] {
  return mediaFiles.map(mediaFile => {
    const blobRef = blobMap.get(mediaFile.localPath);
    if (!blobRef) {
      throw new Error(`Missing blob ref for ${mediaFile.localPath}`);
    }

    return {
      relativePath: mediaFile.localPath,
      blobRef,
      mimeType: mediaFile.mimeType,
      alt: mediaFile.alt,
    };
  });
}

/**
 * Download a blob from PDS to local filesystem
 */
export async function downloadBlob(
  agent: BskyAgent,
  blobRef: BlobRef,
  outputPath: string
): Promise<void> {
  // Get blob URL from CDN
  const did = agent.session?.did;
  if (!did) {
    throw new Error('Not authenticated');
  }

  // Construct blob URL
  const cid = blobRef.ref.toString();
  const blobUrl = `https://cdn.bsky.app/img/feed_thumbnail/plain/${did}/${cid}@jpeg`;

  // For now, we'll need to fetch via the getBlob endpoint
  // Note: This requires proper API implementation
  const response = await agent.api.com.atproto.sync.getBlob({
    did,
    cid,
  });

  // Write to file
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Response data should be the blob bytes
  fs.writeFileSync(outputPath, Buffer.from(response.data as any));
}

/**
 * Download multiple blobs from article record
 */
export async function downloadArticleBlobs(
  agent: BskyAgent,
  blobs: ArticleBlob[],
  baseDir: string
): Promise<void> {
  for (const blob of blobs) {
    const outputPath = path.join(baseDir, blob.relativePath);
    console.log(`📥 Downloading ${blob.relativePath}...`);

    try {
      await downloadBlob(agent, blob.blobRef, outputPath);
      console.log(`✅ Downloaded ${blob.relativePath}`);
    } catch (error) {
      console.error(`❌ Failed to download ${blob.relativePath}:`, error);
      // Continue with other downloads
    }
  }
}

/**
 * Get blob URL for use in generated HTML
 */
export function getBlobUrl(agent: BskyAgent, blobRef: BlobRef): string {
  const did = agent.session?.did;
  if (!did) {
    throw new Error('Not authenticated');
  }

  const cid = blobRef.ref.toString();

  // Use CDN URL for serving
  return `https://cdn.bsky.app/img/feed_fullsize/plain/${did}/${cid}@jpeg`;
}

/**
 * Create a map of local paths to blob URLs for HTML generation
 */
export function createBlobUrlMap(
  agent: BskyAgent,
  blobs?: ArticleBlob[]
): Map<string, string> {
  const urlMap = new Map<string, string>();

  if (!blobs) return urlMap;

  for (const blob of blobs) {
    const url = getBlobUrl(agent, blob.blobRef);
    urlMap.set(blob.relativePath, url);
  }

  return urlMap;
}

/**
 * Upload CSS file as blob
 */
export async function uploadCssBlob(
  agent: BskyAgent,
  cssPath: string
): Promise<BlobRef> {
  console.log(`📤 Uploading theme CSS: ${cssPath}...`);

  const blobRef = await uploadBlob(agent, cssPath, 'text/css');

  console.log('✅ Theme CSS uploaded');
  return blobRef;
}

/**
 * Download CSS blob to file
 */
export async function downloadCssBlob(
  agent: BskyAgent,
  blobRef: BlobRef,
  outputPath: string
): Promise<void> {
  console.log(`📥 Downloading theme CSS to ${outputPath}...`);

  await downloadBlob(agent, blobRef, outputPath);

  console.log('✅ Theme CSS downloaded');
}
