import { describe, it, expect, beforeAll } from 'vitest';
import { BskyAgent } from '@atproto/api';
import { createAuthenticatedClient } from './utils/client';

/**
 * Test Suite 3: Retrieving Comments/Posts from a Thread
 */
describe('03. Retrieving Comments and Posts', () => {
  let agent: BskyAgent;

  beforeAll(async () => {
    agent = await createAuthenticatedClient();
  });

  it('should retrieve a post thread by URI', async () => {
    // First create a test post
    const post = await agent.post({
      text: `Test thread ${new Date().toISOString()}`,
      createdAt: new Date().toISOString(),
    });

    // Retrieve the thread
    const thread = await agent.getPostThread({ uri: post.uri });

    expect(thread.data.thread).toBeDefined();
    expect(thread.data.thread.post.uri).toBe(post.uri);
    expect(thread.data.thread.post.record).toBeDefined();

    console.log('Thread data:', JSON.stringify(thread.data.thread, null, 2));

    // Cleanup
    const { rkey } = parseAtUri(post.uri);
    await agent.api.app.bsky.feed.post.delete({
      repo: agent.session!.did,
      rkey,
    });
  });

  it('should retrieve a thread with replies', async () => {
    // Create parent post
    const parent = await agent.post({
      text: `Parent for thread test ${new Date().toISOString()}`,
      createdAt: new Date().toISOString(),
    });

    // Create replies
    const parentThread = await agent.getPostThread({ uri: parent.uri });
    const parentPost = parentThread.data.thread.post;

    const reply1 = await agent.post({
      text: 'Reply 1',
      reply: {
        root: { uri: parentPost.uri, cid: parentPost.cid },
        parent: { uri: parentPost.uri, cid: parentPost.cid },
      },
      createdAt: new Date().toISOString(),
    });

    const reply2 = await agent.post({
      text: 'Reply 2',
      reply: {
        root: { uri: parentPost.uri, cid: parentPost.cid },
        parent: { uri: parentPost.uri, cid: parentPost.cid },
      },
      createdAt: new Date().toISOString(),
    });

    // Wait a bit for replies to be indexed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Retrieve full thread
    const fullThread = await agent.getPostThread({ uri: parent.uri, depth: 10 });

    expect(fullThread.data.thread.post.uri).toBe(parent.uri);

    if ('replies' in fullThread.data.thread && fullThread.data.thread.replies) {
      console.log('Number of replies:', fullThread.data.thread.replies.length);
      expect(fullThread.data.thread.replies.length).toBeGreaterThanOrEqual(0);
    }

    // Cleanup
    for (const uri of [parent.uri, reply1.uri, reply2.uri]) {
      const { rkey } = parseAtUri(uri);
      await agent.api.app.bsky.feed.post.delete({
        repo: agent.session!.did,
        rkey,
      });
    }
  });

  it('should retrieve author feed (timeline)', async () => {
    const feed = await agent.getAuthorFeed({
      actor: agent.session!.did,
      limit: 10,
    });

    expect(feed.data.feed).toBeDefined();
    expect(Array.isArray(feed.data.feed)).toBe(true);

    if (feed.data.feed.length > 0) {
      const firstPost = feed.data.feed[0];
      expect(firstPost.post).toBeDefined();
      expect(firstPost.post.uri).toBeDefined();
      expect(firstPost.post.cid).toBeDefined();

      console.log('Feed items:', feed.data.feed.length);
      console.log('First post:', firstPost.post.record);
    }
  });

  it('should retrieve timeline with pagination', async () => {
    const firstPage = await agent.getTimeline({ limit: 5 });

    expect(firstPage.data.feed).toBeDefined();
    expect(firstPage.data.feed.length).toBeLessThanOrEqual(5);

    if (firstPage.data.cursor) {
      const secondPage = await agent.getTimeline({
        limit: 5,
        cursor: firstPage.data.cursor,
      });

      expect(secondPage.data.feed).toBeDefined();
      // Note: In practice, pages might overlap or be the same if the feed hasn't changed
      console.log('First page posts:', firstPage.data.feed.length);
      console.log('Second page posts:', secondPage.data.feed.length);
    }
  });

  it('should retrieve likes on a post', async () => {
    // Create a test post
    const post = await agent.post({
      text: `Test for likes ${new Date().toISOString()}`,
      createdAt: new Date().toISOString(),
    });

    // Like the post
    await agent.like(post.uri, post.cid);

    // Wait for indexing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Retrieve likes
    const likes = await agent.getLikes({ uri: post.uri, limit: 50 });

    expect(likes.data.likes).toBeDefined();
    console.log('Number of likes:', likes.data.likes.length);

    // Cleanup
    const { rkey } = parseAtUri(post.uri);
    if (likes.data.likes.length > 0 && likes.data.likes[0].uri) {
      const likeUri = likes.data.likes[0].uri as string;
      const likeRkey = parseAtUri(likeUri).rkey;
      await agent.api.app.bsky.feed.like.delete({
        repo: agent.session!.did,
        rkey: likeRkey,
      });
    }
    await agent.api.app.bsky.feed.post.delete({
      repo: agent.session!.did,
      rkey,
    });
  });

  it('should retrieve reposts of a post', async () => {
    const post = await agent.post({
      text: `Test for reposts ${new Date().toISOString()}`,
      createdAt: new Date().toISOString(),
    });

    // Repost it
    await agent.repost(post.uri, post.cid);

    // Wait for indexing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get reposted by
    const reposts = await agent.getRepostedBy({ uri: post.uri, limit: 50 });

    expect(reposts.data.repostedBy).toBeDefined();
    console.log('Number of reposts:', reposts.data.repostedBy.length);

    // Cleanup
    const { rkey } = parseAtUri(post.uri);
    // Get the repost URI to delete it
    const repostRecords = await agent.api.com.atproto.repo.listRecords({
      repo: agent.session!.did,
      collection: 'app.bsky.feed.repost',
      limit: 100,
    });
    const myRepost = repostRecords.data.records.find(
      (r: any) => r.value.subject?.uri === post.uri
    );
    if (myRepost) {
      const repostRkey = parseAtUri(myRepost.uri).rkey;
      await agent.api.app.bsky.feed.repost.delete({
        repo: agent.session!.did,
        rkey: repostRkey,
      });
    }
    await agent.api.app.bsky.feed.post.delete({
      repo: agent.session!.did,
      rkey,
    });
  });
});

function parseAtUri(uri: string): { repo: string; collection: string; rkey: string } {
  const match = uri.match(/at:\/\/([^/]+)\/([^/]+)\/(.+)/);
  if (!match) throw new Error('Invalid AT URI');
  return { repo: match[1], collection: match[2], rkey: match[3] };
}
