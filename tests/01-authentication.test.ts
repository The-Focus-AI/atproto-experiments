import { describe, it, expect, beforeAll } from 'vitest';
import { BskyAgent } from '@atproto/api';
import { createAtpClient, createAuthenticatedClient } from './utils/client';

/**
 * Test Suite 1: Account Creation and Authentication
 *
 * Note: Bluesky has been fully open for public signups since February 2024.
 * No invite codes needed - just email, handle, and password!
 */
describe('01. Authentication and Account Management', () => {
  let agent: BskyAgent;

  beforeAll(async () => {
    agent = await createAtpClient();
  });

  it('should create an unauthenticated agent', async () => {
    expect(agent).toBeDefined();
    expect(agent.session).toBeUndefined();
  });

  it.skip('should create a new account (SKIPPED - requires email verification)', async () => {
    // NOTE: Account creation on bsky.social now requires email verification
    // Use npm run setup or npm run create-account to create accounts manually
    // This test is skipped but left as reference for how account creation works

    const timestamp = Date.now();
    const testHandle = `test-user-${timestamp}.bsky.social`;
    const testEmail = `test-${timestamp}@example.com`;
    const testPassword = `TestPassword${timestamp}!`;

    const response = await agent.createAccount({
      handle: testHandle,
      email: testEmail,
      password: testPassword,
    });

    expect(response.data.handle).toBe(testHandle);
    expect(response.data.did).toBeDefined();
    expect(response.data.accessJwt).toBeDefined();
  });

  it('should login to Bluesky with valid credentials', async () => {
    const identifier = process.env.BLUESKY_HANDLE;
    const password = process.env.BLUESKY_PASSWORD;

    if (!identifier || !password) {
      console.warn('Skipping: BLUESKY_HANDLE and BLUESKY_PASSWORD not set');
      return;
    }

    const response = await agent.login({ identifier, password });

    expect(response.success).toBe(true);
    expect(agent.session).toBeDefined();
    expect(agent.session?.did).toBeDefined();
    expect(agent.session?.handle).toBe(identifier);

    console.log('Logged in as:', agent.session?.handle);
    console.log('DID:', agent.session?.did);
  });

  it('should fail login with invalid credentials', async () => {
    const tempAgent = await createAtpClient();

    await expect(
      tempAgent.login({
        identifier: 'invalid.bsky.social',
        password: 'wrongpassword',
      })
    ).rejects.toThrow();
  });

  it('should retrieve session information', async () => {
    const authenticatedAgent = await createAuthenticatedClient();

    expect(authenticatedAgent.session).toBeDefined();
    expect(authenticatedAgent.session?.accessJwt).toBeDefined();
    expect(authenticatedAgent.session?.refreshJwt).toBeDefined();
    expect(authenticatedAgent.session?.did).toMatch(/^did:/);
  });

  it('should resume session with stored tokens', async () => {
    const agent1 = await createAuthenticatedClient();
    const session = agent1.session;

    // Create new agent and resume session
    const agent2 = await createAtpClient();
    await agent2.resumeSession(session!);

    expect(agent2.session?.did).toBe(session?.did);
    expect(agent2.session?.handle).toBe(session?.handle);
  });
});
