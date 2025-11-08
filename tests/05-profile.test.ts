import { describe, it, expect, beforeAll } from 'vitest';
import { BskyAgent, AppBskyActorProfile } from '@atproto/api';
import { createAuthenticatedClient } from './utils/client';

/**
 * Test Suite 5: Profile Operations
 */
describe('05. Download and Manage Profile', () => {
  let agent: BskyAgent;

  beforeAll(async () => {
    agent = await createAuthenticatedClient();
  });

  it('should retrieve own profile', async () => {
    const profile = await agent.getProfile({
      actor: agent.session!.did,
    });

    expect(profile.data).toBeDefined();
    expect(profile.data.did).toBe(agent.session!.did);
    expect(profile.data.handle).toBe(agent.session!.handle);

    console.log('Profile:', JSON.stringify(profile.data, null, 2));
  });

  it('should retrieve profile by handle', async () => {
    const profile = await agent.getProfile({
      actor: 'bsky.app',
    });

    expect(profile.data).toBeDefined();
    expect(profile.data.handle).toBe('bsky.app');
    expect(profile.data.did).toMatch(/^did:/);

    console.log('Bsky.app DID:', profile.data.did);
  });

  it('should retrieve profile by DID', async () => {
    const profile = await agent.getProfile({
      actor: agent.session!.did,
    });

    expect(profile.data).toBeDefined();
    expect(profile.data.did).toBe(agent.session!.did);
  });

  it('should retrieve multiple profiles', async () => {
    const profiles = await agent.getProfiles({
      actors: [agent.session!.did, 'bsky.app'],
    });

    expect(profiles.data.profiles).toBeDefined();
    expect(profiles.data.profiles.length).toBe(2);

    console.log(
      'Profiles retrieved:',
      profiles.data.profiles.map((p) => p.handle)
    );
  });

  it('should update own profile', async () => {
    // Get current profile
    const currentProfile = await agent.getProfile({
      actor: agent.session!.did,
    });

    const originalDisplayName = currentProfile.data.displayName;
    const originalDescription = currentProfile.data.description;

    // Update profile
    const newDisplayName = `Test User ${Date.now()}`;
    const newDescription = `Updated at ${new Date().toISOString()}`;

    await agent.upsertProfile((existing) => {
      return {
        ...existing,
        displayName: newDisplayName,
        description: newDescription,
      };
    });

    // Wait for update to propagate
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify update
    const updatedProfile = await agent.getProfile({
      actor: agent.session!.did,
    });

    expect(updatedProfile.data.displayName).toBe(newDisplayName);
    expect(updatedProfile.data.description).toBe(newDescription);

    console.log('Profile updated successfully');

    // Restore original profile
    await agent.upsertProfile((existing) => {
      return {
        ...existing,
        displayName: originalDisplayName,
        description: originalDescription,
      };
    });
  });

  it('should retrieve profile followers', async () => {
    const followers = await agent.getFollowers({
      actor: agent.session!.did,
      limit: 10,
    });

    expect(followers.data.followers).toBeDefined();
    expect(Array.isArray(followers.data.followers)).toBe(true);

    console.log('Number of followers:', followers.data.followers.length);

    if (followers.data.followers.length > 0) {
      console.log('First follower:', followers.data.followers[0].handle);
    }
  });

  it('should retrieve profile follows', async () => {
    const follows = await agent.getFollows({
      actor: agent.session!.did,
      limit: 10,
    });

    expect(follows.data.follows).toBeDefined();
    expect(Array.isArray(follows.data.follows)).toBe(true);

    console.log('Number of follows:', follows.data.follows.length);

    if (follows.data.follows.length > 0) {
      console.log('First follow:', follows.data.follows[0].handle);
    }
  });

  it('should follow and unfollow a user', async () => {
    const targetHandle = 'bsky.app';

    // Get the target user's DID
    const targetProfile = await agent.getProfile({ actor: targetHandle });
    const targetDid = targetProfile.data.did;

    // Follow (requires DID, not handle)
    const followResult = await agent.follow(targetDid);
    expect(followResult.uri).toBeDefined();

    console.log('Followed:', targetHandle, '(DID:', targetDid + ')');

    // Wait for indexing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify follow
    const profile = await agent.getProfile({ actor: targetHandle });
    expect(profile.data.viewer?.following).toBeDefined();

    // Unfollow
    await agent.deleteFollow(followResult.uri);

    console.log('Unfollowed:', targetHandle);

    // Wait for indexing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify unfollow
    const updatedProfile = await agent.getProfile({ actor: targetHandle });
    expect(updatedProfile.data.viewer?.following).toBeUndefined();
  });

  it('should retrieve profile suggestions', async () => {
    const suggestions = await agent.getSuggestions({ limit: 10 });

    expect(suggestions.data.actors).toBeDefined();
    expect(Array.isArray(suggestions.data.actors)).toBe(true);

    console.log('Suggested users:', suggestions.data.actors.length);

    if (suggestions.data.actors.length > 0) {
      console.log(
        'First suggestion:',
        suggestions.data.actors[0].handle,
        '-',
        suggestions.data.actors[0].displayName
      );
    }
  });

  it('should search for profiles', async () => {
    const searchResults = await agent.searchActors({
      term: 'bsky',
      limit: 5,
    });

    expect(searchResults.data.actors).toBeDefined();
    expect(Array.isArray(searchResults.data.actors)).toBe(true);

    console.log('Search results:', searchResults.data.actors.length);

    searchResults.data.actors.forEach((actor) => {
      console.log(`- ${actor.handle} (${actor.displayName})`);
    });
  });
});
