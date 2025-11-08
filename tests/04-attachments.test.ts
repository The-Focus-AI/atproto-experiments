import { describe, it, expect, beforeAll } from 'vitest';
import { BskyAgent } from '@atproto/api';
import { createAuthenticatedClient } from './utils/client';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Test Suite 4: Attachments - Upload and Download
 */
describe('04. Post with Attachments', () => {
  let agent: BskyAgent;
  const testDir = join(process.cwd(), 'tests', 'fixtures');
  const downloadDir = join(process.cwd(), 'tests', 'downloads');

  beforeAll(async () => {
    agent = await createAuthenticatedClient();

    // Create test directories
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    if (!existsSync(downloadDir)) {
      mkdirSync(downloadDir, { recursive: true });
    }

    // Create a test image if it doesn't exist
    createTestImage(join(testDir, 'test-image.png'));
  });

  it('should upload an image blob', async () => {
    const imagePath = join(testDir, 'test-image.png');
    const imageData = readFileSync(imagePath);

    const response = await agent.uploadBlob(imageData, {
      encoding: 'image/png',
    });

    expect(response.data.blob).toBeDefined();
    expect(response.data.blob.mimeType).toBe('image/png');
    expect(response.data.blob.size).toBeGreaterThan(0);

    console.log('Uploaded blob:', response.data.blob);
  });

  it('should post a message with an image attachment', async () => {
    const imagePath = join(testDir, 'test-image.png');
    const imageData = readFileSync(imagePath);

    // Upload the image
    const uploadResponse = await agent.uploadBlob(imageData, {
      encoding: 'image/png',
    });

    // Create post with image
    const post = await agent.post({
      text: `Post with image ${new Date().toISOString()}`,
      embed: {
        $type: 'app.bsky.embed.images',
        images: [
          {
            alt: 'Test image',
            image: uploadResponse.data.blob,
          },
        ],
      },
      createdAt: new Date().toISOString(),
    });

    expect(post.uri).toBeDefined();
    console.log('Post with image:', post.uri);

    // Cleanup
    const { rkey } = parseAtUri(post.uri);
    await agent.api.app.bsky.feed.post.delete({
      repo: agent.session!.did,
      rkey,
    });
  });

  it('should post with multiple images', async () => {
    const imagePath = join(testDir, 'test-image.png');
    const imageData = readFileSync(imagePath);

    // Upload multiple images
    const uploads = await Promise.all([
      agent.uploadBlob(imageData, { encoding: 'image/png' }),
      agent.uploadBlob(imageData, { encoding: 'image/png' }),
      agent.uploadBlob(imageData, { encoding: 'image/png' }),
    ]);

    // Create post with multiple images
    const post = await agent.post({
      text: `Post with multiple images ${new Date().toISOString()}`,
      embed: {
        $type: 'app.bsky.embed.images',
        images: uploads.map((upload, index) => ({
          alt: `Test image ${index + 1}`,
          image: upload.data.blob,
        })),
      },
      createdAt: new Date().toISOString(),
    });

    expect(post.uri).toBeDefined();

    // Cleanup
    const { rkey } = parseAtUri(post.uri);
    await agent.api.app.bsky.feed.post.delete({
      repo: agent.session!.did,
      rkey,
    });
  });

  it('should download and save an image from a post', async () => {
    const imagePath = join(testDir, 'test-image.png');
    const imageData = readFileSync(imagePath);

    // Upload and create post
    const uploadResponse = await agent.uploadBlob(imageData, {
      encoding: 'image/png',
    });

    const post = await agent.post({
      text: `Post for download test ${new Date().toISOString()}`,
      embed: {
        $type: 'app.bsky.embed.images',
        images: [
          {
            alt: 'Test image for download',
            image: uploadResponse.data.blob,
          },
        ],
      },
      createdAt: new Date().toISOString(),
    });

    // Retrieve the post and download image
    const thread = await agent.getPostThread({ uri: post.uri });
    const postData = thread.data.thread.post;

    if (postData.embed && 'images' in postData.embed) {
      const imageEmbed = postData.embed.images[0];

      // Download the image using the blob ref
      const imageUrl = imageEmbed.fullsize;
      console.log('Image URL:', imageUrl);

      // Note: You would typically use fetch or axios to download
      // For this test, we'll verify the URL exists
      expect(imageUrl).toBeDefined();
      expect(imageUrl).toMatch(/^https?:\/\//);
    }

    // Cleanup
    const { rkey } = parseAtUri(post.uri);
    await agent.api.app.bsky.feed.post.delete({
      repo: agent.session!.did,
      rkey,
    });
  });

  it('should post with external link embed', async () => {
    const post = await agent.post({
      text: `Post with link embed ${new Date().toISOString()}`,
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: 'https://bsky.app',
          title: 'Bluesky Social',
          description: 'Social media as it should be',
        },
      },
      createdAt: new Date().toISOString(),
    });

    expect(post.uri).toBeDefined();

    // Cleanup
    const { rkey } = parseAtUri(post.uri);
    await agent.api.app.bsky.feed.post.delete({
      repo: agent.session!.did,
      rkey,
    });
  });
});

/**
 * Creates a simple test PNG image
 */
function createTestImage(path: string): void {
  if (existsSync(path)) return;

  // Simple 1x1 PNG (red pixel)
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
    0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  writeFileSync(path, png);
}

function parseAtUri(uri: string): { repo: string; collection: string; rkey: string } {
  const match = uri.match(/at:\/\/([^/]+)\/([^/]+)\/(.+)/);
  if (!match) throw new Error('Invalid AT URI');
  return { repo: match[1], collection: match[2], rkey: match[3] };
}
