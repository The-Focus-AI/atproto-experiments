# Private Groups for ATProto

A demonstration of how to implement private group messaging on the AT Protocol, supporting both public and members-only (encrypted) groups.

## Architecture Overview

### Design Philosophy

Based on research into ATProto's official guidance, this implementation uses a **hybrid approach**:

1. **Public groups**: Standard ATProto records visible to everyone
2. **Private groups**: Records with encrypted content, where the AppView holds the decryption key

This differs from true end-to-end encryption (E2EE) but matches the use case of "members can read what other members said" vs "public posts."

### Why Not Full E2EE?

The ATProto team explicitly **discourages** storing encrypted content in public repositories because:
- Encrypted data gets broadly archived on the firehose
- Raises stakes for key loss and content leaking
- Not architecturally sound for the protocol

However, for **semi-private groups** where:
- You trust the AppView operator
- You want "members-only" not "zero-trust E2EE"
- Simpler implementation is preferred

This approach is practical and builds on your existing codebase patterns.

### How It Works

```
┌─────────────┐
│   Creator   │ Creates group with encryption key
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Group Record (in creator's PDS)    │
│  - name: "Secret Club"              │
│  - visibility: "private"            │
└─────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  Local Key Store (output/private-groups/.group-keys.json) │
│  - groupUri -> encryptionKey                        │ ◄─── Stored locally, NOT on ATProto
└──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Membership Records                 │
│  - groupUri: "at://..."             │
│  - memberDid: "did:plc:..."         │
│  - role: "admin|member"             │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Message Records (in author's PDS)  │
│  - groupUri: "at://..."             │
│  - text: "encrypted:iv:tag:data"    │ ◄─── Encrypted with group key
│  - isEncrypted: true                │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  AppView Server                     │
│  1. Check membership                │
│  2. Fetch key from local key store  │
│  3. Decrypt messages for members    │
│  4. Return plain text to UI         │
└─────────────────────────────────────┘
```

## Custom Lexicon

The implementation defines three record types:

### 1. `ai.thefocus.groups.group`
Defines a group with metadata.

```typescript
{
  name: "Secret Club",
  description: "A private group",
  visibility: "private", // or "public"
  createdAt: "2025-11-13T...",
  avatar?: BlobRef
}

// Encryption key stored LOCALLY in output/private-groups/.group-keys.json (NOT on ATProto):
{
  "at://did:plc:xxx/ai.thefocus.groups.group/abc123": "base64-encoded-key"
}
```

### 2. `ai.thefocus.groups.membership`
Links members to groups with roles and permissions.

```typescript
{
  groupUri: "at://did:plc:.../ai.thefocus.groups.group/abc123",
  memberDid: "did:plc:xyz789",
  role: "admin" | "moderator" | "member",
  joinedAt: "2025-11-13T...",
  permissions: {
    canPost: true,
    canInvite: false,
    canModerate: false
  }
}
```

### 3. `ai.thefocus.groups.message`
Messages posted to groups (encrypted for private groups).

```typescript
{
  groupUri: "at://did:plc:.../ai.thefocus.groups.group/abc123",
  text: "Hello world", // or encrypted string
  isEncrypted: false,
  replyTo?: "at://...", // for threading
  createdAt: "2025-11-13T...",
  attachments?: [BlobRef, ...]
}
```

## Encryption Details

### Algorithm
- **AES-256-GCM** (Galois/Counter Mode)
- 256-bit keys (32 bytes)
- 128-bit IVs (16 bytes)
- 128-bit authentication tags (16 bytes)

### Message Format
Encrypted messages are stored as: `iv:authTag:ciphertext` (all base64-encoded)

Example:
```
aBcD1234eFgH5678:xYz9876wVuT5432:Q2lwaGVydGV4dEhlcmU=
```

### Key Management
- Each private group generates a random 256-bit key
- Key is stored **locally in `output/private-groups/.group-keys.json`** (NOT on ATProto)
- AppView must have access to the key store file to decrypt messages
- Keys must be distributed to members via secure out-of-band channel (e.g., invite system, shared file)

