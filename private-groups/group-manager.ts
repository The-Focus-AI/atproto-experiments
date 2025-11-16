/**
 * Group management operations
 */

import { BskyAgent } from '@atproto/api';
import {
  GROUP_COLLECTION,
  MEMBERSHIP_COLLECTION,
  MESSAGE_COLLECTION,
  GroupRecord,
  MembershipRecord,
  MessageRecord,
  Group,
  Message,
} from './types';
import { generateGroupKey, encryptMessage, decryptMessage } from './crypto';
import { FileKeyStore } from './key-store';

export class GroupManager {
  private keyStore: FileKeyStore;

  constructor(private agent: BskyAgent, keyStorePath?: string) {
    this.keyStore = new FileKeyStore(keyStorePath);
  }

  /**
   * Create a new group
   */
  async createGroup(params: {
    name: string;
    description?: string;
    visibility: 'public' | 'private';
    avatar?: Blob;
  }): Promise<{ uri: string; cid: string; encryptionKey?: string }> {
    const { name, description, visibility, avatar } = params;

    // Generate encryption key for private groups
    const encryptionKey = visibility === 'private' ? generateGroupKey() : undefined;

    // Upload avatar if provided
    let avatarBlob;
    if (avatar) {
      const uploadResult = await this.agent.uploadBlob(avatar, {
        encoding: avatar.type,
      });
      avatarBlob = uploadResult.data.blob;
    }

    const record: GroupRecord = {
      $type: GROUP_COLLECTION,
      name,
      description,
      visibility,
      // Note: encryption key is NOT stored in ATProto record
      // It's stored locally in the key store file
      createdAt: new Date().toISOString(),
      avatar: avatarBlob,
    };

    const result = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session!.did,
      collection: GROUP_COLLECTION,
      record,
    });

    // Store encryption key locally (not on ATProto)
    if (encryptionKey) {
      this.keyStore.setKey(result.data.uri, encryptionKey);
      console.log(`🔐 Encryption key stored locally for ${result.data.uri}`);
    }

    // Add creator as admin
    await this.addMember({
      groupUri: result.data.uri,
      memberDid: this.agent.session!.did,
      role: 'admin',
      permissions: {
        canPost: true,
        canInvite: true,
        canModerate: true,
      },
    });

    return {
      uri: result.data.uri,
      cid: result.data.cid,
      encryptionKey,
    };
  }

  /**
   * Add a member to a group
   */
  async addMember(params: {
    groupUri: string;
    memberDid: string;
    role: 'admin' | 'moderator' | 'member';
    permissions: {
      canPost: boolean;
      canInvite: boolean;
      canModerate: boolean;
    };
  }): Promise<{ uri: string; cid: string }> {
    const { groupUri, memberDid, role, permissions } = params;

    const record: MembershipRecord = {
      $type: MEMBERSHIP_COLLECTION,
      groupUri,
      memberDid,
      role,
      joinedAt: new Date().toISOString(),
      permissions,
    };

    const result = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session!.did,
      collection: MEMBERSHIP_COLLECTION,
      record,
    });

    return { uri: result.data.uri, cid: result.data.cid };
  }

  /**
   * Post a message to a group
   */
  async postMessage(params: {
    groupUri: string;
    text: string;
    replyTo?: string;
    attachments?: Blob[];
  }): Promise<{ uri: string; cid: string }> {
    const { groupUri, text, replyTo, attachments } = params;

    // Get group record to check if encryption is needed
    const groupUriParts = groupUri.split('/');
    const groupRkey = groupUriParts[groupUriParts.length - 1];
    const groupDid = groupUriParts[2];

    const groupRecord = await this.agent.api.com.atproto.repo.getRecord({
      repo: groupDid,
      collection: GROUP_COLLECTION,
      rkey: groupRkey,
    });

    const group = groupRecord.data.value as GroupRecord;

    // Encrypt message if private group
    let messageText = text;
    let isEncrypted = false;

    if (group.visibility === 'private') {
      const encryptionKey = this.keyStore.getKey(groupUri);
      if (!encryptionKey) {
        throw new Error(`No encryption key found for private group: ${groupUri}. Make sure you have the key in your local key store.`);
      }
      messageText = encryptMessage(text, encryptionKey);
      isEncrypted = true;
    }

    // Upload attachments if provided
    let attachmentBlobs;
    if (attachments && attachments.length > 0) {
      attachmentBlobs = await Promise.all(
        attachments.map(async (blob) => {
          const upload = await this.agent.uploadBlob(blob, {
            encoding: blob.type,
          });
          return upload.data.blob;
        })
      );
    }

    const record: MessageRecord = {
      $type: MESSAGE_COLLECTION,
      groupUri,
      text: messageText,
      isEncrypted,
      replyTo,
      createdAt: new Date().toISOString(),
      attachments: attachmentBlobs,
    };

    const result = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session!.did,
      collection: MESSAGE_COLLECTION,
      record,
    });

    return { uri: result.data.uri, cid: result.data.cid };
  }

  /**
   * Get all groups (that you're a member of or are public)
   */
  async listGroups(): Promise<Group[]> {
    // Get memberships for current user
    const memberships = await this.agent.api.com.atproto.repo.listRecords({
      repo: this.agent.session!.did,
      collection: MEMBERSHIP_COLLECTION,
      limit: 100,
    });

    const groups: Group[] = [];

    for (const membership of memberships.data.records) {
      const membershipRecord = membership.value as MembershipRecord;
      const groupUri = membershipRecord.groupUri;

      // Skip if groupUri is missing
      if (!groupUri) {
        console.error('Membership record missing groupUri:', membership.uri);
        continue;
      }

      // Parse group URI (format: at://did:plc:xxx/collection/rkey)
      const parts = groupUri.split('/');
      if (parts.length < 5) {
        console.error('Invalid groupUri format:', groupUri);
        continue;
      }
      const rkey = parts[parts.length - 1];
      const did = parts[2];

      try {
        const groupRecord = await this.agent.api.com.atproto.repo.getRecord({
          repo: did,
          collection: GROUP_COLLECTION,
          rkey,
        });

        groups.push({
          uri: groupUri,
          cid: groupRecord.data.cid,
          record: groupRecord.data.value as GroupRecord,
          isAdmin: membershipRecord.role === 'admin',
          isMember: true,
        });
      } catch (error) {
        console.error(`Failed to fetch group ${groupUri}:`, error);
      }
    }

    return groups;
  }

  /**
   * Get messages for a group (decrypted if you have access)
   */
  async getGroupMessages(params: {
    groupUri: string;
    limit?: number;
  }): Promise<Message[]> {
    const { groupUri, limit = 50 } = params;

    // Get group record for encryption key
    const groupUriParts = groupUri.split('/');
    const groupRkey = groupUriParts[groupUriParts.length - 1];
    const groupDid = groupUriParts[2];

    const groupRecord = await this.agent.api.com.atproto.repo.getRecord({
      repo: groupDid,
      collection: GROUP_COLLECTION,
      rkey: groupRkey,
    });

    const group = groupRecord.data.value as GroupRecord;

    // Get all members' DIDs to query their messages
    const memberships = await this.agent.api.com.atproto.repo.listRecords({
      repo: this.agent.session!.did,
      collection: MEMBERSHIP_COLLECTION,
      limit: 100,
    });

    const memberDids = memberships.data.records
      .map((r) => (r.value as MembershipRecord).memberDid)
      .filter((did, index, self) => self.indexOf(did) === index); // unique

    // Fetch messages from all members
    const allMessages: Message[] = [];

    for (const did of memberDids) {
      try {
        const messages = await this.agent.api.com.atproto.repo.listRecords({
          repo: did,
          collection: MESSAGE_COLLECTION,
          limit,
        });

        for (const msg of messages.data.records) {
          const messageRecord = msg.value as MessageRecord;

          // Filter to only this group's messages
          if (messageRecord.groupUri !== groupUri) continue;

          // Decrypt if needed
          let decryptedText: string | undefined;
          if (messageRecord.isEncrypted) {
            const encryptionKey = this.keyStore.getKey(groupUri);
            if (encryptionKey) {
              try {
                decryptedText = decryptMessage(messageRecord.text, encryptionKey);
              } catch (error) {
                console.error('Failed to decrypt message:', error);
                decryptedText = '[Decryption failed]';
              }
            } else {
              decryptedText = '[No decryption key available]';
            }
          }

          allMessages.push({
            uri: msg.uri,
            cid: msg.cid,
            record: messageRecord,
            author: {
              did,
              // Handle and displayName would be fetched from profile
            },
            decryptedText,
          });
        }
      } catch (error) {
        console.error(`Failed to fetch messages from ${did}:`, error);
      }
    }

    // Sort by creation time
    allMessages.sort(
      (a, b) =>
        new Date(a.record.createdAt).getTime() -
        new Date(b.record.createdAt).getTime()
    );

    return allMessages;
  }

  /**
   * Check if a user is a member of a group
   */
  async isMember(groupUri: string, userDid?: string): Promise<boolean> {
    const did = userDid || this.agent.session!.did;

    const memberships = await this.agent.api.com.atproto.repo.listRecords({
      repo: did,
      collection: MEMBERSHIP_COLLECTION,
      limit: 100,
    });

    return memberships.data.records.some(
      (r) => (r.value as MembershipRecord).groupUri === groupUri
    );
  }
}
