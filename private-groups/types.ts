/**
 * Type definitions for private groups on ATProto
 */

export const GROUP_COLLECTION = 'ai.focus.groups.group';
export const MEMBERSHIP_COLLECTION = 'ai.focus.groups.membership';
export const MESSAGE_COLLECTION = 'ai.focus.groups.message';

export interface GroupRecord {
  $type: 'ai.focus.groups.group';
  name: string;
  description?: string;
  visibility: 'public' | 'private';
  // Note: encryption key is stored locally, NOT in ATProto record
  createdAt: string;
  avatar?: {
    $type: 'blob';
    ref: { $link: string };
    mimeType: string;
    size: number;
  };
}

export interface MembershipRecord {
  $type: 'ai.focus.groups.membership';
  groupUri: string;
  memberDid: string;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: string;
  permissions: {
    canPost: boolean;
    canInvite: boolean;
    canModerate: boolean;
  };
}

export interface MessageRecord {
  $type: 'ai.focus.groups.message';
  groupUri: string;
  text: string; // Encrypted if isEncrypted=true
  isEncrypted: boolean;
  replyTo?: string;
  createdAt: string;
  attachments?: Array<{
    $type: 'blob';
    ref: { $link: string };
    mimeType: string;
    size: number;
  }>;
  facets?: any[]; // Rich text facets
}

export interface Group {
  uri: string;
  cid: string;
  record: GroupRecord;
  memberCount?: number;
  isAdmin?: boolean;
  isMember?: boolean;
}

export interface Message {
  uri: string;
  cid: string;
  record: MessageRecord;
  author: {
    did: string;
    handle?: string;
    displayName?: string;
  };
  decryptedText?: string; // Only set if message was encrypted and decrypted
}
