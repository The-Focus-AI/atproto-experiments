# AT Protocol Examples

Practical TypeScript examples for building with the AT Protocol and Bluesky.

## Quick Start

```bash
npm install && npm run setup
```

The setup wizard will create your Bluesky account and configure everything automatically.

---

## Examples

This project demonstrates powerful use cases for AT Protocol, from syncing files to building distributed systems.

### 📁 [Directory Sync](directory-sync/)

Sync entire directories to the AT Protocol blob store with incremental uploads, version tracking, and web viewer.

```bash
# Upload a directory (only uploads changed files)
npm run directory-sync upload ./my-documents

# List all synced directories
npm run directory-sync list

# Download anywhere
npm run directory-sync download

# Generate web viewer
npm run web-links
```

**Features:**
- Incremental uploads (skip unchanged files)
- Version history via multiple records
- Bauhaus-styled web gallery viewer
- Download blobs directly from CDN

**Use cases:** Backups, config sharing, static site deployment, file versioning

---

### 📝 [Markdown Sync](markdown-sync/)

Write Bluesky posts and threads as markdown files, publish them, and sync replies back.

```bash
# Write a post in markdown
cat > post.md <<EOF
---
title: My Post
---

Main post content here.

---

Reply 1

---

Reply 2
EOF

# Publish to Bluesky
npm run md-sync post post.md

# Sync external replies
npm run md-sync sync post.md
```

**Features:**
- Draft posts offline in markdown
- Thread posts automatically
- Version control posts with git
- Fetch replies from others
- Clean files (only main post URI stored)

**Use cases:** Blog post threads, content planning, conversation archiving

---

### ⚙️ [Job Queue](job-queue/)

Distributed job queue using AT Protocol custom records (lexicon-based) - jobs stored in your repo without cluttering your feed!

```bash
# Terminal 1: Start a worker
npm run job-listener 10

# Terminal 2: Submit a job
echo '{"type":"echo","data":{"message":"Hello"}}' > job.json
npm run job-poster post job.json

# Check status
npm run job-poster list

# Download results and cleanup
npm run job-poster finish at://... ./results
```

**Features:**
- No central server (fully distributed)
- Jobs hidden in repo (not in feed)
- Instant queries (no search indexing)
- Blob support for file results
- Extensible job handlers
- Multi-worker parallelization
- Watch multiple accounts

**Use cases:** Image processing, data analysis, webhooks, background tasks, distributed computing, job services

---

### 🔄 [PDS Sync](pds-sync/)

Download and unpack your entire Personal Data Server repository as JSON files.

```bash
# Download everything
npm run pds-sync

# List contents
npm run pds-sync list pds-exports/repo-*.car

# Unpack specific export
npm run pds-sync unpack pds-exports/repo-*.car
```

**Features:**
- Complete backup of your PDS
- Organized JSON files by collection
- Download all blobs (images, etc.)
- Perfect for account migration

**Use cases:** Account backups, data analysis, migration, archival

---

### 🔥 [Firehose](firehose/)

Real-time media downloading from the Bluesky firehose.

```bash
# Download all media
npm run firehose

# Images only
npm run firehose -- --images-only

# First 100 files
npm run firehose -- --limit=100
```

**Features:**
- Real-time streaming from `wss://bsky.network`
- Auto-downloads images and videos
- Saves metadata for each file
- Duplicate detection

**Use cases:** Media archival, network monitoring, training data collection

---

### 👤 [Account Creation](account/)

Programmatically create Bluesky accounts.

```bash
npm run create-account handle.bsky.social email@example.com password123
```

**Features:**
- Automated account creation
- Returns DID and tokens
- Helpful error messages

**Use cases:** Testing, automation, bot accounts, onboarding flows

---

## Setup

### Automatic (Recommended)

```bash
npm install
npm run setup
```

### Manual

```bash
npm install
cp .env.example .env
# Edit .env with your credentials:
# BLUESKY_HANDLE=your-handle.bsky.social
# BLUESKY_PASSWORD=your-password
```

---

## API Examples

### Basic Post

```typescript
import { BskyAgent } from '@atproto/api';

const agent = new BskyAgent({ service: 'https://bsky.social' });
await agent.login({ identifier: 'handle', password: 'pass' });

await agent.post({
  text: 'Hello from AT Protocol!',
  createdAt: new Date().toISOString(),
});
```

### Upload Image

```typescript
import { readFileSync } from 'fs';

const imageData = readFileSync('image.png');
const upload = await agent.uploadBlob(imageData, {
  encoding: 'image/png',
});

await agent.post({
  text: 'Check out this image!',
  embed: {
    $type: 'app.bsky.embed.images',
    images: [{ alt: 'My image', image: upload.data.blob }],
  },
});
```

### Thread Replies

```typescript
const parent = await agent.post({ text: 'Parent post' });

await agent.post({
  text: 'Reply',
  reply: {
    root: { uri: parent.uri, cid: parent.cid },
    parent: { uri: parent.uri, cid: parent.cid },
  },
});
```

### Send DM

```typescript
const profile = await agent.getProfile({ actor: 'user.bsky.social' });

const convo = await agent.api.chat.bsky.convo.getConvoForMembers(
  { members: [profile.data.did] },
  { headers: { 'atproto-proxy': 'did:web:api.bsky.chat#bsky_chat' } }
);

await agent.api.chat.bsky.convo.sendMessage(
  {
    convoId: convo.data.convo.id,
    message: { text: 'Hello!' },
  },
  {
    headers: { 'atproto-proxy': 'did:web:api.bsky.chat#bsky_chat' },
    encoding: 'application/json'
  }
);
```

---

## Key Concepts

### AT URIs

Records are identified by:
```
at://did:plc:xxx/app.bsky.feed.post/yyy
```

- `did:plc:xxx` - User's Decentralized Identifier
- `app.bsky.feed.post` - Collection type
- `yyy` - Record key (rkey)

### Blobs

Binary data (images, files) stored as blobs, referenced by CID (Content Identifier).

### Repository

Each user has a signed data repository containing all their records. Can be synced and exported.

---

## Tests

This project includes comprehensive test coverage (56 passing tests):

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:ui             # UI mode
```

Test files cover:
- Authentication & sessions
- Posting & threading
- Attachments & blobs
- Profiles & follows
- Direct messages
- Repository sync
- Advanced features

---

## Resources

- [AT Protocol Documentation](https://atproto.com)
- [AT Protocol API Docs](https://docs.bsky.app)
- [Bluesky](https://bsky.app)
- [@atproto/api on npm](https://www.npmjs.com/package/@atproto/api)

## License

MIT
