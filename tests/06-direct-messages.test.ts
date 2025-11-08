import { describe, it, expect, beforeAll } from 'vitest';
import { BskyAgent } from '@atproto/api';
import { createAuthenticatedClient } from './utils/client';

/**
 * Test Suite 6: Direct Messages
 *
 * DMs are handled through the chat.bsky namespace, which requires routing
 * requests to the Bluesky chat service using the atproto-proxy header.
 *
 * Key requirement: Add the following header to all chat API calls:
 *   headers: { 'atproto-proxy': 'did:web:api.bsky.chat#bsky_chat' }
 *
 * This header routes requests from the PDS to the dedicated chat service.
 *
 * Features demonstrated:
 * - List conversations
 * - Send direct messages
 * - Retrieve messages from conversations
 * - Get conversation details
 */
describe('06. Direct Messages', () => {
  let agent: BskyAgent;

  beforeAll(async () => {
    agent = await createAuthenticatedClient();
  });

  it('should check DM capabilities', async () => {
    // Check if DM features are available
    expect(agent).toBeDefined();
    expect(agent.session).toBeDefined();

    console.log('Agent initialized for DM testing');
    console.log('DID:', agent.session?.did);

    // Note: DM functionality may require additional API methods
    // that are being developed in the chat.bsky namespace
  });

  it('should list conversations', async () => {
    const result = await agent.api.chat.bsky.convo.listConvos(
      { limit: 10 },
      { headers: { 'atproto-proxy': 'did:web:api.bsky.chat#bsky_chat' } }
    );

    expect(result.data.convos).toBeDefined();
    expect(Array.isArray(result.data.convos)).toBe(true);

    console.log('Conversations found:', result.data.convos.length);

    if (result.data.convos.length > 0) {
      console.log('First conversation ID:', result.data.convos[0].id);
      console.log('Unread count:', result.data.convos[0].unreadCount);
    }
  });

  it('should send a DM to @wschenk.bsky.social', async () => {
    const targetHandle = 'wschenk.bsky.social';

    try {
      // First, get the target user's DID
      const targetProfile = await agent.getProfile({ actor: targetHandle });
      const targetDid = targetProfile.data.did;

      console.log('Target DID:', targetDid);

      // Get or create a conversation with the target user
      // Use headers option to add the chat proxy header
      const convoResult = await agent.api.chat.bsky.convo.getConvoForMembers(
        { members: [targetDid] },
        { headers: { 'atproto-proxy': 'did:web:api.bsky.chat#bsky_chat' } }
      );

      const convoId = convoResult.data.convo.id;
      console.log('Conversation ID:', convoId);

      // Send a message with the chat proxy header
      const message = await agent.api.chat.bsky.convo.sendMessage(
        {
          convoId,
          message: {
            text: 'Hello from AT Protocol test suite! This is an automated test message.',
          },
        },
        {
          headers: { 'atproto-proxy': 'did:web:api.bsky.chat#bsky_chat' },
          encoding: 'application/json'
        }
      );

      expect(message.data).toBeDefined();
      expect(message.data.id).toBeDefined();
      expect(message.data.text).toBe('Hello from AT Protocol test suite! This is an automated test message.');

      console.log('✅ Message sent successfully!');
      console.log('Message ID:', message.data.id);
      console.log('Sent at:', message.data.sentAt);
    } catch (error: any) {
      console.log('Error sending DM:', error.message);
      console.log('Status:', error.status);
      console.log('Error code:', error.error);

      // If it's a known limitation, document it but don't fail the test
      if (error.error === 'XRPCNotSupported' || error.status === 404) {
        console.log('Note: Chat service requires proxy header support');
      }

      throw error;
    }
  });

  it('should retrieve messages from a conversation', async () => {
    // List conversations first
    const convos = await agent.api.chat.bsky.convo.listConvos(
      { limit: 1 },
      { headers: { 'atproto-proxy': 'did:web:api.bsky.chat#bsky_chat' } }
    );

    if (convos.data.convos.length === 0) {
      console.log('No conversations found to retrieve messages from');
      expect(convos.data.convos).toBeDefined();
      return;
    }

    const convoId = convos.data.convos[0].id;
    console.log('Retrieving messages from conversation:', convoId);

    // Get messages from the conversation
    const messages = await agent.api.chat.bsky.convo.getMessages(
      { convoId, limit: 50 },
      { headers: { 'atproto-proxy': 'did:web:api.bsky.chat#bsky_chat' } }
    );

    expect(messages.data).toBeDefined();
    expect(Array.isArray(messages.data.messages)).toBe(true);

    console.log('Messages retrieved:', messages.data.messages.length);

    if (messages.data.messages.length > 0) {
      const firstMsg = messages.data.messages[0];
      console.log('Latest message text:', (firstMsg as any).text);
      console.log('Sender DID:', (firstMsg as any).sender?.did);
    }
  });

  it('should get conversation details', async () => {
    // List conversations first
    const convos = await agent.api.chat.bsky.convo.listConvos(
      { limit: 1 },
      { headers: { 'atproto-proxy': 'did:web:api.bsky.chat#bsky_chat' } }
    );

    if (convos.data.convos.length === 0) {
      console.log('No conversations found');
      expect(convos.data.convos).toBeDefined();
      return;
    }

    const convoId = convos.data.convos[0].id;
    console.log('Getting details for conversation:', convoId);

    // Get conversation details
    const convoDetails = await agent.api.chat.bsky.convo.getConvo(
      { convoId },
      { headers: { 'atproto-proxy': 'did:web:api.bsky.chat#bsky_chat' } }
    );

    expect(convoDetails.data.convo).toBeDefined();
    expect(convoDetails.data.convo.id).toBe(convoId);
    expect(convoDetails.data.convo.members).toBeDefined();
    expect(Array.isArray(convoDetails.data.convo.members)).toBe(true);

    console.log('Conversation members:', convoDetails.data.convo.members.length);
    console.log('Muted:', convoDetails.data.convo.muted);
    console.log('Unread count:', convoDetails.data.convo.unreadCount);
  });

  it('should handle DM notifications', async () => {
    // Check notifications which may include DM notifications
    const notifications = await agent.listNotifications({ limit: 10 });

    expect(notifications.data.notifications).toBeDefined();
    expect(Array.isArray(notifications.data.notifications)).toBe(true);

    console.log('Total notifications:', notifications.data.notifications.length);

    // Filter for DM-related notifications (if any)
    const dmNotifications = notifications.data.notifications.filter(
      (n) => n.reason === 'message' || n.reason.includes('chat')
    );

    console.log('DM-related notifications:', dmNotifications.length);
  });
});

/**
 * Note: The AT Protocol is actively developing DM functionality.
 * These tests will need to be updated as the chat.bsky namespace
 * becomes more fully implemented. For now, they serve as a template
 * and exploration of the expected API structure.
 *
 * References:
 * - https://github.com/bluesky-social/atproto
 * - chat.bsky.convo namespace (in development)
 */
