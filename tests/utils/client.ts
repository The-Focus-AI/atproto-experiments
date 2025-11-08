import { BskyAgent } from '@atproto/api';

export interface AtpClientConfig {
  service?: string;
  identifier?: string;
  password?: string;
}

/**
 * Creates and configures an AT Protocol client (Bluesky Agent)
 */
export async function createAtpClient(config?: AtpClientConfig): Promise<BskyAgent> {
  const service = config?.service || process.env.ATP_SERVICE || 'https://bsky.social';
  const agent = new BskyAgent({ service });

  // Optionally login if credentials provided
  if (config?.identifier && config?.password) {
    await agent.login({
      identifier: config.identifier,
      password: config.password,
    });
  }

  return agent;
}

/**
 * Creates an authenticated client using environment variables
 */
export async function createAuthenticatedClient(): Promise<BskyAgent> {
  const identifier = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_PASSWORD;

  if (!identifier || !password) {
    throw new Error('BLUESKY_HANDLE and BLUESKY_PASSWORD must be set in .env file');
  }

  return createAtpClient({ identifier, password });
}
