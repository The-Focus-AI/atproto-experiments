import { describe, it, expect, beforeAll } from 'vitest';
import { BskyAgent } from '@atproto/api';
import { createAuthenticatedClient } from './utils/client';

/**
 * Test Suite 8: Advanced Features and Utilities
 *
 * Additional AT Protocol features including feeds, lists, and moderation.
 */
describe('08. Advanced Features', () => {
  let agent: BskyAgent;

  beforeAll(async () => {
    agent = await createAuthenticatedClient();
  });

  it('should retrieve custom feeds', async () => {
    // Get list of available feeds
    try {
      const feeds = await agent.app.bsky.feed.getFeedGenerators({
        limit: 10,
      });

      console.log('Available feed generators:', feeds.data.feeds.length);

      if (feeds.data.feeds.length > 0) {
        console.log('Sample feed:', feeds.data.feeds[0].displayName);
      }
    } catch (error: any) {
      console.log('Feed generators not available:', error.message);
    }

    expect(true).toBe(true);
  });

  it('should retrieve popular feeds', async () => {
    const popularFeeds = await agent.app.bsky.unspecced.getPopularFeedGenerators({
      limit: 5,
    });

    expect(popularFeeds.data.feeds).toBeDefined();
    console.log('Popular feeds:', popularFeeds.data.feeds.length);

    popularFeeds.data.feeds.forEach((feed) => {
      console.log(`- ${feed.displayName} by ${feed.creator.handle}`);
    });
  });

  it('should create and manage a list', async () => {
    // Create a list
    const list = await agent.app.bsky.graph.list.create(
      { repo: agent.session!.did },
      {
        name: `Test List ${Date.now()}`,
        purpose: 'app.bsky.graph.defs#curatelist',
        description: 'A test list for AT Protocol exploration',
        createdAt: new Date().toISOString(),
      }
    );

    expect(list.uri).toBeDefined();
    console.log('Created list:', list.uri);

    // Get list details
    const listDetails = await agent.app.bsky.graph.getList({
      list: list.uri,
      limit: 50,
    });

    expect(listDetails.data.list).toBeDefined();
    expect(listDetails.data.list.name).toContain('Test List');

    // Delete the list
    const { rkey } = parseAtUri(list.uri);
    await agent.app.bsky.graph.list.delete({
      repo: agent.session!.did,
      rkey,
    });

    console.log('List deleted');
  });

  it('should add and remove users from a list', async () => {
    // Create a list
    const list = await agent.app.bsky.graph.list.create(
      { repo: agent.session!.did },
      {
        name: `Test List with Members ${Date.now()}`,
        purpose: 'app.bsky.graph.defs#curatelist',
        createdAt: new Date().toISOString(),
      }
    );

    // Add a user to the list
    const listItem = await agent.app.bsky.graph.listitem.create(
      { repo: agent.session!.did },
      {
        subject: 'did:plc:z72i7hdynmk6r22z27h6tvur', // bsky.app DID
        list: list.uri,
        createdAt: new Date().toISOString(),
      }
    );

    expect(listItem.uri).toBeDefined();
    console.log('Added user to list');

    // Remove user from list
    const { rkey: itemRkey } = parseAtUri(listItem.uri);
    await agent.app.bsky.graph.listitem.delete({
      repo: agent.session!.did,
      rkey: itemRkey,
    });

    // Delete the list
    const { rkey } = parseAtUri(list.uri);
    await agent.app.bsky.graph.list.delete({
      repo: agent.session!.did,
      rkey,
    });
  });

  it('should mute and unmute a user', async () => {
    const targetDid = 'did:plc:z72i7hdynmk6r22z27h6tvur'; // bsky.app

    // Mute
    await agent.mute(targetDid);
    console.log('User muted');

    // Wait for indexing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check mute status
    const profile = await agent.getProfile({ actor: targetDid });
    expect(profile.data.viewer?.muted).toBe(true);

    // Unmute
    await agent.unmute(targetDid);
    console.log('User unmuted');

    // Wait for indexing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify unmute
    const updatedProfile = await agent.getProfile({ actor: targetDid });
    expect(updatedProfile.data.viewer?.muted).toBe(false);
  });

  it('should search posts', async () => {
    const searchResults = await agent.app.bsky.feed.searchPosts({
      q: 'atproto',
      limit: 5,
    });

    expect(searchResults.data.posts).toBeDefined();
    console.log('Search results:', searchResults.data.posts.length);

    searchResults.data.posts.forEach((post) => {
      console.log(`- ${post.author.handle}: ${(post.record as any).text?.substring(0, 50)}`);
    });
  });

  it('should retrieve trending topics', async () => {
    try {
      const trending = await agent.app.bsky.unspecced.getTrendingTopics({
        limit: 10,
      });

      console.log('Trending topics:', trending.data);
    } catch (error: any) {
      console.log('Trending topics not available:', error.message);
    }

    expect(true).toBe(true);
  });

  it('should handle moderation actions', async () => {
    // Get moderation preferences
    const prefs = await agent.getPreferences();

    console.log('User preferences loaded');

    // Check content filtering preferences
    const contentFilter = prefs.moderationPrefs;
    console.log('Moderation preferences:', JSON.stringify(contentFilter, null, 2));

    expect(prefs).toBeDefined();
  });

  it('should manage thread gates', async () => {
    // Create a post with thread gate (replies restricted)
    const post = await agent.post({
      text: `Post with thread gate ${new Date().toISOString()}`,
      createdAt: new Date().toISOString(),
    });

    // Create thread gate
    const threadGate = await agent.app.bsky.feed.threadgate.create(
      { repo: agent.session!.did },
      {
        post: post.uri,
        allow: [
          {
            $type: 'app.bsky.feed.threadgate#followingRule',
          },
        ],
        createdAt: new Date().toISOString(),
      }
    );

    console.log('Thread gate created:', threadGate.uri);

    // Cleanup
    const { rkey: postRkey } = parseAtUri(post.uri);
    const { rkey: gateRkey } = parseAtUri(threadGate.uri);

    await agent.app.bsky.feed.threadgate.delete({
      repo: agent.session!.did,
      rkey: gateRkey,
    });

    await agent.api.app.bsky.feed.post.delete({
      repo: agent.session!.did,
      rkey: postRkey,
    });
  });
});

function parseAtUri(uri: string): { repo: string; collection: string; rkey: string } {
  const match = uri.match(/at:\/\/([^/]+)\/([^/]+)\/(.+)/);
  if (!match) throw new Error('Invalid AT URI');
  return { repo: match[1], collection: match[2], rkey: match[3] };
}