**Security Model**:
- Keys are NOT stored on ATProto (won't be archived/broadcasted on firehose)
- Only those with the local key file can encrypt/decrypt
- AppView controls access by controlling the key file
- This is secure for controlled deployments where you manage the AppView

## Data Flow

### Creating a Private Group
1. User calls `createGroup({ visibility: 'private' })`
2. System generates random AES-256 key
3. Group record created on ATProto (WITHOUT the key)
4. Encryption key stored locally in `output/private-groups/.group-keys.json`
5. Membership record created for creator with `admin` role

### Posting a Message
1. User calls `postMessage({ groupUri, text })`
2. System fetches group record to check visibility
3. If private: fetch key from local `output/private-groups/.group-keys.json`
4. Encrypt text with group's key
5. Create message record with `isEncrypted: true`
6. Store in author's PDS repo

### Reading Messages
1. AppView queries all members' repos for messages
2. Filters messages matching `groupUri`
3. Fetches encryption key from local `output/private-groups/.group-keys.json`
4. Decrypts messages if encrypted
5. Returns decrypted text to UI

## Comparison: Public vs Private

| Feature | Public Group | Private Group |
|---------|-------------|---------------|
| Visibility | Anyone can see | Members only |
| Message Storage | Plain text | Encrypted |
| Key Required | No | Yes (in local key store) |
| Firehose | All messages visible | Encrypted ciphertext visible |
| Access Control | AppView filters | AppView filters + decrypts |
| Use Case | Announcements, open communities | Internal discussions, sensitive topics |

## Example Usage

```typescript
import { BskyAgent } from '@atproto/api';
import { GroupManager } from './group-manager';

const agent = new BskyAgent({ service: 'https://bsky.social' });
await agent.login({ identifier: 'user.bsky.social', password: 'app-password' });

const groupManager = new GroupManager(agent);

// Create a private group
const { uri, encryptionKey } = await groupManager.createGroup({
  name: 'Secret Club',
  description: 'Members only',
  visibility: 'private',
});

// Post an encrypted message
await groupManager.postMessage({
  groupUri: uri,
  text: 'This will be encrypted!',
});

// Get messages (auto-decrypted)
const messages = await groupManager.getGroupMessages({ groupUri: uri });
console.log(messages[0].decryptedText); // "This will be encrypted!"
```

## Running the Example

```bash
# From the root of the project
# Ensure .env has BLUESKY_HANDLE and BLUESKY_PASSWORD set

# Run the example
npm run private-groups
```

## Security Considerations

### What This Provides
✅ Messages hidden from non-members
✅ Content encrypted at rest in PDS
✅ Group membership control
✅ Role-based permissions

### What This Does NOT Provide
❌ End-to-end encryption (AppView can decrypt)
❌ Perfect forward secrecy
❌ Post-compromise security
❌ Protection from malicious AppView operators

### When to Use This vs E2EE

**Use this approach when:**
- You trust the AppView operator
- You want "members-only" not "zero-trust"
- Simpler implementation is preferred
- You're building an internal social app

**Use full E2EE (like MLS) when:**
- You don't trust any server
- You need cryptographic guarantees
- Regulatory compliance requires it
- Building a privacy-focused messaging app

## Building an AppView

To make this production-ready, you'd need an AppView server that:

1. **Polls the firehose** for group records and messages
2. **Manages the local key store** (`output/private-groups/.group-keys.json` or database)
3. **Distributes keys securely** to authorized members (e.g., via invite system)
4. **Checks membership** before serving messages
5. **Decrypts messages** server-side before sending to clients
6. **Provides REST/GraphQL API** for clients to query groups and messages

See the `/website` and `/job-queue` examples in this repo for AppView patterns.

**Important**: The `output/private-groups/.group-keys.json` file should be:
- Backed up securely (loss = permanent data loss)
- Protected with appropriate file permissions
- Shared only with trusted AppView instances
- Ideally migrated to a proper database/HSM in production

## Future Enhancements

- **Invite system**: Generate invite codes with expiration
- **Read receipts**: Track who's seen each message
- **Typing indicators**: Real-time presence
- **Message reactions**: Like/emoji responses
- **Thread support**: Nested conversations
- **Search**: Full-text search in decrypted messages
- **Key rotation**: Update encryption key periodically
- **Audit logs**: Track membership changes
- **Public feed posts**: Reference group in standard Bluesky posts

## Related ATProto Patterns

This implementation builds on patterns from:
- `/job-queue`: Custom lexicons, polling pattern
- `/website`: Blob handling, record CRUD
- `/static-oauth`: Browser authentication

## References

- [ATProto Encryption Discussion](https://github.com/bluesky-social/atproto/discussions/121)
- [ATMessaging Proto (E2EE spec)](https://github.com/ATProtocol-Community/atmessaging-proto)
- [ATProto Lexicon Guide](https://atproto.com/guides/lexicon)
- [Germ DM (MLS-based E2EE)](https://www.germnetwork.com/blog/germdm-atproto-now-beta)

## License

MIT
