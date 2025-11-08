import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BskyAgent } from '@atproto/api';
import { createAuthenticatedClient } from './utils/client';

/**
 * Test Suite 2: Posting Messages
 */
describe('02. Posting Messages', () => {
  let agent: BskyAgent;
  const createdPosts: string[] = [];

  beforeAll(async () => {
    agent = await createAuthenticatedClient();
  });

  afterAll(async () => {
    // Cleanup: Delete test posts
    for (const uri of createdPosts) {
      try {
        const { rkey } = parseAtUri(uri);
        await agent.api.app.bsky.feed.post.delete({
          repo: agent.session!.did,
          rkey,
        });
        console.log('Deleted test post:', uri);
      } catch (error) {
        console.warn('Failed to delete post:', uri, error);
      }
    }
  });

  it('should post a simple text message', async () => {
    const text = `Test post from atprot-examples ${new Date().toISOString()}`;

    const response = await agent.post({
      text,
      createdAt: new Date().toISOString(),
    });

    expect(response.uri).toBeDefined();
    expect(response.cid).toBeDefined();
    createdPosts.push(response.uri);

    console.log('Created post:', response.uri);
  });

  it('should post a message with mentions', async () => {
    const text = `Test mention @bsky.app ${new Date().toISOString()}`;

    const response = await agent.post({
      text,
      createdAt: new Date().toISOString(),
    });

    expect(response.uri).toBeDefined();
    createdPosts.push(response.uri);
  });

  it('should post a message with a URL', async () => {
    const text = `Check out https://bsky.app - ${new Date().toISOString()}`;

    const response = await agent.post({
      text,
      createdAt: new Date().toISOString(),
    });

    expect(response.uri).toBeDefined();
    createdPosts.push(response.uri);
  });

  it('should post a message with hashtags', async () => {
    const text = `Testing #atproto #bluesky ${new Date().toISOString()}`;

    const response = await agent.post({
      text,
      createdAt: new Date().toISOString(),
    });

    expect(response.uri).toBeDefined();
    createdPosts.push(response.uri);
  });

  it('should reply to a post', async () => {
    // First create a parent post
    const parentPost = await agent.post({
      text: `Parent post ${new Date().toISOString()}`,
      createdAt: new Date().toISOString(),
    });
    createdPosts.push(parentPost.uri);

    // Get the parent post to create proper reply references
    const parentThread = await agent.getPostThread({ uri: parentPost.uri });

    if (parentThread.data.thread.post) {
      const parent = parentThread.data.thread.post;

      // Create reply
      const reply = await agent.post({
        text: `Reply to parent ${new Date().toISOString()}`,
        reply: {
          root: {
            uri: parent.uri,
            cid: parent.cid,
          },
          parent: {
            uri: parent.uri,
            cid: parent.cid,
          },
        },
        createdAt: new Date().toISOString(),
      });

      expect(reply.uri).toBeDefined();
      createdPosts.push(reply.uri);
    }
  });

  it('should quote post (repost with comment)', async () => {
    // Create a post to quote
    const originalPost = await agent.post({
      text: `Original post to quote ${new Date().toISOString()}`,
      createdAt: new Date().toISOString(),
    });
    createdPosts.push(originalPost.uri);

    // Quote the post
    const quotePost = await agent.post({
      text: `Quoting this post ${new Date().toISOString()}`,
      embed: {
        $type: 'app.bsky.embed.record',
        record: {
          uri: originalPost.uri,
          cid: originalPost.cid,
        },
      },
      createdAt: new Date().toISOString(),
    });

    expect(quotePost.uri).toBeDefined();
    createdPosts.push(quotePost.uri);
  });
});

/**
 * Helper function to parse AT URI
 */
function parseAtUri(uri: string): { repo: string; collection: string; rkey: string } {
  const match = uri.match(/at:\/\/([^/]+)\/([^/]+)\/(.+)/);
  if (!match) throw new Error('Invalid AT URI');

  return {
    repo: match[1],
    collection: match[2],
    rkey: match[3],
  };
}
